import { clientError } from '../../graphql/errors';
import { githubRequest } from './client';

export interface BoardField {
  id: string;
  name: string;
  /** SINGLE_SELECT, ITERATION, DATE, NUMBER, TEXT… */
  dataType: string;
  options: { id: string; name: string }[];
  /** Iterations (current and coming, then completed). */
  iterations: { id: string; title: string; startDate: string; duration: number }[];
}

export interface Board {
  id: string;
  title: string;
  url: string;
  fields: BoardField[];
}

/** Value of a field of an item. */
export interface FieldValue {
  optionId?: string;
  iterationId?: string;
  date?: string;
  number?: number;
}

export interface RemoteItem {
  itemId: string;
  contentId: string;
  type: 'ISSUE' | 'DRAFT_ISSUE';
  number: number | null;
  url: string | null;
  title: string;
  body: string;
  /** Issues only (a draft has no state). */
  closed: boolean | null;
  assignees: string[];
  /** Latest change of the item or its content. */
  updatedAt: string;
  fields: Record<string, FieldValue>;
}

const FIELD_SELECTION = `
  fields(first: 50) {
    nodes {
      __typename
      ... on ProjectV2FieldCommon { id name dataType }
      ... on ProjectV2SingleSelectField { options { id name } }
      ... on ProjectV2IterationField {
        configuration {
          iterations { id title startDate duration }
          completedIterations { id title startDate duration }
        }
      }
    }
  }`;

interface RawField {
  id?: string;
  name?: string;
  dataType?: string;
  options?: { id: string; name: string }[];
  configuration?: { iterations: BoardField['iterations']; completedIterations: BoardField['iterations'] };
}

interface RawBoard {
  id: string;
  title: string;
  url: string;
  fields: { nodes: RawField[] };
}

/**
 * Board of a raw answer.
 * @param {RawBoard} raw Raw board.
 * @returns {Board} Board.
 */
function toBoard(raw: RawBoard): Board {
  return {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    fields: raw.fields.nodes
      .filter((field) => field.id)
      .map((field) => ({
        id: field.id!,
        name: field.name ?? '',
        dataType: field.dataType ?? '',
        options: field.options ?? [],
        iterations: [...(field.configuration?.iterations ?? []), ...(field.configuration?.completedIterations ?? [])],
      })),
  };
}

/**
 * Login of the token's owner.
 * @param {string} token Token.
 * @returns {Promise<string>} Login.
 */
export async function viewerLogin(token: string): Promise<string> {
  return (await githubRequest<{ viewer: { login: string } }>(token, 'query OrdoViewer { viewer { login } }')).viewer.login;
}

/**
 * Board of a URL (https://github.com/users/<login>/projects/<n> or /orgs/<login>/projects/<n>).
 * @param {string} token Token.
 * @param {string} url Board URL.
 * @returns {Promise<Board>} Board with its fields.
 */
export async function resolveBoard(token: string, url: string): Promise<Board> {
  const match = /github\.com\/(users|orgs)\/([^/]+)\/projects\/(\d+)/.exec(url.trim());
  if (!match) throw clientError('BAD_USER_INPUT', 'Adresse attendue : https://github.com/users/<compte>/projects/<n> ou https://github.com/orgs/<organisation>/projects/<n>.', { fields: { url: 'Adresse de tableau GitHub invalide.' } });
  const owner = match[1] === 'orgs' ? 'organization' : 'user';
  const data = await githubRequest<Record<string, { projectV2: RawBoard | null } | null>>(
    token,
    `query OrdoBoardByNumber($login: String!, $number: Int!) { ${owner}(login: $login) { projectV2(number: $number) { id title url ${FIELD_SELECTION} } } }`,
    { login: match[2], number: Number(match[3]) },
  );
  const board = data[owner]?.projectV2;
  if (!board) throw clientError('BAD_USER_INPUT', 'Tableau GitHub introuvable, ou le jeton n’y a pas accès.');
  return toBoard(board);
}

/**
 * Board by node id, with its fields.
 * @param {string} token Token.
 * @param {string} id Board node id.
 * @returns {Promise<Board>} Board.
 */
export async function boardById(token: string, id: string): Promise<Board> {
  const data = await githubRequest<{ node: RawBoard | null }>(token, `query OrdoBoard($id: ID!) { node(id: $id) { ... on ProjectV2 { id title url ${FIELD_SELECTION} } } }`, { id });
  if (!data.node) throw clientError('BAD_USER_INPUT', 'Tableau GitHub introuvable, ou le jeton n’y a plus accès.');
  return toBoard(data.node);
}

interface RawItem {
  id: string;
  updatedAt: string;
  isArchived: boolean;
  content: {
    __typename: string;
    id?: string;
    number?: number;
    title?: string;
    body?: string;
    state?: string;
    url?: string;
    updatedAt?: string;
    assignees?: { nodes: { login: string }[] };
  } | null;
  fieldValues: { nodes: (FieldValue & { field?: { id?: string } })[] };
}

/**
 * Issues and draft issues of a board (pull requests and archived items left out).
 * @param {string} token Token.
 * @param {string} id Board node id.
 * @returns {Promise<RemoteItem[]>} Items.
 */
export async function boardItems(token: string, id: string): Promise<RemoteItem[]> {
  const items: RemoteItem[] = [];
  let cursor: string | null = null;
  do {
    const data: { node: { items: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawItem[] } } | null } = await githubRequest(
      token,
      `query OrdoBoardItems($id: ID!, $cursor: String) {
        node(id: $id) {
          ... on ProjectV2 {
            items(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id updatedAt isArchived
                content {
                  __typename
                  ... on Issue { id number title body state url updatedAt assignees(first: 20) { nodes { login } } }
                  ... on DraftIssue { id title body updatedAt assignees(first: 20) { nodes { login } } }
                }
                fieldValues(first: 30) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue { optionId field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldIterationValue { iterationId field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id } } }
                  }
                }
              }
            }
          }
        }
      }`,
      { id, cursor },
    );
    if (!data.node) throw clientError('BAD_USER_INPUT', 'Tableau GitHub introuvable, ou le jeton n’y a plus accès.');
    for (const item of data.node.items.nodes) {
      const content = item.content;
      if (item.isArchived || !content || (content.__typename !== 'Issue' && content.__typename !== 'DraftIssue')) continue;
      const fields: Record<string, FieldValue> = {};
      for (const value of item.fieldValues.nodes) {
        const fieldId = value.field?.id;
        if (!fieldId) continue;
        const { field: _field, ...rest } = value; // eslint-disable-line @typescript-eslint/no-unused-vars
        fields[fieldId] = rest;
      }
      const updates = [item.updatedAt, content.updatedAt].filter((date): date is string => Boolean(date)).sort();
      items.push({
        itemId: item.id,
        contentId: content.id!,
        type: content.__typename === 'Issue' ? 'ISSUE' : 'DRAFT_ISSUE',
        number: content.number ?? null,
        url: content.url ?? null,
        title: content.title ?? '',
        body: content.body ?? '',
        closed: content.__typename === 'Issue' ? content.state === 'CLOSED' : null,
        assignees: (content.assignees?.nodes ?? []).map((user) => user.login),
        updatedAt: updates[updates.length - 1],
        fields,
      });
    }
    cursor = data.node.items.pageInfo.hasNextPage ? data.node.items.pageInfo.endCursor : null;
  } while (cursor);
  return items;
}

/**
 * Repository by "owner/name".
 * @param {string} token Token.
 * @param {string} nameWithOwner Repository.
 * @returns {Promise<{ id: string, nameWithOwner: string }>} Repository.
 */
export async function repositoryByName(token: string, nameWithOwner: string): Promise<{ id: string; nameWithOwner: string }> {
  const [owner, name] = nameWithOwner.trim().split('/');
  if (!owner || !name) throw clientError('BAD_USER_INPUT', 'Dépôt attendu sous la forme compte/dépôt.', { fields: { repositoryName: 'Forme attendue : compte/dépôt.' } });
  const data = await githubRequest<{ repository: { id: string; nameWithOwner: string } | null }>(
    token,
    'query OrdoRepository($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id nameWithOwner } }',
    { owner, name },
  );
  if (!data.repository) throw clientError('BAD_USER_INPUT', 'Dépôt introuvable, ou le jeton n’y a pas accès.', { fields: { repositoryName: 'Dépôt introuvable.' } });
  return data.repository;
}

const userIds = new Map<string, string>();

/**
 * Node ids of GitHub users (cached).
 * @param {string} token Token.
 * @param {string[]} logins Logins.
 * @returns {Promise<string[]>} Ids of the logins found.
 */
export async function userNodeIds(token: string, logins: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const login of logins) {
    if (!userIds.has(login)) {
      const data = await githubRequest<{ user: { id: string } | null }>(token, 'query OrdoUser($login: String!) { user(login: $login) { id } }', { login });
      if (data.user) userIds.set(login, data.user.id);
    }
    const id = userIds.get(login);
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Sets (or clears, with null) a field of an item.
 * @param {string} token Token.
 * @param {object} target Board, item and field.
 * @param {string} target.projectId Board node id.
 * @param {string} target.itemId Item node id.
 * @param {string} target.fieldId Field id.
 * @param {FieldValue | null} value Value, or null to clear.
 * @returns {Promise<void>}
 */
export async function setItemField(token: string, target: { projectId: string; itemId: string; fieldId: string }, value: FieldValue | null): Promise<void> {
  if (value === null) {
    await githubRequest(
      token,
      'mutation OrdoClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) { clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) { clientMutationId } }',
      target,
    );
    return;
  }
  const input = value.optionId
    ? { singleSelectOptionId: value.optionId }
    : value.iterationId
      ? { iterationId: value.iterationId }
      : value.date
        ? { date: value.date }
        : { number: value.number };
  await githubRequest(
    token,
    'mutation OrdoSetField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) { updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) { clientMutationId } }',
    { ...target, value: input },
  );
}

/**
 * Updates the title, body, state and assignees of an issue or a draft issue.
 * @param {string} token Token.
 * @param {RemoteItem['type']} type Content type.
 * @param {string} contentId Content node id.
 * @param {object} changes Changes (undefined: unchanged).
 * @param {string} [changes.title] Title. Optional.
 * @param {string} [changes.body] Body. Optional.
 * @param {boolean} [changes.closed] Closed (issues). Optional.
 * @param {{ add: string[], remove: string[] }} [changes.assignees] Logins to add and remove. Optional.
 * @returns {Promise<void>}
 */
export async function updateContent(
  token: string,
  type: RemoteItem['type'],
  contentId: string,
  changes: { title?: string; body?: string; closed?: boolean; assignees?: { add: string[]; remove: string[]; all: string[] } },
): Promise<void> {
  if (type === 'DRAFT_ISSUE') {
    if (changes.title === undefined && changes.body === undefined && !changes.assignees) return;
    await githubRequest(
      token,
      'mutation OrdoUpdateDraft($id: ID!, $title: String, $body: String, $assigneeIds: [ID!]) { updateProjectV2DraftIssue(input: { draftIssueId: $id, title: $title, body: $body, assigneeIds: $assigneeIds }) { clientMutationId } }',
      { id: contentId, title: changes.title, body: changes.body, assigneeIds: changes.assignees ? await userNodeIds(token, changes.assignees.all) : undefined },
    );
    return;
  }
  if (changes.title !== undefined || changes.body !== undefined || changes.closed !== undefined) {
    await githubRequest(
      token,
      'mutation OrdoUpdateIssue($id: ID!, $title: String, $body: String, $state: IssueState) { updateIssue(input: { id: $id, title: $title, body: $body, state: $state }) { clientMutationId } }',
      { id: contentId, title: changes.title, body: changes.body, state: changes.closed === undefined ? undefined : changes.closed ? 'CLOSED' : 'OPEN' },
    );
  }
  if (changes.assignees?.add.length) {
    await githubRequest(
      token,
      'mutation OrdoAddAssignees($id: ID!, $ids: [ID!]!) { addAssigneesToAssignable(input: { assignableId: $id, assigneeIds: $ids }) { clientMutationId } }',
      { id: contentId, ids: await userNodeIds(token, changes.assignees.add) },
    );
  }
  if (changes.assignees?.remove.length) {
    await githubRequest(
      token,
      'mutation OrdoRemoveAssignees($id: ID!, $ids: [ID!]!) { removeAssigneesFromAssignable(input: { assignableId: $id, assigneeIds: $ids }) { clientMutationId } }',
      { id: contentId, ids: await userNodeIds(token, changes.assignees.remove) },
    );
  }
}

/**
 * Adds a task to a board: a draft issue, or an issue of a repository added to the board.
 * @param {string} token Token.
 * @param {object} input Board, repository and content.
 * @param {string} input.projectId Board node id.
 * @param {string | null} input.repositoryId Repository of the issue, or null for a draft.
 * @param {string} input.title Title.
 * @param {string} input.body Body.
 * @param {string[]} input.assignees Logins.
 * @returns {Promise<{ itemId: string, contentId: string, type: RemoteItem['type'], number: number | null, url: string | null }>} Item.
 */
export async function createItem(
  token: string,
  input: { projectId: string; repositoryId: string | null; title: string; body: string; assignees: string[] },
): Promise<{ itemId: string; contentId: string; type: RemoteItem['type']; number: number | null; url: string | null }> {
  const assigneeIds = await userNodeIds(token, input.assignees);
  if (!input.repositoryId) {
    const data = await githubRequest<{ addProjectV2DraftIssue: { projectItem: { id: string; content: { id: string } } } }>(
      token,
      'mutation OrdoCreateDraft($projectId: ID!, $title: String!, $body: String, $assigneeIds: [ID!]) { addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body, assigneeIds: $assigneeIds }) { projectItem { id content { ... on DraftIssue { id } } } } }',
      { projectId: input.projectId, title: input.title, body: input.body, assigneeIds },
    );
    const item = data.addProjectV2DraftIssue.projectItem;
    return { itemId: item.id, contentId: item.content.id, type: 'DRAFT_ISSUE', number: null, url: null };
  }
  const issue = (
    await githubRequest<{ createIssue: { issue: { id: string; number: number; url: string } } }>(
      token,
      'mutation OrdoCreateIssue($repositoryId: ID!, $title: String!, $body: String, $assigneeIds: [ID!]) { createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body, assigneeIds: $assigneeIds }) { issue { id number url } } }',
      { repositoryId: input.repositoryId, title: input.title, body: input.body, assigneeIds },
    )
  ).createIssue.issue;
  const item = (
    await githubRequest<{ addProjectV2ItemById: { item: { id: string } } }>(
      token,
      'mutation OrdoAddItem($projectId: ID!, $contentId: ID!) { addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } } }',
      { projectId: input.projectId, contentId: issue.id },
    )
  ).addProjectV2ItemById.item;
  return { itemId: item.id, contentId: issue.id, type: 'ISSUE', number: issue.number, url: issue.url };
}

/**
 * Removes an item from a board (a draft issue is deleted, an issue stays in its repository).
 * @param {string} token Token.
 * @param {string} projectId Board node id.
 * @param {string} itemId Item node id.
 * @returns {Promise<void>}
 */
export async function deleteItem(token: string, projectId: string, itemId: string): Promise<void> {
  await githubRequest(
    token,
    'mutation OrdoDeleteItem($projectId: ID!, $itemId: ID!) { deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) { deletedItemId } }',
    { projectId, itemId },
  );
}
