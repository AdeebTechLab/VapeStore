const mongoose = require('mongoose');

const spendingSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
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
        reason: {
            type: String,
            required: true,
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = spendingSchema;
