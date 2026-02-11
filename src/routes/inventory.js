const express = require('express');
const router = express.Router();
const { protect, setBusinessContext, authorizeStaff } = require('../middleware/auth');
const {
    getInventory,
    addItem,
    updateItem,
    deleteItem,
    restockItem
} = require('../controllers/inventoryController');

router.use(protect);
router.use(setBusinessContext);
router.use(authorizeStaff('canManageInventory'));

router.route('/')
    .get(getInventory)
    .post(addItem);

router.route('/:id')
    .put(updateItem)
    .delete(deleteItem);

router.put('/:id/restock', restockItem);

module.exports = router;
