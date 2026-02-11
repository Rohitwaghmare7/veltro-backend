const express = require('express');
const router = express.Router();
const { protect, setBusinessContext } = require('../middleware/auth');
const {
    getStaff,
    inviteStaff,
    updateStaff,
    removeStaff,
    acceptInvite,
    getStaffMe,
    getMyBusinesses,
    getInviteInfo
} = require('../controllers/staffController');

// Public route for fetching invite info (for registration pre-fill)
router.get('/invite/info/:token', getInviteInfo);

router.use(protect);

router.get('/businesses', getMyBusinesses);
router.post('/accept/:token', acceptInvite);

router.use(setBusinessContext);

router.get('/me', getStaffMe);

// Sub-routes below require more than just "being in the business"
// For now, only owners can manage the team
const authorizeOwner = (req, res, next) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: 'Forbidden — Owner access required' });
    }
    next();
};

router.use(authorizeOwner);

router.route('/')
    .get(getStaff)
    .post(inviteStaff);

router.route('/:id')
    .put(updateStaff)
    .delete(removeStaff);

module.exports = router;
