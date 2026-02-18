require('dotenv').config();
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';

async function testGemini() {
  console.log('🧪 Testing Gemini 1.5 Flash Latest API...\n');
  
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('✓ API Key found:', GEMINI_API_KEY.substring(0, 10) + '...\n');

  const testPrompt = `You are helping with a business onboarding flow. 

The user said (transcribed speech):
"My business is called Veltro Salon, we're a hair salon in the beauty industry, and we provide professional haircuts and styling services"

Your job:
Extract the business information from the user's speech.
    - name: business name
    - customCategory: industry or category (e.g. "salon", "consulting", "restaurant")
    - description: brief description of what the business does
    - phone: phone number if mentioned (format as string, null if not mentioned)
    - email: business email if mentioned (null if not mentioned)
    - website: website URL if mentioned (null if not mentioned)

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown, no explanation, no backticks, no code fences
- Use null for any field that wasn't clearly mentioned
- Be lenient with speech-to-text errors
- Fix obvious errors (e.g. "at gmail dot com" → "@gmail.com")
- For phone numbers, preserve the format the user said
- For times, always use 24-hour format "HH:MM"
- The JSON keys must match exactly: name, customCategory, description, phone, email, website

Return JSON only.`;

  try {
    console.log('📤 Sending request to Gemini API...\n');
    
    const response = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: testPrompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ API Response received!\n');
    console.log('Status:', response.status);
    console.log('\nRaw response:');
    console.log(JSON.stringify(response.data, null, 2));

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('\n📝 Extracted text:');
    console.log(rawText);

    // Try to parse as JSON
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    console.log('\n✅ Successfully parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
    
    console.log('\n🎉 Test PASSED! Gemini 1.5 Flash Latest is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test FAILED!');
    
    if (error.response) {
      console.error('\nAPI Error Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('\nNo response received from API');
      console.error('Error:', error.message);
    } else {
      console.error('\nError:', error.message);
    }
    
    process.exit(1);
  }
}

testGemini();
