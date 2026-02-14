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
        const { name, category, stock, unit, threshold, vendorEmail } = req.body;

        const item = await Inventory.create({
            businessId: req.businessId,
            name,
            category: category || 'General',
            stock,
            unit,
            threshold,
            vendorEmail,
            lastRestocked: new Date(), // Set initial restock date
            quantity: stock, // Sync quantity with stock
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
        const { fireAutomation, TRIGGERS } = require('../services/automation.service');
        const { createNotification } = require('./notificationController');
        const Business = require('../models/Business');
        const User = require('../models/User');

        let item = await Inventory.findOne({
            _id: req.params.id,
            businessId: req.businessId,
        });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Check if quantity is being updated
        const oldQuantity = item.quantity || item.stock || 0;
        const newQuantity = req.body.quantity !== undefined ? req.body.quantity : req.body.stock;

        // Update item
        Object.assign(item, req.body);
        
        // If quantity field exists in update, sync with stock
        if (req.body.quantity !== undefined) {
            item.stock = req.body.quantity;
        }
        if (req.body.stock !== undefined) {
            item.quantity = req.body.stock;
        }

        await item.save();

        // Check if we hit the threshold exactly (alert fires AT threshold, not below)
        const threshold = item.threshold || 0;
        const currentQty = item.quantity || item.stock || 0;

        if (currentQty === threshold && oldQuantity > threshold && !item.alertSent) {
            // Fire inventory alert
            const business = await Business.findById(req.businessId);
            const owner = await User.findOne({ businessId: req.businessId, role: 'owner' });

            if (business && owner && owner.email) {
                await fireAutomation(TRIGGERS.INVENTORY_LOW, {
                    businessId: req.businessId,
                    item,
                    business,
                    ownerEmail: owner.email,
                });
                
                // Create notification for low stock
                try {
                    await createNotification(req.businessId, business.owner, {
                        type: 'system',
                        title: 'Low Stock Alert',
                        message: `${item.name} is running low (${currentQty} ${item.unit} remaining)`,
                        link: '/dashboard/inventory',
                        metadata: { inventoryId: item._id }
                    });
                } catch (notifError) {
                    console.error('Failed to create notification:', notifError);
                }
                
                // Mark alert as sent
                item.alertSent = true;
                await item.save();
            }
        }

        // Reset alertSent if quantity goes back above threshold
        if (currentQty > threshold && item.alertSent) {
            item.alertSent = false;
            await item.save();
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

        const oldStock = item.stock;
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
        item.quantity = newStock; // Sync quantity
        
        // Update lastRestocked if stock increased
        if (newStock > oldStock) {
            item.lastRestocked = new Date();
            item.alertSent = false; // Reset alert when restocked
        }

        await item.save();

        res.json({ success: true, data: item });
    } catch (error) {
        next(error);
    }
};
