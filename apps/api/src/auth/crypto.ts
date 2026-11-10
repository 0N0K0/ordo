import { createHash, randomBytes } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

/**
 * Hashes a random token for storage (tokens are high-entropy, SHA-256 is enough).
 * @param {string} token Token sent to the client.
 * @returns {string} Hex SHA-256 digest.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a random token and its storage hash.
 * @returns {{ token: string, tokenHash: string }} Token for the client, hash for the database.
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

// argon2id (the default algorithm) with argon2's former defaults (64 MiB, 3 passes, 4 lanes): stored hashes keep their own parameters anyway.
const ARGON2 = { memoryCost: 65536, timeCost: 3, parallelism: 4 };

/**
 * Hashes a password with argon2id.
 * @param {string} password Plain password.
 * @returns {Promise<string>} Encoded argon2 hash.
 */
export function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2);
}

// Verified when the user does not exist, so both paths take the same time.
const dummyHash = hashPassword('ordo-dummy-password');

/**
 * Checks a password against a stored hash.
 * @param {string | null} hash Stored hash, or null when the user does not exist.
 * @param {string} password Plain password.
 * @returns {Promise<boolean>} Whether the password matches.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  const matches = await argon2Verify(hash ?? (await dummyHash), password);
  return hash !== null && matches;
}
