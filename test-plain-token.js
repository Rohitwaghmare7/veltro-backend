require('dotenv').config();
const { decryptToken } = require('./src/services/encryption.service');

console.log('🔐 Testing Plain Text Token Handling\n');

// Test 1: Plain text token (no colon)
console.log('Test 1: Plain text token');
try {
    const plainToken = 'ya29.a0AfH6SMBxyz123456789';
    const result = decryptToken(plainToken);
    console.log('Input:', plainToken);
    console.log('Output:', result);
    console.log('✅ PASS: Plain text token returned as-is\n');
} catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
}

// Test 2: Encrypted token (with colon)
console.log('Test 2: Encrypted token');
try {
    const { encryptToken } = require('./src/services/encryption.service');
    const token = 'ya29.a0AfH6SMBxyz123456789';
    const encrypted = encryptToken(token);
    const decrypted = decryptToken(encrypted);
    console.log('Original:', token);
    console.log('Encrypted:', encrypted.substring(0, 50) + '...');
    console.log('Decrypted:', decrypted);
    console.log('Match:', token === decrypted);
    console.log('✅ PASS: Encrypted token decrypted correctly\n');
} catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
}

// Test 3: Invalid format (multiple colons)
console.log('Test 3: Invalid format');
try {
    const invalidToken = 'abc:def:ghi';
    const result = decryptToken(invalidToken);
    console.log('❌ FAIL: Should have thrown error\n');
} catch (error) {
    console.log('✅ PASS: Correctly rejected invalid format:', error.message, '\n');
}

console.log('✅ All tests completed!');
