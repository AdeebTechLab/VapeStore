const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const salesController = require('../controllers/salesController');
const openedBottleController = require('../controllers/openedBottleController');
const spendingController = require('../controllers/spendingController');
const auth = require('../middleware/auth');
const { isShopkeeper, checkShopAccess } = require('../middleware/roleCheck');
const { validateSell } = require('../middleware/validation');

// All shop routes require authentication and shopkeeper role
router.use(auth, isShopkeeper);

// Product browsing (shopkeeper view)
router.get('/:shopDbName/products', productController.getProducts);
router.get('/:shopDbName/products/:productId', productController.getProduct);

// Product price update (shopkeeper can update price)
router.patch('/:shopDbName/products/:productId/price', productController.updateProductPrice);

// Barcode scanning
router.post('/:shopDbName/scan', productController.searchByBarcode);

// Sales operations
router.post('/:shopDbName/sell', validateSell, salesController.sellProduct);
router.post('/:shopDbName/sell-bulk', salesController.sellBulk);

// Session management
router.get('/:shopDbName/session', salesController.getSessionInfo);
router.get('/:shopDbName/transactions', salesController.getSessionTransactions);
router.post('/:shopDbName/logout', salesController.logoutAndGenerateReport);

// E-Liquid Opened Bottle operations
router.post('/:shopDbName/open-bottle', openedBottleController.openBottle);
router.get('/:shopDbName/opened-bottles', openedBottleController.getOpenedBottles);
router.post('/:shopDbName/sell-ml', openedBottleController.sellMl);
router.delete('/:shopDbName/opened-bottles/:bottleId', openedBottleController.deleteOpenedBottle);

// Spending operations (shopkeeper can add spending during session)
router.post('/:shopDbName/spending', spendingController.addSpending);
router.get('/:shopDbName/spending', spendingController.getSessionSpending);

module.exports = router;
