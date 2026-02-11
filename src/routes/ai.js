const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// Configure multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    },
});

// All routes require authentication
router.use(protect);

// POST /api/ai/transcribe - Transcribe audio file
router.post('/transcribe', upload.single('audio'), aiController.transcribeAudio);

// POST /api/ai/extract-fields - Extract fields from text
router.post('/extract-fields', aiController.extractFields);

// POST /api/ai/generate-email - Generate welcome email
router.post('/generate-email', aiController.generateEmail);

// POST /api/ai/summarize/:conversationId - Summarize conversation
router.post('/summarize/:conversationId', aiController.summarizeConversation);

// POST /api/ai/generate-response - Generate AI response
router.post('/generate-response', aiController.generateResponse);

// POST /api/ai/sentiment - Analyze sentiment
router.post('/sentiment', aiController.analyzeSentiment);

module.exports = router;
