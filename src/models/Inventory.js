const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Please add an item name'],
            trim: true,
        },
        category: {
            type: String,
            default: 'General',
            trim: true,
        },
        stock: {
            type: Number,
            default: 0,
            min: 0,
        },
        unit: {
            type: String,
            default: 'Units',
            trim: true,
        },
        threshold: {
            type: Number,
            default: 5,
            min: 0,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Inventory', inventorySchema);
