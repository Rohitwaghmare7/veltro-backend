const express = require('express');
const router = express.Router();
const { protect, setBusinessContext } = require('../middleware/auth');
const {
    getStaff,
    inviteStaff,
    updateStaff,
    removeStaff,
    deactivateStaff,
    reactivateStaff,
    acceptInvite,
    getStaffMe,
    getMyBusinesses,
    getInviteInfo,
    resendInvite
} = require('../controllers/staffController');

// Public route for fetching invite info (for registration pre-fill)
router.get('/invite/info/:token', getInviteInfo);

// Public route for accepting invite (no auth required)
router.post('/accept/:token', acceptInvite);

router.use(protect);

router.get('/businesses', getMyBusinesses);

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

router.put('/:id/deactivate', deactivateStaff);
router.put('/:id/reactivate', reactivateStaff);
router.post('/:id/resend-invite', resendInvite);

module.exports = router;
