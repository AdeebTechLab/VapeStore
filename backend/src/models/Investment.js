const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
    // Type of investment: 'product_add', 'restock', 'adjustment', 'deduction'
    type: {
        type: String,
        enum: ['product_add', 'restock', 'adjustment', 'deduction'],
        required: true,
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    },
    productName: {
        type: String,
        required: true,
    },
    // Number of units added
    units: {
        type: Number,
        required: true,
    },
    // Cost price per unit at time of investment
    costPrice: {
        type: Number,
        required: true,
    },
    // Total investment amount (units * costPrice)
    totalAmount: {
        type: Number,
        required: true,
    },
    // Who made this investment entry
    createdBy: {
        type: String,
        default: 'Admin',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // Optional note
    note: {
        type: String,
        default: '',
    },
});

// Indexes for efficient queries
investmentSchema.index({ createdAt: -1 });
investmentSchema.index({ productId: 1 });
investmentSchema.index({ type: 1 });

module.exports = investmentSchema;
