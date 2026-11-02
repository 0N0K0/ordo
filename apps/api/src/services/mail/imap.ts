import { ImapFlow } from 'imapflow';
import { prisma } from '../../db';
import type { MailAccount } from '../../generated/prisma/client';
import { clientError, notFound } from '../../graphql/errors';
import { decryptSecret } from './secret';

/** A pooled connection is closed after this idle time. */
const IDLE_MS = 5 * 60_000;

interface PooledClient {
  client: ImapFlow;
  /** Operations run one after the other on a connection. */
  queue: Promise<unknown>;
  timer?: NodeJS.Timeout;
}

const pool = new Map<string, PooledClient>();

/**
 * IMAP client of an account (not connected).
 * @param {Pick<MailAccount, 'imapHost' | 'imapPort' | 'imapSecure' | 'imapUser'>} account Account settings.
 * @param {string} password Plain password.
 * @returns {ImapFlow} Client.
 */
export function createImapClient(
  account: Pick<MailAccount, 'imapHost' | 'imapPort' | 'imapSecure' | 'imapUser'>,
  password: string,
): ImapFlow {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: { user: account.imapUser, pass: password },
    logger: false,
    emitLogs: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
  });
}

/**
 * Turns a connection or protocol failure into a readable error.
 * @param {unknown} error Caught error.
 * @returns {never}
 */
export function rethrowImapError(error: unknown): never {
  if (error && typeof error === 'object' && 'extensions' in error) throw error;
  const detail = error instanceof Error ? error.message : String(error);
  const auth = error && typeof error === 'object' && 'authenticationFailed' in error && error.authenticationFailed;
  throw clientError(
    'BAD_USER_INPUT',
    auth ? 'Connexion IMAP refusée : identifiant ou mot de passe incorrect.' : `Serveur IMAP injoignable ou en erreur (${detail}).`,
  );
}

/**
 * Closes the pooled connection of an account (after a settings change or a deletion).
 * @param {string} accountId Account.
 * @returns {void}
 */
export function closeImap(accountId: string): void {
  const pooled = pool.get(accountId);
  if (!pooled) return;
  pool.delete(accountId);
  clearTimeout(pooled.timer);
  void pooled.client.logout().catch(() => undefined);
}

/**
 * Runs an operation on the account's IMAP connection, opened on demand and kept for a few minutes.
 * Operations on one account are serialized.
 * @param {string} accountId Account.
 * @param {(client: ImapFlow) => Promise<T>} operation Operation.
 * @returns {Promise<T>} Result.
 */
export async function withImap<T>(accountId: string, operation: (client: ImapFlow) => Promise<T>): Promise<T> {
  let pooled = pool.get(accountId);
  if (!pooled || !pooled.client.usable) {
    if (pooled) closeImap(accountId);
    const account = await prisma.mailAccount.findUnique({ where: { id: accountId } });
    if (!account) throw notFound('Boîte mail');
    const client = createImapClient(account, decryptSecret(account.imapPassword));
    client.on('error', () => closeImap(accountId));
    client.on('close', () => pool.get(accountId)?.client === client && pool.delete(accountId));
    pooled = { client, queue: client.connect().catch((error: unknown) => { closeImap(accountId); rethrowImapError(error); }) };
    pool.set(accountId, pooled);
  }
  const current = pooled;
  clearTimeout(current.timer);
  const run = current.queue.catch(() => undefined).then(() => operation(current.client));
  current.queue = run.catch(() => undefined);
  try {
    return await run;
  } catch (error) {
    return rethrowImapError(error);
  } finally {
    current.timer = setTimeout(() => closeImap(accountId), IDLE_MS);
  }
}
