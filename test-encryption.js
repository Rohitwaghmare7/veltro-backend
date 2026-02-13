require('dotenv').config();
const { encryptToken, decryptToken, generateEncryptionKey } = require('./src/services/encryption.service');

console.log('🔐 Testing Encryption Service\n');

// Test 1: Round trip encryption
console.log('Test 1: Round trip encryption');
try {
    const testToken = 'test_access_token_12345_abcdefghijklmnopqrstuvwxyz';
    console.log('Original token:', testToken);
    
    const encrypted = encryptToken(testToken);
    console.log('Encrypted:', encrypted.substring(0, 50) + '...');
    
    const decrypted = decryptToken(encrypted);
    console.log('Decrypted:', decrypted);
    
    if (decrypted === testToken) {
        console.log('✅ PASS: Round trip encryption works\n');
    } else {
        console.log('❌ FAIL: Decrypted token does not match original\n');
    }
} catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
}

// Test 2: Different IVs for same token
console.log('Test 2: Different IVs for same token');
try {
    const token = 'same_token';
    const encrypted1 = encryptToken(token);
    const encrypted2 = encryptToken(token);
    
    console.log('Encrypted 1:', encrypted1.substring(0, 40) + '...');
    console.log('Encrypted 2:', encrypted2.substring(0, 40) + '...');
    
    if (encrypted1 !== encrypted2) {
        console.log('✅ PASS: Different IVs generated for same token\n');
    } else {
        console.log('❌ FAIL: Same encrypted output (IV not unique)\n');
    }
} catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
}

// Test 3: Long token
console.log('Test 3: Long token (OAuth refresh token simulation)');
try {
    const longToken = 'ya29.a0AfH6SMBxyz123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
    const encrypted = encryptToken(longToken);
    const decrypted = decryptToken(encrypted);
    
    if (decrypted === longToken) {
        console.log('✅ PASS: Long token encryption works\n');
    } else {
        console.log('❌ FAIL: Long token decryption failed\n');
    }
} catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
}

// Test 4: Empty token handling
console.log('Test 4: Empty token handling');
try {
    encryptToken('');
    console.log('❌ FAIL: Should throw error for empty token\n');
} catch (error) {
    console.log('✅ PASS: Correctly rejects empty token\n');
}

// Test 5: Invalid encrypted token
console.log('Test 5: Invalid encrypted token handling');
try {
    decryptToken('invalid:encrypted:data');
    console.log('❌ FAIL: Should throw error for invalid encrypted token\n');
} catch (error) {
    console.log('✅ PASS: Correctly rejects invalid encrypted token\n');
}

// Test 6: Generate new encryption key
console.log('Test 6: Generate new encryption key');
try {
    const newKey = generateEncryptionKey();
    console.log('Generated key:', newKey);
    console.log('Key length:', newKey.length, 'characters (should be 64)');
    
    if (newKey.length === 64) {
        console.log('✅ PASS: Generated valid 64-character hex key\n');
    } else {
        console.log('❌ FAIL: Invalid key length\n');
    }
} catch (error) {
    console.log('❌ FAIL:', error.message, '\n');
}

console.log('✅ All encryption tests completed!');
