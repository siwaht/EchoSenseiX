import crypto from 'crypto';

/**
 * Decrypt an API key using AES-256-CBC encryption
 * @param encryptedApiKey - The encrypted API key in format "iv:encrypted"
 * @returns The decrypted API key
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) {
    throw new Error('No API key provided');
  }

  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);

  try {
    // Handle different encryption formats
    if (encryptedApiKey.includes(':')) {
      // New format with IV
      const [ivHex, encrypted] = encryptedApiKey.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } else {
      // Legacy format without IV - return as is (assumes it's plain text from old system)
      return encryptedApiKey;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt credentials. Please re-enter your credentials.');
  }
}

/**
 * Encrypt an API key using AES-256-CBC encryption
 * @param apiKey - The plain text API key
 * @returns The encrypted API key in format "iv:encrypted"
 */
export function encryptApiKey(apiKey: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt JSON credentials object
 * @param encryptedCredentials - The encrypted credentials as a string
 * @returns The decrypted credentials as an object
 */
export function decryptCredentials(encryptedCredentials: string): Record<string, any> {
  try {
    const decrypted = decryptApiKey(encryptedCredentials);
    return JSON.parse(decrypted);
  } catch (error) {
    // If it's not valid JSON, try to parse as API key directly
    console.warn('Failed to parse credentials as JSON, treating as plain API key');
    return { apiKey: decryptApiKey(encryptedCredentials) };
  }
}

/**
 * Encrypt JSON credentials object
 * @param credentials - The credentials object to encrypt
 * @returns The encrypted credentials as a string
 */
export function encryptCredentials(credentials: Record<string, any>): string {
  const json = JSON.stringify(credentials);
  return encryptApiKey(json);
}
