import { prisma } from '../../db';
import { env } from '../../env';
import { clientError, errorMessage } from '../../graphql/errors';
import { decryptSecret } from '../mail/secret';
import { currentWorkspaceId } from '../../workspace-context';

interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string; type?: string }[];
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
    throw clientError('BAD_USER_INPUT', `GitHub injoignable (${errorMessage(error)}).`);
  }
  if (response.status === 401) throw clientError('BAD_USER_INPUT', 'Jeton GitHub refusé : vérifiez-le dans Paramètres › GitHub.');
  if (response.status === 403 || response.status === 429) throw clientError('BAD_USER_INPUT', 'Limite de requêtes GitHub atteinte : réessayez plus tard.');
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
    throw clientError('BAD_USER_INPUT', forbidden ? `Le jeton GitHub n’a pas les droits nécessaires (projets, issues) : ${body.errors[0].message}` : `GitHub : ${body.errors[0].message}`);
  }
  if (!response.ok || !body.data) throw clientError('BAD_USER_INPUT', `GitHub a répondu ${response.status}.`);
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

/**
 * GitHub connection of the current workspace, if any.
 * @returns {Promise<{ login: string } | null>} Connection (its token and login).
 */
export function currentGithubConnection() {
  return prisma.githubConnection.findUnique({ where: { workspaceId: currentWorkspaceId() } });
}

/**
 * Token of the app, or throws when GitHub is not connected or the token cannot be decrypted.
 * @returns {Promise<string>} Token.
 */
export async function githubToken(): Promise<string> {
  const connection = await currentGithubConnection();
  if (!connection) throw clientError('BAD_USER_INPUT', 'Connectez d’abord GitHub (Paramètres › GitHub).');
  try {
    return decryptSecret(connection.token);
  } catch {
    throw clientError('BAD_USER_INPUT', 'Jeton GitHub illisible (MAIL_ENCRYPTION_KEY changée) : enregistrez-le à nouveau dans Paramètres › GitHub.');
  }
}
