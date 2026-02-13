const crypto = require('crypto');

/**
 * Encryption service for OAuth tokens
 * Uses AES-256-CBC with unique IV for each encryption
 */

const ALGORITHM = 'aes-256-cbc';

/**
 * Get encryption key from environment
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable not set');
    }
    
    if (key.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    
    return Buffer.from(key, 'hex');
}

/**
 * Encrypt a token using AES-256-CBC
 * @param {string} token - Token to encrypt
 * @returns {string} - IV:encrypted format
 */
function encryptToken(token) {
    if (!token) {
        throw new Error('Token is required for encryption');
    }
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // Generate unique IV
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (IV needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
}

// Track if we've already warned about plain text tokens
let plainTextTokenWarningShown = false;

/**
 * Decrypt a token using AES-256-CBC
 * @param {string} encryptedToken - Token in IV:encrypted format
 * @returns {string} - Decrypted token
 */
function decryptToken(encryptedToken) {
    if (!encryptedToken) {
        throw new Error('Encrypted token is required for decryption');
    }
    
    // Check if token is already in plain text (no colon separator)
    // This handles tokens stored before encryption was implemented
    if (!encryptedToken.includes(':')) {
        // Only warn once to avoid log spam
        if (!plainTextTokenWarningShown) {
            console.warn('⚠️  Gmail tokens are not encrypted. For better security, disconnect and reconnect Gmail in Integrations page.');
            plainTextTokenWarningShown = true;
        }
        return encryptedToken;
    }
    
    const key = getEncryptionKey();
    
    // Split IV and encrypted data
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        throw new Error('Failed to decrypt token. Please reconnect Gmail.');
    }
}

/**
 * Generate a new encryption key (for setup)
 * @returns {string} - 64 character hex string
 */
function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    encryptToken,
    decryptToken,
    generateEncryptionKey
};
