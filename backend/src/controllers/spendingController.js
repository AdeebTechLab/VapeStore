const { getShopConnection } = require('../config/database');
const spendingSchema = require('../models/Spending');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Add spending during session
 * POST /api/shop/:shopDbName/spending
 */
const addSpending = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const { reason, amount } = req.body;
    const sessionId = req.user.sessionId;

    if (!reason || !amount) {
        return res.status(400).json({
            success: false,
            message: 'Reason and amount are required',
        });
    }

    if (amount <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Amount must be greater than 0',
        });
    }

    // Connect to shop database
    const shopConn = await getShopConnection(shopDbName);
    const Spending = shopConn.model('Spending', spendingSchema);

    const spending = new Spending({
        sessionId,
        shopkeeperId: req.user.id,
        shopkeeperUsername: req.user.username,
        reason: reason.trim(),
        amount: Math.round(parseFloat(amount) || 0),
    });

    await spending.save();

    res.status(201).json({
        success: true,
        message: 'Spending recorded successfully',
        spending,
    });
});

/**
 * Get spending for current session
 * GET /api/shop/:shopDbName/spending
 */
const getSessionSpending = asyncHandler(async (req, res) => {
    const { shopDbName } = req.params;
    const sessionId = req.user.sessionId;

    // Connect to shop database
    const shopConn = await getShopConnection(shopDbName);
    const Spending = shopConn.model('Spending', spendingSchema);

    const spendings = await Spending.find({ sessionId }).sort({ createdAt: -1 });
    const totalSpending = spendings.reduce((sum, s) => sum + s.amount, 0);

    res.json({
        success: true,
        count: spendings.length,
        totalSpending,
        spendings,
    });
});

module.exports = {
    addSpending,
    getSessionSpending,
};
