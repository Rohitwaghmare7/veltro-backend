require('dotenv').config();
const axios = require('axios');

const XAI_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY; // Check both
const XAI_URL = 'https://api.x.ai/v1/chat/completions';

async function testXAI() {
  console.log('🧪 Testing xAI (Grok) API...\n');
  
  if (!XAI_API_KEY) {
    console.error('❌ XAI_API_KEY not found in .env');
    console.log('\n📝 Your .env should have:');
    console.log('   GROQ_API_KEY=xai-your_key_here');
    console.log('   (We use GROQ_API_KEY variable name for compatibility)\n');
    process.exit(1);
  }

  console.log('✓ API Key found:', XAI_API_KEY.substring(0, 15) + '...\n');

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
    console.log('📤 Sending request to xAI API...\n');
    
    const response = await axios.post(
      XAI_URL,
      {
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts structured data from speech.' },
          { role: 'user', content: testPrompt }
        ],
        temperature: 0,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${XAI_API_KEY}`
        }
      }
    );

    console.log('✅ API Response received!\n');
    console.log('Status:', response.status);
    console.log('Model:', response.data.model);
    if (response.data.usage) {
      console.log('Usage:', JSON.stringify(response.data.usage, null, 2));
    }

    const rawText = response.data?.choices?.[0]?.message?.content || '';
    console.log('\n📝 Extracted text:');
    console.log(rawText);

    // Try to parse as JSON
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    console.log('\n✅ Successfully parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
    
    console.log('\n🎉 Test PASSED! xAI (Grok) API is working correctly.');
    console.log('\n💡 Using Grok model for voice onboarding!');
    
  } catch (error) {
    console.error('\n❌ Test FAILED!');
    
    if (error.response) {
      console.error('\nAPI Error Response:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n📝 Invalid API key. Check your xAI key at: https://console.x.ai');
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

testXAI();
