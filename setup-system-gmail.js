/**
 * Setup script to connect system Gmail account (rohit98waghmare@gmail.com)
 * Run this once to get the access and refresh tokens
 */

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:5001/api/system-gmail-callback' // Temporary callback
);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    prompt: 'consent' // Force to get refresh token
});

console.log('🔐 System Gmail Setup\n');
console.log('Follow these steps to connect rohit98waghmare@gmail.com:\n');
console.log('1. Open this URL in your browser:');
console.log('\n' + authUrl + '\n');
console.log('2. Sign in with rohit98waghmare@gmail.com');
console.log('3. Grant permissions');
console.log('4. Copy the authorization code from the URL');
console.log('   (It will be after "code=" in the URL)\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('5. Paste the authorization code here: ', async (code) => {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('\n✅ Success! Add these to your Render environment variables:\n');
        console.log('SYSTEM_GMAIL_ACCESS_TOKEN=' + tokens.access_token);
        console.log('SYSTEM_GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\nAlso add to backend/.env for local development');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
    
    rl.close();
});
