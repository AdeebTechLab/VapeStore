const { getShopConnection } = require('../config/database');
const productSchema = require('../models/Product');
const transactionSchema = require('../models/Transaction');
const sessionReportSchema = require('../models/SessionReport');
const sessionService = require('../services/sessionService');
const asyncHandler = require('../utils/asyncHandler');
const { emitSaleCompleted, emitStockUpdated, emitSessionEnded, emitBottleUpdated } = require('../services/socketService');

/**
 * Sell a product (shopkeeper operation)
 * POST /api/shop/:shopDbName/sell
 */
const sellProduct = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const { productId, qty } = req.body;
    const sessionId = req.user.sessionId;

    const quantity = parseInt(qty) || 1;

    // Connect to shop database
    const shopConn = await getShopConnection(shopDbName);
    const Product = shopConn.model('Product', productSchema);
    const Transaction = shopConn.model('Transaction', transactionSchema);

    // Find product and decrement units atomically
    const product = await Product.findOneAndUpdate(
        {
            _id: productId,
            units: { $gte: quantity } // Ensure enough units available
        },
        {
            $inc: { units: -quantity }
        },
        {
            new: true,
            runValidators: true,
        }
    );

    if (!product) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient inventory or product not found',
        });
    }

    // Calculate total price
    const totalPrice = product.pricePerUnit * quantity;

    // Create transaction record
    const transaction = new Transaction({
        productId: product._id,
        productName: product.name,
        qty: quantity,
        pricePerUnit: product.pricePerUnit,
        totalPrice,
        soldByShopkeeperId: req.user.id,
        soldBy: req.user.username || 'Unknown',
        sessionId,
    });

    await transaction.save();

    // Update session
    sessionService.updateSession(sessionId, totalPrice);

    res.json({
        success: true,
        message: 'Product sold successfully',
        transaction: {
            id: transaction._id,
            productName: transaction.productName,
            qty: transaction.qty,
            totalPrice: transaction.totalPrice,
        },
        product: {
            id: product._id,
            name: product.name,
            remainingUnits: product.units,
        },
    });
});

/**
 * Sell multiple products at once (cart checkout)
 * POST /api/shop/:shopDbName/sell-bulk
 */
const sellBulk = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const { items, customerName, customerPhone, customerEmail, paymentMethod } = req.body;
    const sessionId = req.user.sessionId;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No items to sell',
        });
    }

    const shopConn = await getShopConnection(shopDbName);
    const Product = shopConn.model('Product', productSchema);
    const Transaction = shopConn.model('Transaction', transactionSchema);
    const openedBottleSchema = require('../models/OpenedBottle');
    const OpenedBottle = shopConn.model('OpenedBottle', openedBottleSchema);

    // Generate unique checkoutId to group all items from this checkout
    const checkoutId = `CHK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const soldItems = [];
    const errors = [];
    let totalAmount = 0;

    for (const item of items) {
        try {
            if (item.type === 'ml' && item.openedBottleId) {
                // Selling ML from opened bottle
                const openedBottle = await OpenedBottle.findById(item.openedBottleId);
                if (!openedBottle || openedBottle.remainingMl < item.mlAmount) {
                    errors.push(`Insufficient ML for ${item.productName}`);
                    continue;
                }

                const product = await Product.findById(openedBottle.productId);
                // Use provided price from cart if available, otherwise calculate
                const calculatedMlPrice = product ? Math.round((product.pricePerUnit / product.mlCapacity) * item.mlAmount) : 0;
                const mlPrice = Math.round(item.price !== undefined ? item.price : calculatedMlPrice);

                // Update opened bottle
                openedBottle.remainingMl -= item.mlAmount;
                openedBottle.salesHistory.push({
                    mlSold: item.mlAmount,
                    soldAt: new Date(),
                    soldBy: req.user?.username || 'Unknown',
                });

                if (openedBottle.remainingMl <= 0) {
                    openedBottle.status = 'empty';
                    openedBottle.remainingMl = 0;
                    if (product) {
                        product.hasOpenedBottle = false;
                        await product.save();
                    }
                }
                await openedBottle.save();

                // Create transaction
                const transaction = new Transaction({
                    productId: openedBottle.productId,
                    productName: `${openedBottle.productName} (${item.mlAmount}ml)`,
                    qty: 1,
                    pricePerUnit: mlPrice,
                    totalPrice: mlPrice,
                    originalPrice: item.originalPrice || calculatedMlPrice,
                    cartPrice: item.cartPrice || mlPrice,
                    checkoutId, // Group items from same checkout
                    soldByShopkeeperId: req.user?.id,
                    soldBy: req.user?.username || 'Unknown',
                    sessionId,
                    customerName: customerName || '',
                    customerPhone: customerPhone || '',
                    customerEmail: customerEmail || '',
                    paymentMethod: paymentMethod || 'Cash',
                });
                await transaction.save();

                soldItems.push({
                    name: `${openedBottle.productName} (${item.mlAmount}ml)`,
                    qty: 1,
                    price: mlPrice,
                    originalPrice: item.originalPrice || calculatedMlPrice,
                    cartPrice: item.cartPrice || mlPrice,
                    checkoutId,
                });
                totalAmount += mlPrice;
                sessionService.updateSession(sessionId, mlPrice);


            } else {
                // Selling regular product
                const quantity = parseInt(item.qty) || 1;
                const product = await Product.findOneAndUpdate(
                    { _id: item.productId, units: { $gte: quantity } },
                    { $inc: { units: -quantity } },
                    { new: true }
                );

                if (!product) {
                    errors.push(`Insufficient stock for ${item.productName || 'product'}`);
                    continue;
                }

                // Use provided price from cart if available, otherwise use database price
                const unitPrice = Math.round(item.price !== undefined ? item.price : product.pricePerUnit);
                const itemTotal = unitPrice * quantity;

                const transaction = new Transaction({
                    productId: product._id,
                    productName: product.name,
                    qty: quantity,
                    pricePerUnit: unitPrice,
                    totalPrice: itemTotal,
                    costPrice: product.costPrice || 0,
                    originalPrice: item.originalPrice || product.pricePerUnit,
                    cartPrice: item.cartPrice || item.price || product.pricePerUnit,
                    checkoutId, // Group items from same checkout
                    soldByShopkeeperId: req.user?.id,
                    soldBy: req.user?.username || 'Unknown',
                    sessionId,
                    customerName: customerName || '',
                    customerPhone: customerPhone || '',
                    customerEmail: customerEmail || '',
                    paymentMethod: paymentMethod || 'Cash',
                });
                await transaction.save();

                soldItems.push({
                    name: product.name,
                    qty: quantity,
                    price: unitPrice,
                    originalPrice: item.originalPrice || product.pricePerUnit,
                    cartPrice: item.cartPrice || item.price || product.pricePerUnit,
                    checkoutId,
                });
                totalAmount += itemTotal;
                sessionService.updateSession(sessionId, itemTotal);
            }
        } catch (error) {
            errors.push(`Error processing ${item.productName || 'item'}: ${error.message}`);
        }
    }

    if (soldItems.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No items could be sold',
            errors,
        });
    }

    // Emit real-time sale event
    try {
        emitSaleCompleted(shopDbName, { soldItems, totalAmount, soldBy: req.user?.username });
    } catch (e) { /* Socket not ready */ }

    res.json({
        success: true,
        message: `Sold ${soldItems.length} item(s)`,
        soldItems,
        totalAmount,
        errors: errors.length > 0 ? errors : undefined,
    });
});

/**
 * Logout and generate session report
 * POST /api/shop/:shopDbName/logout
 */
const logoutAndGenerateReport = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const sessionId = req.user.sessionId;

    // End session
    const session = sessionService.endSession(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shopDbName);
    const Transaction = shopConn.model('Transaction', transactionSchema);
    const SessionReport = shopConn.model('SessionReport', sessionReportSchema);
    const spendingSchema = require('../models/Spending');
    const Spending = shopConn.model('Spending', spendingSchema);

    // Get all transactions for this session
    const transactions = await Transaction.find({ sessionId }).sort({ soldAt: 1 });

    // Get all spendings for this session
    const spendings = await Spending.find({ sessionId }).sort({ createdAt: 1 });
    const totalSpending = spendings.reduce((sum, s) => sum + s.amount, 0);

    // Aggregate sold items with customer info
    const soldItems = transactions.map(t => ({
        productId: t.productId,
        productName: t.productName,
        qty: t.qty,
        pricePerUnit: t.pricePerUnit,
        totalPrice: t.totalPrice,
        originalPrice: t.originalPrice || t.pricePerUnit,
        cartPrice: t.cartPrice || t.pricePerUnit,
        checkoutId: t.checkoutId || '', // Group items from same checkout
        customerName: t.customerName || '',
        customerPhone: t.customerPhone || '',
        customerEmail: t.customerEmail || '',
        paymentMethod: t.paymentMethod || 'Cash',
        soldAt: t.soldAt,
    }));

    const totalAmount = transactions.reduce((sum, t) => sum + t.totalPrice, 0);
    const totalItemsSold = transactions.reduce((sum, t) => sum + t.qty, 0);

    // Create session report with spendings
    const sessionReport = new SessionReport({
        sessionId,
        shopkeeperId: req.user.id,
        shopkeeperUsername: req.user.username,
        startTime: session.startTime,
        endTime: session.endTime || new Date(),
        soldItems,
        totalAmount,
        totalItemsSold,
        spendings: spendings.map(s => ({
            reason: s.reason,
            amount: s.amount,
            createdAt: s.createdAt,
        })),
        totalSpending,
    });

    await sessionReport.save();

    // Emit real-time session ended event
    try {
        emitSessionEnded(shopDbName, sessionReport);
    } catch (e) { /* Socket not ready */ }

    res.json({
        success: true,
        message: 'Session ended and report generated',
        report: {
            sessionId: sessionReport.sessionId,
            startTime: sessionReport.startTime,
            endTime: sessionReport.endTime,
            totalItemsSold: sessionReport.totalItemsSold,
            totalAmount: sessionReport.totalAmount,
            soldItems: sessionReport.soldItems,
        },
    });
});

/**
 * Get current session info
 * GET /api/shop/:shopDbName/session
 */
const getSessionInfo = asyncHandler(async (req, res) => {
    const sessionId = req.user.sessionId;

    const session = sessionService.getSession(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found',
        });
    }

    res.json({
        success: true,
        session: {
            sessionId: session.sessionId,
            startTime: session.startTime,
            salesCount: session.salesCount,
            totalAmount: session.totalAmount,
        },
    });
});

/**
 * Get transaction history for current session
 * GET /api/shop/:shopDbName/transactions
 */
const getSessionTransactions = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const sessionId = req.user.sessionId;

    // Connect to shop database
    const shopConn = await getShopConnection(shopDbName);
    const Transaction = shopConn.model('Transaction', transactionSchema);

    const transactions = await Transaction
        .find({ sessionId })
        .sort({ soldAt: -1 });

    res.json({
        success: true,
        count: transactions.length,
        transactions,
    });
});

/**
 * Get all active sessions with live transaction data
 * GET /api/shop/:shopDbName/active-sessions
 */
const getActiveSessions = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;

    // Connect to shop database
    const shopConn = await getShopConnection(shopDbName);
    const Transaction = shopConn.model('Transaction', transactionSchema);
    const spendingSchema = require('../models/Spending');
    const Spending = shopConn.model('Spending', spendingSchema);

    // Get all active sessions from sessionService
    const allSessions = [];

    // We need to export activeSessions from sessionService or add a method
    // For now, let's get unique sessionIds from recent transactions (last 24 hours)
    // and check if they're still active
    const recentTransactions = await Transaction.find({
        soldAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).distinct('sessionId');

    // For each sessionId, check if session is still active
    for (const sessionId of recentTransactions) {
        const session = sessionService.getSession(sessionId);
        if (session) {
            // This is an active session - get its transactions
            const transactions = await Transaction.find({ sessionId }).sort({ soldAt: 1 });
            const spendings = await Spending.find({ sessionId }).sort({ createdAt: 1 });
            const totalSpending = spendings.reduce((sum, s) => sum + s.amount, 0);

            // Map transactions to soldItems format
            const soldItems = transactions.map(t => ({
                productId: t.productId,
                productName: t.productName,
                qty: t.qty,
                pricePerUnit: t.pricePerUnit,
                totalPrice: t.totalPrice,
                originalPrice: t.originalPrice || t.pricePerUnit,
                cartPrice: t.cartPrice || t.pricePerUnit,
                checkoutId: t.checkoutId || '',
                customerName: t.customerName || '',
                customerPhone: t.customerPhone || '',
                customerEmail: t.customerEmail || '',
                paymentMethod: t.paymentMethod || 'Cash',
                soldAt: t.soldAt,
            }));

            const totalAmount = transactions.reduce((sum, t) => sum + t.totalPrice, 0);
            const totalItemsSold = transactions.reduce((sum, t) => sum + t.qty, 0);

            allSessions.push({
                _id: sessionId, // Use sessionId as _id for compatibility
                sessionId,
                shopkeeperId: session.shopkeeperId,
                shopkeeperUsername: session.shopkeeperUsername,
                startTime: session.startTime,
                endTime: null, // Still active
                isActive: true, // Mark as active session
                soldItems,
                totalAmount,
                totalItemsSold,
                spendings: spendings.map(s => ({
                    reason: s.reason,
                    amount: s.amount,
                    createdAt: s.createdAt,
                })),
                totalSpending,
            });
        }
    }

    res.json({
        success: true,
        count: allSessions.length,
        activeSessions: allSessions,
    });
});

module.exports = {
    sellProduct,
    sellBulk,
    logoutAndGenerateReport,
    getSessionInfo,
    getSessionTransactions,
    getActiveSessions,
};

