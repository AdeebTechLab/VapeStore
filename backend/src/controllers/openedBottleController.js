const { getShopConnection, connectAdminDB } = require('../config/database');
const shopSchema = require('../models/Shop');
const productSchema = require('../models/Product');
const openedBottleSchema = require('../models/OpenedBottle');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Open a bottle from sealed stock
 * POST /api/shop/:shopDbName/open-bottle
 */
const openBottle = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const { productId } = req.body;
    const username = req.user?.username || 'Unknown';

    const shopConn = await getShopConnection(shopDbName);
    const Product = shopConn.model('Product', productSchema);
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);

    // Get product
    const product = await Product.findById(productId);
    if (!product) {
        return res.status(404).json({
            success: false,
            message: 'Product not found',
        });
    }

    // Check if it's an E-Liquid
    if (product.category !== 'E-Liquid') {
        return res.status(400).json({
            success: false,
            message: 'Only E-Liquid products can be opened as bottles',
        });
    }

    // Check if there are sealed units available
    if (product.units <= 0) {
        return res.status(400).json({
            success: false,
            message: 'No sealed bottles available to open',
        });
    }

    // Create opened bottle entry
    const openedBottle = new OpenedBottle({
        productId: product._id,
        productName: product.name,
        productBrand: product.brand,
        mlCapacity: product.mlCapacity,
        remainingMl: product.mlCapacity,
        imageUrl: product.imageUrl,
        openedBy: username,
        status: 'open',
    });

    await openedBottle.save();

    // Update product: decrement units, set hasOpenedBottle
    product.units -= 1;
    product.hasOpenedBottle = true;
    await product.save();

    res.status(201).json({
        success: true,
        message: `Opened a ${product.mlCapacity}ml bottle of ${product.name}`,
        openedBottle,
        product,
    });
});

/**
 * Get all opened bottles for a shop
 * GET /api/shop/:shopDbName/opened-bottles
 */
const getOpenedBottles = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const { status } = req.query; // 'open', 'empty', or undefined for all

    const shopConn = await getShopConnection(shopDbName);
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);

    const query = {};
    if (status) {
        query.status = status;
    }

    const openedBottles = await OpenedBottle.find(query).sort({ openedAt: -1 });

    res.json({
        success: true,
        count: openedBottles.length,
        openedBottles,
    });
});

/**
 * Sell ML from an opened bottle
 * POST /api/shop/:shopDbName/sell-ml
 */
const sellMl = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const { openedBottleId, mlToSell, pricePerMl } = req.body;
    const username = req.user?.username || 'Unknown';
    const sessionId = req.user?.sessionId;

    if (!mlToSell || mlToSell <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Please specify a valid ML amount to sell',
        });
    }

    const shopConn = await getShopConnection(shopDbName);
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);
    const Product = shopConn.model('Product', productSchema);
    const transactionSchema = require('../models/Transaction');
    const Transaction = shopConn.model('Transaction', transactionSchema);
    const sessionService = require('../services/sessionService');

    const openedBottle = await OpenedBottle.findById(openedBottleId);
    if (!openedBottle) {
        return res.status(404).json({
            success: false,
            message: 'Opened bottle not found',
        });
    }

    if (openedBottle.status === 'empty') {
        return res.status(400).json({
            success: false,
            message: 'This bottle is already empty',
        });
    }

    if (mlToSell > openedBottle.remainingMl) {
        return res.status(400).json({
            success: false,
            message: `Cannot sell ${mlToSell}ml. Only ${openedBottle.remainingMl}ml remaining.`,
        });
    }

    // Get product for price calculation
    const product = await Product.findById(openedBottle.productId);

    // Calculate price for the ML sold (round to avoid floating-point issues)
    // Price per ML = bottle price / bottle capacity
    const mlPrice = Math.round(pricePerMl || (product ? (product.pricePerUnit / product.mlCapacity) * mlToSell : 0));
    const totalPrice = mlPrice;

    // Subtract ML
    openedBottle.remainingMl -= mlToSell;

    // Add to sales history
    openedBottle.salesHistory.push({
        mlSold: mlToSell,
        soldAt: new Date(),
        soldBy: username,
    });

    // Create transaction record for session report
    if (sessionId) {
        const transaction = new Transaction({
            productId: openedBottle.productId,
            productName: `${openedBottle.productName} (${mlToSell}ml)`,
            qty: 1, // 1 ML sale transaction
            pricePerUnit: totalPrice,
            totalPrice: totalPrice,
            soldByShopkeeperId: req.user?.id,
            sessionId,
        });
        await transaction.save();

        // Update session
        sessionService.updateSession(sessionId, totalPrice);
    }

    // Check if empty
    if (openedBottle.remainingMl <= 0) {
        openedBottle.status = 'empty';
        openedBottle.remainingMl = 0;

        // Update product to allow opening new bottle
        if (product) {
            product.hasOpenedBottle = false;
            await product.save();
        }
    }

    await openedBottle.save();

    res.json({
        success: true,
        message: `Sold ${mlToSell}ml for $${totalPrice.toFixed(2)}. ${openedBottle.remainingMl}ml remaining.`,
        openedBottle,
        transaction: {
            mlSold: mlToSell,
            totalPrice,
        },
    });
});

/**
 * Delete an empty bottle record (optional cleanup)
 * DELETE /api/shop/:shopDbName/opened-bottles/:bottleId
 */
const deleteOpenedBottle = asyncHandler(async (req, res) => {
    const { shopDbName, bottleId } = req.params;

    const shopConn = await getShopConnection(shopDbName);
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);

    const bottle = await OpenedBottle.findById(bottleId);
    if (!bottle) {
        return res.status(404).json({
            success: false,
            message: 'Bottle not found',
        });
    }

    await OpenedBottle.findByIdAndDelete(bottleId);

    res.json({
        success: true,
        message: 'Bottle record deleted',
    });
});

/**
 * Get opened bottles for admin (using shopId)
 * GET /api/admin/shops/:shopId/opened-bottles
 */
const getOpenedBottlesAdmin = asyncHandler(async (req, res) => {
    const { shopId } = req.params;

    // Get shop to find dbName
    const adminDb = await connectAdminDB();
    const Shop = adminDb.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    const shopConn = await getShopConnection(shop.dbName);
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);

    // Get all opened bottles (including empty ones for admin view)
    const bottles = await OpenedBottle.find().sort({ createdAt: -1 });

    res.json({
        success: true,
        openedBottles: bottles,
    });
});

/**
 * Delete opened bottle as admin
 * DELETE /api/admin/shops/:shopId/opened-bottles/:bottleId
 */
const deleteOpenedBottleAdmin = asyncHandler(async (req, res) => {
    const { shopId, bottleId } = req.params;

    // Get shop to find dbName
    const adminDb = await connectAdminDB();
    const Shop = adminDb.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    const shopConn = await getShopConnection(shop.dbName);
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);
    const Product = shopConn.model('Product', productSchema);

    const bottle = await OpenedBottle.findById(bottleId);
    if (!bottle) {
        return res.status(404).json({
            success: false,
            message: 'Opened bottle not found',
        });
    }

    // Reset hasOpenedBottle flag on product
    await Product.findByIdAndUpdate(bottle.productId, { hasOpenedBottle: false });

    // Delete the bottle record
    await OpenedBottle.findByIdAndDelete(bottleId);

    res.json({
        success: true,
        message: 'Opened bottle deleted successfully',
    });
});

module.exports = {
    openBottle,
    getOpenedBottles,
    sellMl,
    deleteOpenedBottle,
    getOpenedBottlesAdmin,
    deleteOpenedBottleAdmin,
};
