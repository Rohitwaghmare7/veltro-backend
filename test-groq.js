require('dotenv').config();
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function testGroq() {
  console.log('🧪 Testing Groq API (Free Tier - 14,400 requests/day)...\n');
  
  if (!GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY not found in .env');
    console.log('\n📝 To get a free Groq API key:');
    console.log('   1. Visit: https://console.groq.com');
    console.log('   2. Sign up (no credit card required)');
    console.log('   3. Create an API key');
    console.log('   4. Add it to backend/.env as GROQ_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log('✓ API Key found:', GROQ_API_KEY.substring(0, 15) + '...\n');

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
    console.log('📤 Sending request to Groq API...\n');
    
    const response = await axios.post(
      GROQ_URL,
      {
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: testPrompt }],
        temperature: 0.1,
        max_tokens: 1024,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        }
      }
    );

    console.log('✅ API Response received!\n');
    console.log('Status:', response.status);
    console.log('Model:', response.data.model);
    console.log('Usage:', JSON.stringify(response.data.usage, null, 2));

    const rawText = response.data?.choices?.[0]?.message?.content || '';
    console.log('\n📝 Extracted text:');
    console.log(rawText);

    // Try to parse as JSON
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    console.log('\n✅ Successfully parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
    
    console.log('\n🎉 Test PASSED! Groq API is working correctly.');
    console.log('\n💡 Free tier limits:');
    console.log('   - 14,400 requests per day');
    console.log('   - 30 requests per minute');
    console.log('   - No credit card required!');
    
  } catch (error) {
    console.error('\n❌ Test FAILED!');
    
    if (error.response) {
      console.error('\nAPI Error Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n📝 Invalid API key. Get a new one at: https://console.groq.com');
      }
    } else if (error.request) {
      console.error('\nNo response received from API');
      console.error('Error:', error.message);
    } else {
      console.error('\nError:', error.message);
    }
    
    process.exit(1);
  }
}

testGroq();
