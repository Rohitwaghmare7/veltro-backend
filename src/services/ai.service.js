const { HfInference } = require('@huggingface/inference');
const { Ollama } = require('ollama');

// Determine which AI provider to use
const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama'; // 'ollama' or 'huggingface'

// Initialize clients
const hf = process.env.HUGGINGFACE_API_KEY ? new HfInference(process.env.HUGGINGFACE_API_KEY) : null;
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

// Default model configurations
const MODELS = {
    ollama: {
        llm: process.env.OLLAMA_MODEL || 'mistral',
        whisper: 'whisper', // If available locally
    },
    huggingface: {
        whisper: 'openai/whisper-large-v3',
        llm: 'google/flan-t5-base', // Free tier compatible model
        summarization: 'facebook/bart-large-cnn',
        sentiment: 'distilbert-base-uncased-finetuned-sst-2-english',
    },
};

/**
 * Transcribe audio using Whisper AI (Ollama or Hugging Face)
 * @param {Buffer} audioBuffer - Audio file buffer
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioBuffer) {
    try {
        if (AI_PROVIDER === 'ollama') {
            // Note: Whisper transcription with Ollama requires whisper model
            // For now, return a placeholder - user needs to set up whisper locally
            // or use a separate whisper service
            throw new Error('Whisper transcription via Ollama requires separate setup. Please use Hugging Face or set up local Whisper service.');
        } else {
            // Use Hugging Face
            if (!hf) {
                throw new Error('Hugging Face API key not configured');
            }
            
            const result = await hf.automaticSpeechRecognition({
                data: audioBuffer,
                model: MODELS.huggingface.whisper,
            });
            
            return result.text;
        }
    } catch (error) {
        console.error('Audio transcription error:', error);
        throw new Error(error.message || 'Failed to transcribe audio');
    }
}

/**
 * Extract structured data from text using LLM (Ollama or Hugging Face)
 * @param {string} text - Input text to parse
 * @returns {Promise<Object>} - Extracted structured data
 */
async function extractFieldsFromText(text) {
    try {
        if (AI_PROVIDER === 'ollama') {
            const prompt = `Extract the following information from the text and return ONLY valid JSON (no explanation):
{
  "businessName": "name of the business",
  "industry": "industry or business type",
  "email": "email address",
  "phone": "phone number",
  "address": "physical address",
  "services": ["list", "of", "services"],
  "workingHours": "working hours information"
}

Text: "${text}"

JSON:`;

            const response = await ollama.generate({
                model: MODELS.ollama.llm,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 500,
                },
            });
            
            const result = response.response;
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } else {
            // Use simple regex extraction for Hugging Face free tier
            const extracted = {
                businessName: null,
                industry: null,
                email: null,
                phone: null,
                address: null,
                services: [],
                workingHours: null,
            };

            // Extract email
            const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) extracted.email = emailMatch[0];

            // Extract phone
            const phoneMatch = text.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phoneMatch) extracted.phone = phoneMatch[0];

            // Extract business name (look for "called", "named", "is")
            const nameMatch = text.match(/(?:called|named|is)\s+([A-Z][A-Za-z\s&]+?)(?:\.|,|We|Our|The)/);
            if (nameMatch) extracted.businessName = nameMatch[1].trim();

            // Extract industry
            const industryMatch = text.match(/(?:in the|industry|business)\s+([a-z\s]+?)(?:\s+industry|business|\.|,)/i);
            if (industryMatch) extracted.industry = industryMatch[1].trim();

            return extracted;
        }

        return {};
    } catch (error) {
        console.error('Field extraction error:', error);
        throw new Error('Failed to extract fields from text');
    }
}

/**
 * Generate personalized welcome email (Ollama or Hugging Face)
 * @param {Object} data - Business and contact data
 * @returns {Promise<string>} - Generated email content
 */
async function generateWelcomeEmail(data) {
    try {
        const { businessName, contactName, industry, services } = data;
        
        if (AI_PROVIDER === 'ollama') {
            const prompt = `Write a warm, professional welcome email for a new customer.

Business: ${businessName}
Customer: ${contactName}
Industry: ${industry}
Services: ${services?.join(', ') || 'various services'}

The email should:
- Welcome the customer warmly
- Briefly introduce the business
- Mention relevant services
- Encourage them to reach out with questions
- Be concise (3-4 paragraphs)
- Have a professional but friendly tone

Write only the email body without subject line:`;

            const response = await ollama.generate({
                model: MODELS.ollama.llm,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: 400,
                },
            });
            
            return response.response.trim();
        } else {
            // Use template for Hugging Face free tier
            const servicesList = services && services.length > 0 
                ? services.join(', ') 
                : 'quality services';

            return `Dear ${contactName},

Welcome to ${businessName}! We're thrilled to have you join our community.

As a trusted provider in the ${industry} industry, we specialize in ${servicesList} designed to meet your unique needs. Our dedicated team is committed to delivering exceptional service and ensuring your complete satisfaction.

We're here to support you every step of the way. Whether you have questions about our services, need assistance, or would like to learn more about how we can help you, please don't hesitate to reach out.

We look forward to working with you!

Best regards,
The ${businessName} Team`;
        }
    } catch (error) {
        console.error('Email generation error:', error);
        throw new Error('Failed to generate welcome email');
    }
}

/**
 * Summarize conversation for owner view (Ollama or Hugging Face)
 * @param {Array} messages - Array of conversation messages
 * @returns {Promise<string>} - Conversation summary
 */
async function summarizeConversation(messages) {
    try {
        // Combine messages into conversation text
        const conversationText = messages
            .map(msg => `${msg.sender}: ${msg.content}`)
            .join('\n');

        const prompt = `Summarize the following customer conversation in 2-3 sentences. Focus on:
- Main topic or issue
- Customer needs or requests
- Current status or next steps

Conversation:
${conversationText}

Summary:`;

        let result;
        
        if (AI_PROVIDER === 'ollama') {
            // Use Ollama for summarization
            const response = await ollama.generate({
                model: MODELS.ollama.llm,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.5,
                    num_predict: 150,
                },
            });
            
            result = response.response.trim();
        } else {
            // Use Hugging Face BART for summarization
            if (!hf) {
                throw new Error('Hugging Face API key not configured');
            }
            
            try {
                const response = await hf.summarization({
                    model: MODELS.huggingface.summarization,
                    inputs: conversationText,
                    parameters: {
                        max_length: 150,
                        min_length: 40,
                    },
                });
                
                result = response.summary_text;
            } catch (summaryError) {
                // Fallback to text generation
                const response = await hf.textGeneration({
                    model: MODELS.huggingface.llm,
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 150,
                        temperature: 0.5,
                        return_full_text: false,
                    },
                });
                
                result = response.generated_text.trim();
            }
        }

        return result;
    } catch (error) {
        console.error('Conversation summary error:', error);
        throw new Error('Failed to summarize conversation');
    }
}

/**
 * Generate AI response for customer inquiry (Ollama or Hugging Face)
 * @param {string} inquiry - Customer inquiry text
 * @param {Object} context - Business context
 * @returns {Promise<string>} - AI-generated response
 */
async function generateResponse(inquiry, context = {}) {
    try {
        const { businessName, services, tone = 'professional and friendly' } = context;
        
        if (AI_PROVIDER === 'ollama') {
            const prompt = `You are a customer service representative for ${businessName || 'our business'}.
${services ? `We offer: ${services.join(', ')}` : ''}

Customer inquiry: "${inquiry}"

Write a helpful, ${tone} response that:
- Addresses their question or concern
- Is concise and clear
- Offers to help further if needed

Response:`;

            const response = await ollama.generate({
                model: MODELS.ollama.llm,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: 300,
                },
            });
            
            return response.response.trim();
        } else {
            // Use template-based response for Hugging Face free tier
            const serviceInfo = services && services.length > 0
                ? ` We offer ${services.join(', ')}.`
                : '';

            return `Thank you for reaching out to ${businessName || 'us'}!${serviceInfo}

We'd be happy to help you with your inquiry. Our team is available to answer any questions you may have and provide the information you need.

Please feel free to provide more details about what you're looking for, and we'll get back to you as soon as possible. You can also reach us directly through our contact channels for immediate assistance.

Is there anything specific I can help you with today?`;
        }
    } catch (error) {
        console.error('Response generation error:', error);
        throw new Error('Failed to generate response');
    }
}

/**
 * Analyze sentiment of text (Ollama or Hugging Face)
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} - Sentiment analysis result
 */
async function analyzeSentiment(text) {
    try {
        if (AI_PROVIDER === 'ollama') {
            // Use Ollama for sentiment analysis via prompt
            const prompt = `Analyze the sentiment of the following text. Respond with ONLY one word: POSITIVE, NEGATIVE, or NEUTRAL.

Text: "${text}"

Sentiment:`;

            const response = await ollama.generate({
                model: MODELS.ollama.llm,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    num_predict: 10,
                },
            });
            
            const sentiment = response.response.trim().toUpperCase();
            const label = sentiment.includes('POSITIVE') ? 'POSITIVE' : 
                         sentiment.includes('NEGATIVE') ? 'NEGATIVE' : 'NEUTRAL';
            
            return {
                label,
                score: 0.85, // Placeholder confidence score
            };
        } else {
            // Use Hugging Face
            if (!hf) {
                throw new Error('Hugging Face API key not configured');
            }
            
            const result = await hf.textClassification({
                model: MODELS.huggingface.sentiment,
                inputs: text,
            });

            return {
                label: result[0].label,
                score: result[0].score,
            };
        }
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        throw new Error('Failed to analyze sentiment');
    }
}

module.exports = {
    transcribeAudio,
    extractFieldsFromText,
    generateWelcomeEmail,
    summarizeConversation,
    generateResponse,
    analyzeSentiment,
};
