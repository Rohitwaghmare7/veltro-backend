const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Step-specific extraction instructions
const STEP_INSTRUCTIONS = {
  business_profile: `Extract the business information from the user's speech.
    - name: business name
    - customCategory: industry or category (e.g. "salon", "consulting", "restaurant")
    - description: brief description of what the business does
    - phone: phone number if mentioned (format as string, null if not mentioned)
    - email: business email if mentioned (null if not mentioned)
    - website: website URL if mentioned (null if not mentioned)`,

  services: `Extract service information. The user may mention multiple services.
    - services: array of service objects, each with:
      - name: service name
      - duration: duration in minutes (convert "1 hour" to 60, "30 minutes" to 30, etc.)
      - price: price as a number (extract just the number, no currency symbol)
      - description: brief description if mentioned (empty string if not)
    
    Example: If user says "haircut for 30 minutes at $50 and coloring for 2 hours at $120"
    Return: {
      "services": [
        { "name": "Haircut", "duration": 30, "price": 50, "description": "" },
        { "name": "Coloring", "duration": 120, "price": 120, "description": "" }
      ]
    }`,

  working_hours: `Extract working hours information.
    - workingHours: array of 7 objects (one for each day), each with:
      - day: day name in lowercase (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
      - start: start time in 24-hour format "HH:MM" (e.g. "09:00")
      - end: end time in 24-hour format "HH:MM" (e.g. "17:00")
      - isOpen: boolean (true if mentioned as open, false if mentioned as closed)
    
    Rules:
    - Convert "9am" to "09:00", "5pm" to "17:00", etc.
    - If user says "Monday to Friday 9 to 5", create 5 entries with isOpen: true
    - For days not mentioned, set isOpen: false with default times "09:00" to "17:00"
    - Always return all 7 days in order: monday, tuesday, wednesday, thursday, friday, saturday, sunday`,
};

exports.extractVoiceData = async (req, res) => {
  try {
    console.log('Voice extraction request received');
    
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'GROQ_API_KEY is not configured'
      });
    }

    const { transcript, stepId, fields } = req.body;
    console.log('Request data:', { transcript, stepId, fields });

    if (!transcript || !stepId || !fields) {
      console.error('Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transcript, stepId, fields'
      });
    }

    // Get step-specific instructions
    const stepInstructions = STEP_INSTRUCTIONS[stepId] || 
      `Extract the following fields from the user's speech: ${fields.join(', ')}.`;

    // Build the prompt
    const prompt = `You are helping with a business onboarding flow. 

The user said (transcribed speech):
"${transcript}"

Your job:
${stepInstructions}

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown, no explanation, no backticks, no code fences
- Use null for any field that wasn't clearly mentioned
- Be lenient with speech-to-text errors
- Fix obvious errors (e.g. "at gmail dot com" → "@gmail.com")
- For phone numbers, preserve the format the user said
- For times, always use 24-hour format "HH:MM"
- The JSON keys must match exactly: ${fields.join(', ')}

Return JSON only.`;

    console.log('Calling Groq API...');
    
    // Call Groq API
    const groqResponse = await axios.post(
      GROQ_URL,
      {
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
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

    console.log('Groq API response received');
    console.log('Response status:', groqResponse.status);

    // Extract the text content from Groq's response
    const rawText = groqResponse.data?.choices?.[0]?.message?.content || '';

    // Clean up and parse JSON
    const cleaned = rawText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let extracted;
    try {
      extracted = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Failed to parse Groq response:', rawText);
      return res.status(422).json({
        success: false,
        error: 'Could not parse structured data from response',
        raw: rawText
      });
    }

    res.json({
      success: true,
      data: {
        extracted,
        transcript
      }
    });

  } catch (error) {
    console.error('Voice extraction error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to extract voice data',
      message: error.message
    });
  }
};
