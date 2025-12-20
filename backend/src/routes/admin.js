const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const shopkeeperController = require('../controllers/shopkeeperController');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const { upload } = require('../middleware/upload');
const { validateProduct, validateShopkeeper } = require('../middleware/validation');

// All admin routes require authentication and admin role
router.use(auth, isAdmin);

// Shop management
router.get('/shops', adminController.getAllShops);
router.post('/shops', adminController.createShop);
router.delete('/shops/:shopId', adminController.deleteShop);

// Analytics
router.get('/analytics', adminController.getAnalytics);

// Reports
router.get('/reports', adminController.getReports);
router.get('/reports/:reportId/download', adminController.downloadReport);
router.get('/shops/:shopId/sales-report', adminController.downloadSalesReport);

// Recent products (for autofill)
router.get('/recent-products', adminController.getRecentProducts);
router.post('/recent-products', adminController.saveRecentProduct);

// Product management
router.get('/shops/:shopId/products', productController.getProducts);
router.get('/shops/:shopId/products/:productId', productController.getProduct);
router.post(
    '/shops/:shopId/products',
    upload.single('image'),
    validateProduct,
    productController.createProduct
);
router.put(
    '/shops/:shopId/products/:productId',
    upload.single('image'),
    productController.updateProduct
);
router.delete('/shops/:shopId/products/:productId', productController.deleteProduct);

// Barcode
// router.post('/shops/:shopId/products/:productId/qrcode', productController.generateProductQRCode); // Deprecated
router.post('/shops/:shopId/scan', productController.searchByBarcode);

// Shopkeeper management
router.get('/shops/:shopId/shopkeepers', shopkeeperController.getShopkeepers);
router.post(
    '/shops/:shopId/shopkeepers',
    validateShopkeeper,
    shopkeeperController.createShopkeeper
);
router.put('/shops/:shopId/shopkeepers/:shopkeeperId', shopkeeperController.updateShopkeeper);
router.delete('/shops/:shopId/shopkeepers/:shopkeeperId', shopkeeperController.deleteShopkeeper);

// Session reports (shopkeeper work reports)
router.get('/shops/:shopId/session-reports', adminController.getSessionReports);
router.get('/shops/:shopId/session-reports/:reportId', adminController.getSessionReportDetails);
router.put('/shops/:shopId/session-reports/:reportId/reconcile', adminController.updateSessionReconciliation);
router.delete('/shops/:shopId/session-reports/:reportId', adminController.deleteSessionReport);

// Opened bottles management
const openedBottleController = require('../controllers/openedBottleController');
router.get('/shops/:shopId/opened-bottles', openedBottleController.getOpenedBottlesAdmin);
router.delete('/shops/:shopId/opened-bottles/:bottleId', openedBottleController.deleteOpenedBottleAdmin);

module.exports = router;
