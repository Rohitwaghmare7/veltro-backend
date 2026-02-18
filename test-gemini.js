require('dotenv').config();
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

async function testGemini() {
  console.log('🧪 Testing Gemini API...\n');

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log('✓ API Key found:', GEMINI_API_KEY.substring(0, 10) + '...');
  console.log('✓ API URL:', GEMINI_URL);
  console.log('\n📤 Sending test request...\n');

  try {
    const response = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ 
            text: 'Extract the business name from this text: "My business is called Veltro Salon". Return only JSON: {"name": "extracted name"}' 
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    console.log('✅ Gemini API is working!\n');
    console.log('📥 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('\n📝 Extracted text:');
    console.log(rawText);

    // Try to parse JSON
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      console.log('\n✅ Successfully parsed JSON:');
      console.log(parsed);
    } catch (e) {
      console.log('\n⚠️  Could not parse as JSON, but API is working');
    }

    console.log('\n✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Gemini API test failed!\n');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check your API key is valid at https://aistudio.google.com');
    console.log('2. Make sure the API key has access to Gemini models');
    console.log('3. Check if you have exceeded the free tier quota');
    console.log('4. Try generating a new API key');
    
    process.exit(1);
  }
}

testGemini();
