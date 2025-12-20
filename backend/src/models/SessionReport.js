const mongoose = require('mongoose');

const sessionReportSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    shopkeeperId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shopkeeper',
        required: true,
    },
    shopkeeperUsername: {
        type: String,
        required: true,
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
        required: true,
    },
    soldItems: [{
        productId: mongoose.Schema.Types.ObjectId,
        productName: String,
        qty: Number,
        pricePerUnit: Number,
        totalPrice: Number,
    }],
    totalAmount: {
        type: Number,
        required: true,
        default: 0,
    },
    totalItemsSold: {
        type: Number,
        default: 0,
    },
    // Cash reconciliation fields
    cashSubmitted: {
        type: Number,
        default: 0,
    },
    remainingBalance: {
        type: Number,
        default: 0,
    },
    isReconciled: {
        type: Boolean,
        default: false,
    },
    reconciledAt: {
        type: Date,
        default: null,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Index for queries
sessionReportSchema.index({ shopkeeperId: 1, createdAt: -1 });
sessionReportSchema.index({ startTime: -1 });

module.exports = sessionReportSchema;
