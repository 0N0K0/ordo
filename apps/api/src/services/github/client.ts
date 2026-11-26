import { GITHUB_NOT_CONNECTED, goneOnGithub, stopsGithubSync, type GithubFailure } from '@ordo/shared';
import type { GraphQLError } from 'graphql';
import { prisma } from '../../db';
import { env } from '../../env';
import { clientError, errorMessage } from '../../graphql/errors';
import { decryptSecret } from '../mail/secret';
import { currentWorkspaceId } from '../../workspace-context';

interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string; type?: string }[];
}

/** Failures of the errors of calls to GitHub, for what follows them (`stopsSync`, `isGoneOnGithub`). */
const failures = new WeakMap<GraphQLError, GithubFailure>();

/**
 * Error of a failed call to GitHub, with its failure kept.
 * @param {string} message Message.
 * @param {GithubFailure} failure Failure.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
function githubError(message: string, failure: GithubFailure): GraphQLError {
  const error = clientError('BAD_USER_INPUT', message);
  failures.set(error, failure);
  return error;
}

/**
 * Whether an error is a failed call to GitHub that stops the whole synchronization (GitHub out of reach, token
 * refused, rate limit, missing scopes), not only the task being synchronized.
 * @param {unknown} error Error caught.
 * @returns {boolean} The synchronization stops.
 */
export function stopsSync(error: unknown): boolean {
  const failure = failures.get(error as GraphQLError);
  return failure !== undefined && stopsGithubSync(failure);
}

/**
 * Whether an error is a failed call to GitHub saying that what it names no longer exists (`NOT_FOUND`).
 * @param {unknown} error Error caught.
 * @returns {boolean} Gone on GitHub.
 */
export function isGoneOnGithub(error: unknown): boolean {
  const failure = failures.get(error as GraphQLError);
  return failure !== undefined && goneOnGithub(failure);
}

/**
 * Calls the GitHub API with a token, turning network failures, a refused token and rate limits into errors.
 * @param {string} token Personal access token.
 * @param {string} url Endpoint (GraphQL or REST).
 * @param {unknown} payload JSON body (POST).
 * @param {Record<string, string>} [headers] Extra headers. Optional.
 * @returns {Promise<Response>} Response, any other status left to the caller.
 */
async function githubFetch(token: string, url: string, payload: unknown, headers: Record<string, string> = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Ordo', ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw githubError(`GitHub injoignable (${errorMessage(error)}).`, { network: true });
  }
  if (response.status === 401) throw githubError('Jeton GitHub refusé : vérifiez-le dans Paramètres › GitHub.', { status: 401 });
  if (response.status === 403 || response.status === 429) {
    // A 403 is the rate limit when GitHub says so (no request left, or a delay to wait); otherwise a right missing on one resource.
    const rateLimited = response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after');
    throw githubError('Limite de requêtes GitHub atteinte : réessayez plus tard.', { status: response.status, rateLimited });
  }
  return response;
}

/**
 * Runs a GitHub GraphQL operation with a token.
 * @param {string} token Personal access token.
 * @param {string} query Operation (named: the name shows in errors and tests).
 * @param {Record<string, unknown>} [variables] Variables. Optional.
 * @returns {Promise<T>} Data.
 */
export async function githubRequest<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await githubFetch(token, env.GITHUB_GRAPHQL_URL, { query, variables }, { 'GraphQL-Features': 'project_v2_draft_issues,sub_issues' });
  const body = (await response.json().catch(() => ({}))) as GraphqlResponse<T>;
  if (body.errors?.length) {
    const forbidden = body.errors.some((error) => error.type === 'FORBIDDEN' || error.type === 'INSUFFICIENT_SCOPES');
    const message = forbidden ? `Le jeton GitHub n’a pas les droits nécessaires (projets, issues) : ${body.errors[0].message}` : `GitHub : ${body.errors[0].message}`;
    throw githubError(message, { status: response.status, graphqlTypes: body.errors.flatMap((error) => (error.type ? [error.type] : [])) });
  }
  if (!response.ok || !body.data) throw githubError(`GitHub a répondu ${response.status}.`, { status: response.status });
  return body.data;
}

/**
 * Runs a GitHub REST POST with a token.
 * @param {string} token Personal access token.
 * @param {string} url Endpoint.
 * @param {unknown} payload JSON body.
 * @returns {Promise<{ response: Response, body: Partial<T> }>} Response and its JSON body (empty when unreadable).
 */
export async function githubRestPost<T extends object>(token: string, url: string, payload: unknown): Promise<{ response: Response; body: Partial<T> }> {
  const response = await githubFetch(token, url, payload, { Accept: 'application/vnd.github+json' });
  const body = (await response.json().catch(() => ({}))) as Partial<T>;
  return { response, body };
}

/** Token of a connection forgotten (« Déconnecter »): its row stays, with the last login. */
export const FORGOTTEN_TOKEN = '';

/**
 * GitHub connection of the current workspace, if any: none once its token is forgotten (the row then keeps only the
 * last login, `knownGithubLogin`).
 * @returns {Promise<{ login: string } | null>} Connection (its token and login).
 */
export function currentGithubConnection() {
  return prisma.githubConnection.findFirst({ where: { workspaceId: currentWorkspaceId(), token: { not: FORGOTTEN_TOKEN } } });
}

/**
 * Login of the account connected, or of the last one once the token is forgotten (null: never connected): the
 * comments of that account show no author.
 * @returns {Promise<string | null>} Login.
 */
export async function knownGithubLogin(): Promise<string | null> {
  return (await prisma.githubConnection.findUnique({ where: { workspaceId: currentWorkspaceId() }, select: { login: true } }))?.login ?? null;
}

/**
 * Token of the app, or throws when GitHub is not connected or the token cannot be decrypted.
 * @returns {Promise<string>} Token.
 */
export async function githubToken(): Promise<string> {
  const connection = await currentGithubConnection();
  if (!connection) throw clientError('BAD_USER_INPUT', GITHUB_NOT_CONNECTED);
  try {
    return decryptSecret(connection.token);
  } catch {
    throw clientError('BAD_USER_INPUT', 'Jeton GitHub illisible (MAIL_ENCRYPTION_KEY changée) : enregistrez-le à nouveau dans Paramètres › GitHub.');
  }
}
