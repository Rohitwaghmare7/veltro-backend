const express = require('express');
const router = express.Router();
const { updateStep, getProgress, completeOnboarding } = require('../controllers/onboardingController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(protect); // All onboarding routes are protected

router.put('/step/:stepNum', authorize('owner'), updateStep);
router.get('/progress', getProgress);
router.post('/complete', authorize('owner'), completeOnboarding);

module.exports = router;
