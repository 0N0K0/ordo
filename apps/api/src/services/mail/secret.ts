import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../env';
import { clientError } from '../../graphql/errors';

/**
 * Encryption key of the mail passwords.
 * @returns {Buffer} 32-byte key.
 */
function key(): Buffer {
  if (!env.MAIL_ENCRYPTION_KEY) {
    throw clientError(
      'BAD_USER_INPUT',
      'MAIL_ENCRYPTION_KEY manque dans le .env de l’API (générez-la avec « openssl rand -base64 32 »).',
    );
  }
  return Buffer.from(env.MAIL_ENCRYPTION_KEY, 'base64');
}

/**
 * Encrypts a secret (AES-256-GCM): "iv.tag.data" in base64.
 * @param {string} value Secret.
 * @returns {string} Encrypted value.
 */
export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
}

/**
 * Decrypts a secret encrypted by `encryptSecret`.
 * @param {string} value Encrypted value.
 * @returns {string} Secret.
 */
export function decryptSecret(value: string): string {
  const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
