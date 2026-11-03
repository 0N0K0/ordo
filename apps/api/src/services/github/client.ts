import { prisma } from '../../db';
import { env } from '../../env';
import { clientError } from '../../graphql/errors';
import { decryptSecret } from '../mail/secret';

interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string; type?: string }[];
}

/**
 * Runs a GitHub GraphQL operation with a token.
 * @param {string} token Personal access token.
 * @param {string} query Operation (named: the name shows in errors and tests).
 * @param {Record<string, unknown>} [variables] Variables. Optional.
 * @returns {Promise<T>} Data.
 */
export async function githubRequest<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(env.GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Ordo', 'GraphQL-Features': 'project_v2_draft_issues,sub_issues' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw clientError('BAD_USER_INPUT', `GitHub injoignable (${error instanceof Error ? error.message : String(error)}).`);
  }
  if (response.status === 401) throw clientError('BAD_USER_INPUT', 'Jeton GitHub refusé : vérifiez-le dans Paramètres › GitHub.');
  if (response.status === 403 || response.status === 429) throw clientError('BAD_USER_INPUT', 'Limite de requêtes GitHub atteinte : réessayez plus tard.');
  const body = (await response.json().catch(() => ({}))) as GraphqlResponse<T>;
  if (body.errors?.length) {
    const forbidden = body.errors.some((error) => error.type === 'FORBIDDEN' || error.type === 'INSUFFICIENT_SCOPES');
    throw clientError(
      'BAD_USER_INPUT',
      forbidden ? `Le jeton GitHub n’a pas les droits nécessaires (projets, issues) : ${body.errors[0].message}` : `GitHub : ${body.errors[0].message}`,
    );
  }
  if (!response.ok || !body.data) throw clientError('BAD_USER_INPUT', `GitHub a répondu ${response.status}.`);
  return body.data;
}

/**
 * Token of the app, or throws when GitHub is not connected.
 * @returns {Promise<string>} Token.
 */
export async function githubToken(): Promise<string> {
  const connection = await prisma.githubConnection.findUnique({ where: { id: 'github' } });
  if (!connection) throw clientError('BAD_USER_INPUT', 'Connectez d’abord GitHub (Paramètres › GitHub).');
  return decryptSecret(connection.token);
}
