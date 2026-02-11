const aiService = require('../services/ai.service');
const Conversation = require('../models/Conversation');
const Business = require('../models/Business');

/**
 * Transcribe audio file
 * POST /api/ai/transcribe
 */
exports.transcribeAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No audio file provided',
            });
        }

        const transcription = await aiService.transcribeAudio(req.file.buffer);

        res.status(200).json({
            success: true,
            data: { transcription },
        });
    } catch (error) {
        console.error('Transcribe audio error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to transcribe audio',
        });
    }
};

/**
 * Extract fields from transcribed text
 * POST /api/ai/extract-fields
 */
exports.extractFields = async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Text is required',
            });
        }

        const extractedData = await aiService.extractFieldsFromText(text);

        res.status(200).json({
            success: true,
            data: extractedData,
        });
    } catch (error) {
        console.error('Extract fields error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to extract fields',
        });
    }
};

/**
 * Generate welcome email
 * POST /api/ai/generate-email
 */
exports.generateEmail = async (req, res) => {
    try {
        const { contactName, industry, services } = req.body;
        const businessId = req.businessId;

        // Get business details
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found',
            });
        }

        const emailContent = await aiService.generateWelcomeEmail({
            businessName: business.name,
            contactName,
            industry: industry || business.industry,
            services: services || business.services?.map(s => s.name),
        });

        res.status(200).json({
            success: true,
            data: { emailContent },
        });
    } catch (error) {
        console.error('Generate email error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate email',
        });
    }
};

/**
 * Summarize conversation
 * POST /api/ai/summarize/:conversationId
 */
exports.summarizeConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const businessId = req.businessId;

        // Get conversation with messages
        const conversation = await Conversation.findOne({
            _id: conversationId,
            businessId,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        if (!conversation.messages || conversation.messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No messages to summarize',
            });
        }

        const summary = await aiService.summarizeConversation(conversation.messages);

        // Optionally save summary to conversation
        conversation.summary = summary;
        await conversation.save();

        res.status(200).json({
            success: true,
            data: { summary },
        });
    } catch (error) {
        console.error('Summarize conversation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to summarize conversation',
        });
    }
};

/**
 * Generate AI response
 * POST /api/ai/generate-response
 */
exports.generateResponse = async (req, res) => {
    try {
        const { inquiry, tone } = req.body;
        const businessId = req.businessId;

        if (!inquiry) {
            return res.status(400).json({
                success: false,
                message: 'Inquiry text is required',
            });
        }

        // Get business context
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                message: 'Business not found',
            });
        }

        const response = await aiService.generateResponse(inquiry, {
            businessName: business.name,
            services: business.services?.map(s => s.name),
            tone,
        });

        res.status(200).json({
            success: true,
            data: { response },
        });
    } catch (error) {
        console.error('Generate response error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate response',
        });
    }
};

/**
 * Analyze sentiment
 * POST /api/ai/sentiment
 */
exports.analyzeSentiment = async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Text is required',
            });
        }

        const sentiment = await aiService.analyzeSentiment(text);

        res.status(200).json({
            success: true,
            data: sentiment,
        });
    } catch (error) {
        console.error('Analyze sentiment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to analyze sentiment',
        });
    }
};
