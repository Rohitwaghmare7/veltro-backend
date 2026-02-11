const express = require('express');
const router = express.Router();
const { protect, setBusinessContext, authorizeStaff } = require('../middleware/auth');
const { getLeads, createLead, updateLead, updateLeadStatus, deleteLead } = require('../controllers/leadController');

router.use(protect);
router.use(setBusinessContext);

router.route('/')
    .get(authorizeStaff('canViewLeads'), getLeads)
    .post(authorizeStaff('canEditLeads'), createLead);

router.patch('/:id', authorizeStaff('canEditLeads'), updateLead);
router.patch('/:id/status', authorizeStaff('canEditLeads'), updateLeadStatus);
router.delete('/:id', authorizeStaff('canEditLeads'), deleteLead);

module.exports = router;
