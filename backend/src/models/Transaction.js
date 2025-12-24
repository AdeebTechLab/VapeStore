const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    productName: {
        type: String,
        required: true,
    },
    qty: {
        type: Number,
        required: true,
        min: 1,
    },
    pricePerUnit: {
        type: Number,
        required: true,
    },
    totalPrice: {
        type: Number,
        required: true,
    },
    soldByShopkeeperId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shopkeeper',
        required: true,
    },
    soldBy: {
        type: String,
        required: true,
        default: 'Unknown',
    },
    sessionId: {
        type: String,
        required: true,
        index: true,
    },
    soldAt: {
        type: Date,
        default: Date.now,
    },
    // Customer Information
    customerName: {
        type: String,
        default: '',
    },
    customerPhone: {
        type: String,
        default: '',
    },
    customerEmail: {
        type: String,
        default: '',
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'EasyPaisa', 'JazzCash', 'Card', 'Bank Transfer', 'Other'],
        default: 'Cash',
    },
});

// Index for faster queries
transactionSchema.index({ soldAt: -1 });
transactionSchema.index({ sessionId: 1 });

module.exports = transactionSchema;
