const express = require('express');
const router = express.Router();
const { extractVoiceData } = require('../controllers/voiceOnboardingController');
const { protect } = require('../middleware/auth');

// POST /api/onboarding/extract - Extract structured data from voice transcript
router.post('/extract', protect, extractVoiceData);

module.exports = router;
