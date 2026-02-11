const Inventory = require('../models/Inventory');

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private
exports.getInventory = async (req, res, next) => {
    try {
        const items = await Inventory.find({ businessId: req.businessId })
            .sort({ name: 1 });

        res.json({ success: true, data: items, count: items.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Add new inventory item
// @route   POST /api/inventory
// @access  Private
exports.addItem = async (req, res, next) => {
    try {
        const { name, category, stock, unit, threshold } = req.body;

        const item = await Inventory.create({
            businessId: req.businessId,
            name,
            category,
            stock,
            unit,
            threshold
        });

        res.status(201).json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};

// @desc    Update inventory item details
// @route   PUT /api/inventory/:id
// @access  Private
exports.updateItem = async (req, res, next) => {
    try {
        let item = await Inventory.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private
exports.deleteItem = async (req, res, next) => {
    try {
        const item = await Inventory.findOneAndDelete({
            _id: req.params.id,
            businessId: req.businessId
        });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        res.json({ success: true, message: 'Item removed' });
    } catch (error) {
        next(error);
    }
};

// @desc    Restock item (update stock level)
// @route   PUT /api/inventory/:id/restock
// @access  Private
exports.restockItem = async (req, res, next) => {
    try {
        const { quantity, action } = req.body; // action: 'add', 'set', 'subtract'

        let item = await Inventory.findOne({
            _id: req.params.id,
            businessId: req.businessId
        });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        let newStock = item.stock;
        const qty = parseInt(quantity, 10) || 0;

        if (action === 'set') {
            newStock = qty;
        } else if (action === 'subtract') {
            newStock = Math.max(0, item.stock - qty);
        } else {
            // Default to add
            newStock = item.stock + qty;
        }

        item.stock = newStock;
        await item.save();

        res.json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};
