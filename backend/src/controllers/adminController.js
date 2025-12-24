const { connectAdminDB, getShopConnection } = require('../config/database');
const config = require('../config/environment');
const shopSchema = require('../models/Shop');
const productSchema = require('../models/Product');
const shopkeeperSchema = require('../models/Shopkeeper');
const sessionReportSchema = require('../models/SessionReport');
const transactionSchema = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');
const { generateCSVReport, generatePDFReport } = require('../services/reportService');
const ExcelJS = require('exceljs');

/**
 * Get all shops
 * GET /api/admin/shops
 */
const getAllShops = asyncHandler(async (req, res) => {
    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);

    const shops = await Shop.find({ isActive: true }).sort({ createdAt: -1 });

    // Get stats for each shop
    const shopsWithStats = await Promise.all(
        shops.map(async (shop) => {
            try {
                const shopConn = await getShopConnection(shop.dbName);
                const Product = shopConn.model('Product', productSchema);
                const Transaction = shopConn.model('Transaction', transactionSchema);

                const productCount = await Product.countDocuments();

                // Get today's sales
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const todaysSales = await Transaction.aggregate([
                    { $match: { soldAt: { $gte: today } } },
                    { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
                ]);

                // Get all-time total sales (since shop creation)
                const allTimeSales = await Transaction.aggregate([
                    { $group: { _id: null, total: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
                ]);

                // Get total stock value (sell price × units)
                const stockValue = await Product.aggregate([
                    { $group: { _id: null, total: { $sum: { $multiply: ['$units', '$pricePerUnit'] } } } }
                ]);

                // Get total cost value (cost price × units) for investment calculation
                const costValue = await Product.aggregate([
                    { $group: { _id: null, total: { $sum: { $multiply: ['$units', '$costPrice'] } } } }
                ]);

                return {
                    ...shop.toObject(),
                    stats: {
                        productCount,
                        todaysSales: todaysSales[0]?.total || 0,
                        todaysSalesCount: todaysSales[0]?.count || 0,
                        allTimeSales: allTimeSales[0]?.total || 0,
                        allTimeSalesCount: allTimeSales[0]?.count || 0,
                        totalStockValue: stockValue[0]?.total || 0,
                        totalCostValue: costValue[0]?.total || 0,
                    },
                };
            } catch (error) {
                return {
                    ...shop.toObject(),
                    stats: { productCount: 0, todaysSales: 0, todaysSalesCount: 0, allTimeSales: 0, allTimeSalesCount: 0, totalStockValue: 0, totalCostValue: 0 },
                };
            }
        })
    );

    res.json({
        success: true,
        count: shopsWithStats.length,
        shops: shopsWithStats,
    });
});

/**
 * Create a new shop
 * POST /api/admin/shops
 */
const createShop = asyncHandler(async (req, res) => {
    const { name, location, logoUrl } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: 'Shop name is required',
        });
    }

    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);

    // Generate dbName
    const shopCount = await Shop.countDocuments();
    const dbName = `${config.shopDbPrefix}${shopCount + 1}`;

    // Create shop
    const shop = new Shop({
        name,
        dbName,
        location: location || '',
        logoUrl: logoUrl || '',
    });

    await shop.save();

    // Initialize shop database (just connect to create it)
    await getShopConnection(dbName);

    res.status(201).json({
        success: true,
        message: 'Shop created successfully',
        shop,
    });
});

/**
 * Get analytics data
 * GET /api/admin/analytics
 */
const getAnalytics = asyncHandler(async (req, res) => {
    const { period = 'daily' } = req.query;

    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);
    const shops = await Shop.find({ isActive: true });

    let analyticsData = [];

    // Aggregate data from all shops
    for (const shop of shops) {
        try {
            const shopConn = await getShopConnection(shop.dbName);
            const Transaction = shopConn.model('Transaction', transactionSchema);

            if (period === 'daily') {
                // Last 30 days
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const dailyData = await Transaction.aggregate([
                    { $match: { soldAt: { $gte: thirtyDaysAgo } } },
                    {
                        $group: {
                            _id: { $dateToString: { format: '%Y-%m-%d', date: '$soldAt' } },
                            total: { $sum: '$totalPrice' },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ]);

                analyticsData = analyticsData.concat(
                    dailyData.map(d => ({ ...d, shopName: shop.name }))
                );
            } else if (period === 'monthly') {
                // Last 12 months
                const twelveMonthsAgo = new Date();
                twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

                const monthlyData = await Transaction.aggregate([
                    { $match: { soldAt: { $gte: twelveMonthsAgo } } },
                    {
                        $group: {
                            _id: { $dateToString: { format: '%Y-%m', date: '$soldAt' } },
                            total: { $sum: '$totalPrice' },
                            count: { $sum: 1 },
                        },
                    },
                    { $sort: { _id: 1 } },
                ]);

                analyticsData = analyticsData.concat(
                    monthlyData.map(d => ({ ...d, shopName: shop.name }))
                );
            }
        } catch (error) {
            console.error(`Error getting analytics for shop ${shop.name}:`, error.message);
        }
    }

    // Aggregate by date across all shops
    const aggregatedData = {};
    analyticsData.forEach(item => {
        if (!aggregatedData[item._id]) {
            aggregatedData[item._id] = { date: item._id, total: 0, count: 0 };
        }
        aggregatedData[item._id].total += item.total;
        aggregatedData[item._id].count += item.count;
    });

    const result = Object.values(aggregatedData).sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    res.json({
        success: true,
        period,
        data: result,
    });
});

/**
 * Get all session reports with filters
 * GET /api/admin/reports
 */
const getReports = asyncHandler(async (req, res) => {
    const { shopId, from, to, shopkeeperId } = req.query;

    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);

    let shops = [];

    if (shopId) {
        const shop = await Shop.findById(shopId);
        if (shop) shops = [shop];
    } else {
        shops = await Shop.find({ isActive: true });
    }

    let allReports = [];

    for (const shop of shops) {
        try {
            const shopConn = await getShopConnection(shop.dbName);
            const SessionReport = shopConn.model('SessionReport', sessionReportSchema);

            const query = {};

            if (shopkeeperId) {
                query.shopkeeperId = shopkeeperId;
            }

            if (from || to) {
                query.startTime = {};
                if (from) query.startTime.$gte = new Date(from);
                if (to) query.startTime.$lte = new Date(to);
            }

            const reports = await SessionReport
                .find(query)
                .sort({ startTime: -1 })
                .limit(100);

            allReports = allReports.concat(
                reports.map(r => ({
                    ...r.toObject(),
                    shopName: shop.name,
                    shopId: shop._id,
                }))
            );
        } catch (error) {
            console.error(`Error getting reports for shop ${shop.name}:`, error.message);
        }
    }

    res.json({
        success: true,
        count: allReports.length,
        reports: allReports,
    });
});

/**
 * Download report as CSV or PDF
 * GET /api/admin/reports/:reportId/download
 */
const downloadReport = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { format = 'csv', shopDbName } = req.query;

    if (!shopDbName) {
        return res.status(400).json({
            success: false,
            message: 'Shop database name is required',
        });
    }

    const shopConn = await getShopConnection(shopDbName);
    const SessionReport = shopConn.model('SessionReport', sessionReportSchema);

    const report = await SessionReport.findById(reportId);

    if (!report) {
        return res.status(404).json({
            success: false,
            message: 'Report not found',
        });
    }

    if (format === 'csv') {
        const csvData = await generateCSVReport(report);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=report-${reportId}.csv`);
        res.send(csvData);
    } else if (format === 'pdf') {
        const pdfBuffer = await generatePDFReport(report);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${reportId}.pdf`);
        res.send(pdfBuffer);
    } else {
        res.status(400).json({
            success: false,
            message: 'Invalid format. Use csv or pdf',
        });
    }
});

// Cache for product autofill (last 2 products per admin)
const recentProductsCache = new Map();

/**
 * Get recent products for autofill
 * GET /api/admin/recent-products
 */
const getRecentProducts = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const recent = recentProductsCache.get(adminId) || [];

    res.json({
        success: true,
        products: recent,
    });
});

/**
 * Save product to recent (for autofill)
 * POST /api/admin/recent-products
 */
const saveRecentProduct = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const productData = req.body;

    let recent = recentProductsCache.get(adminId) || [];
    recent.unshift(productData);
    recent = recent.slice(0, 2); // Keep only last 2

    recentProductsCache.set(adminId, recent);

    res.json({
        success: true,
        message: 'Product saved to recent',
    });
});

/**
 * Download sales report for a specific shop and date range
 * GET /api/admin/shops/:shopId/sales-report
 */
const downloadSalesReport = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const { from, to, format = 'csv', shopkeeper = 'all' } = req.query;

    if (!from || !to) {
        return res.status(400).json({
            success: false,
            message: 'Both "from" and "to" dates are required',
        });
    }

    // Get shop info
    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shop.dbName);
    const Transaction = shopConn.model('Transaction', transactionSchema);
    const Product = shopConn.model('Product', productSchema);

    // Build date filter
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Build query with optional shopkeeper filter
    const query = {
        soldAt: { $gte: fromDate, $lte: toDate }
    };

    // Filter by shopkeeper if not 'all'
    // Look up shopkeeper by username to get their ID
    if (shopkeeper !== 'all') {
        const Shopkeeper = shopConn.model('Shopkeeper', require('../models/Shopkeeper'));
        const shopkeeperDoc = await Shopkeeper.findOne({ username: shopkeeper });
        if (shopkeeperDoc) {
            query.soldByShopkeeperId = shopkeeperDoc._id;
        } else {
            // Fallback to matching by soldBy string (for newer transactions)
            query.soldBy = shopkeeper;
        }
    }

    // Get all transactions in date range (filtered by shopkeeper if specified)
    const transactions = await Transaction.find(query).sort({ soldAt: 1 });

    // Get Shopkeeper model for looking up names
    const Shopkeeper = shopConn.model('Shopkeeper', require('../models/Shopkeeper'));

    // Get product details for each transaction
    const enrichedTransactions = await Promise.all(
        transactions.map(async (tx) => {
            const product = await Product.findById(tx.productId);

            // Get shopkeeper name - try soldBy field first, then lookup by ID
            let soldByName = tx.soldBy;
            if (!soldByName || soldByName === 'Unknown') {
                const shopkeeperDoc = await Shopkeeper.findById(tx.soldByShopkeeperId);
                soldByName = shopkeeperDoc?.username || 'Unknown';
            }

            return {
                date: tx.soldAt.toISOString().split('T')[0],
                time: tx.soldAt.toTimeString().split(' ')[0],
                productName: product?.name || 'Unknown Product',
                brand: product?.brand || '-',
                category: product?.category || '-',
                quantity: tx.qty,
                costPrice: product?.costPrice || 0,
                unitPrice: tx.pricePerUnit,
                totalPrice: tx.totalPrice,
                soldBy: soldByName,
            };
        })
    );

    // Calculate summary
    const totalSales = enrichedTransactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
    const totalItems = enrichedTransactions.reduce((sum, tx) => sum + tx.quantity, 0);
    const totalTransactions = enrichedTransactions.length;

    if (format === 'excel' || format === 'xlsx' || format === 'csv') {
        // Generate Excel file with proper column widths
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'VapeShop Admin';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Sales Report');

        // Define columns with proper widths
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 12 },
            { header: 'Product', key: 'product', width: 30 },
            { header: 'Brand', key: 'brand', width: 20 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'Cost Price', key: 'costPrice', width: 15 },
            { header: 'Sell Price', key: 'unitPrice', width: 15 },
            { header: 'Total Price', key: 'totalPrice', width: 15 },
            { header: 'Sold By', key: 'soldBy', width: 20 },
        ];

        // Style the header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F46E5' }
        };
        worksheet.getRow(1).alignment = { horizontal: 'center' };

        // Add data rows
        enrichedTransactions.forEach(tx => {
            worksheet.addRow({
                date: tx.date,
                time: tx.time,
                product: tx.productName,
                brand: tx.brand,
                category: tx.category,
                quantity: tx.quantity,
                costPrice: tx.costPrice,
                unitPrice: tx.unitPrice,
                totalPrice: tx.totalPrice,
                soldBy: tx.soldBy,
            });
        });

        // Add empty row before summary
        worksheet.addRow([]);
        worksheet.addRow([]);

        // Add summary section
        const summaryStartRow = worksheet.rowCount + 1;
        worksheet.addRow(['SUMMARY']);
        worksheet.getRow(summaryStartRow).font = { bold: true, size: 14 };

        worksheet.addRow(['Shop Name', shop.name]);
        worksheet.addRow(['Report Period', `${from} to ${to}`]);
        worksheet.addRow(['Total Transactions', totalTransactions]);
        worksheet.addRow(['Total Items Sold', totalItems]);
        worksheet.addRow(['Total Sales', `Rs ${totalSales.toFixed(0)}`]);

        // Format currency columns
        worksheet.getColumn('costPrice').numFmt = '#,##0';
        worksheet.getColumn('unitPrice').numFmt = '#,##0';
        worksheet.getColumn('totalPrice').numFmt = '#,##0';

        const filename = `${shop.name.replace(/\s+/g, '_')}_sales_${from}_to_${to}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await workbook.xlsx.write(res);
        res.end();
    } else if (format === 'json') {
        // Return JSON for preview
        res.json({
            success: true,
            shop: {
                name: shop.name,
                id: shop._id,
            },
            period: { from, to },
            summary: {
                totalTransactions,
                totalItems,
                totalSales,
            },
            transactions: enrichedTransactions,
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'Invalid format. Use excel, xlsx, csv, or json',
        });
    }
});
/**
 * Get all session reports for a shop
 * GET /api/admin/shops/:shopId/session-reports
 */
const getSessionReports = asyncHandler(async (req, res) => {
    const { shopId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Get shop info
    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shop.dbName);
    const SessionReport = shopConn.model('SessionReport', sessionReportSchema);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, totalCount] = await Promise.all([
        SessionReport.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        SessionReport.countDocuments(),
    ]);

    res.json({
        success: true,
        shop: {
            id: shop._id,
            name: shop.name,
        },
        reports,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalCount,
            totalPages: Math.ceil(totalCount / parseInt(limit)),
        },
    });
});

/**
 * Get a single session report details
 * GET /api/admin/shops/:shopId/session-reports/:reportId
 */
const getSessionReportDetails = asyncHandler(async (req, res) => {
    const { shopId, reportId } = req.params;

    // Get shop info
    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shop.dbName);
    const SessionReport = shopConn.model('SessionReport', sessionReportSchema);

    const report = await SessionReport.findById(reportId);

    if (!report) {
        return res.status(404).json({
            success: false,
            message: 'Session report not found',
        });
    }

    // Calculate session duration
    const durationMs = new Date(report.endTime) - new Date(report.startTime);
    const durationMinutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    res.json({
        success: true,
        report: {
            ...report.toObject(),
            duration: `${hours}h ${minutes}m`,
        },
    });
});

/**
 * Delete a session report
 * DELETE /api/admin/shops/:shopId/session-reports/:reportId
 */
const deleteSessionReport = asyncHandler(async (req, res) => {
    const { shopId, reportId } = req.params;

    // Get shop info
    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shop.dbName);
    const SessionReport = shopConn.model('SessionReport', sessionReportSchema);

    const report = await SessionReport.findById(reportId);

    if (!report) {
        return res.status(404).json({
            success: false,
            message: 'Session report not found',
        });
    }

    await SessionReport.findByIdAndDelete(reportId);

    res.json({
        success: true,
        message: 'Session report deleted successfully',
    });
});

/**
 * Update session reconciliation (cash submitted)
 * PUT /api/admin/shops/:shopId/session-reports/:reportId/reconcile
 * Admin can update this anytime
 */
const updateSessionReconciliation = asyncHandler(async (req, res) => {
    const { shopId, reportId } = req.params;
    const { cashSubmitted } = req.body;

    if (cashSubmitted === undefined || cashSubmitted === null) {
        return res.status(400).json({
            success: false,
            message: 'Cash submitted amount is required',
        });
    }

    // Get shop info
    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);
    const shop = await Shop.findById(shopId);

    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shop.dbName);
    const SessionReport = shopConn.model('SessionReport', sessionReportSchema);

    const report = await SessionReport.findById(reportId);

    if (!report) {
        return res.status(404).json({
            success: false,
            message: 'Session report not found',
        });
    }

    // Calculate remaining balance
    const cashAmount = parseFloat(cashSubmitted) || 0;
    const remainingBalance = report.totalAmount - cashAmount;

    // Update the report
    report.cashSubmitted = cashAmount;
    report.remainingBalance = remainingBalance;
    report.isReconciled = true;
    report.reconciledAt = new Date();

    await report.save();

    res.json({
        success: true,
        message: 'Session reconciliation updated successfully',
        report: {
            _id: report._id,
            shopkeeperUsername: report.shopkeeperUsername,
            totalAmount: report.totalAmount,
            cashSubmitted: report.cashSubmitted,
            remainingBalance: report.remainingBalance,
            isReconciled: report.isReconciled,
            reconciledAt: report.reconciledAt,
        },
    });
});

/**
 * Delete a shop and all its data
 * DELETE /api/admin/shops/:shopId
 */
const deleteShop = asyncHandler(async (req, res) => {
    const { shopId } = req.params;

    const adminConn = await connectAdminDB();
    const Shop = adminConn.model('Shop', shopSchema);

    const shop = await Shop.findById(shopId);
    if (!shop) {
        return res.status(404).json({
            success: false,
            message: 'Shop not found',
        });
    }

    try {
        // Get shop database connection and drop it
        const shopConn = await getShopConnection(shop.dbName);

        // Drop the entire shop database
        await shopConn.dropDatabase();

        // Delete the shop record from admin database
        await Shop.findByIdAndDelete(shopId);

        res.json({
            success: true,
            message: `Shop "${shop.name}" and all its data deleted successfully`,
        });
    } catch (error) {
        console.error('Error deleting shop:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete shop database',
        });
    }
});

module.exports = {
    getAllShops,
    createShop,
    deleteShop,
    getAnalytics,
    getReports,
    downloadReport,
    getRecentProducts,
    saveRecentProduct,
    downloadSalesReport,
    getSessionReports,
    getSessionReportDetails,
    deleteSessionReport,
    updateSessionReconciliation,
};
