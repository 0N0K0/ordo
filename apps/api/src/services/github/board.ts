import { env } from '../../env';
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
  /**
   * Issue field of the organization the board shows, or null: its values belong to the issues (none on a draft),
   * its options are the issue field's, and it is written with updateIssueFieldValue.
   */
  issueFieldId: string | null;
}

export interface Board {
  id: string;
  title: string;
  url: string;
  fields: BoardField[];
  /** Issue types of the organization owning the board (none for a user's board). */
  issueTypes: { id: string; name: string }[];
}

/** Value of a field of an item. */
export interface FieldValue {
  optionId?: string;
  iterationId?: string;
  date?: string;
  number?: number;
}

export interface RemoteComment {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
  updatedAt: string;
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
  /** Issues only: labels, repository, parent issue and comments. */
  labels: { id: string; name: string }[];
  repositoryId: string | null;
  parentId: string | null;
  /** Issues only: issue type, milestone, blocking issues and related issues (node ids). */
  issueTypeId: string | null;
  milestone: { id: string; title: string } | null;
  blockedBy: string[];
  relatesTo: string[];
  comments: RemoteComment[];
  /** Latest change of the item or its content. */
  updatedAt: string;
  fields: Record<string, FieldValue>;
}

const ISSUE_FIELD_SELECTION = 'issueField { __typename ... on IssueFieldSingleSelect { id options { id name } } ... on IssueFieldDate { id } ... on IssueFieldNumber { id } ... on IssueFieldText { id } }';

const FIELD_SELECTION = `
  fields(first: 50) {
    nodes {
      __typename
      ... on ProjectV2FieldCommon { id name dataType isIssueField }
      ... on ProjectV2Field { ${ISSUE_FIELD_SELECTION} }
      ... on ProjectV2SingleSelectField { options { id name } ${ISSUE_FIELD_SELECTION} }
      ... on ProjectV2IterationField {
        configuration {
          iterations { id title startDate duration }
          completedIterations { id title startDate duration }
        }
      }
    }
  }
  owner { __typename ... on Organization { issueTypes(first: 50) { nodes { id name isEnabled } } } }`;

interface RawField {
  id?: string;
  name?: string;
  dataType?: string;
  options?: { id: string; name: string }[];
  configuration?: { iterations: BoardField['iterations']; completedIterations: BoardField['iterations'] };
  isIssueField?: boolean;
  issueField?: { id?: string; options?: { id: string; name: string }[] } | null;
}

interface RawBoard {
  id: string;
  title: string;
  url: string;
  fields: { nodes: RawField[] };
  owner?: { issueTypes?: { nodes: { id: string; name: string; isEnabled: boolean }[] } };
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
        // The options of an issue field are the issue field's (its values are written with their ids).
        options: (field.isIssueField ? field.issueField?.options : undefined) ?? field.options ?? [],
        iterations: [...(field.configuration?.iterations ?? []), ...(field.configuration?.completedIterations ?? [])],
        issueFieldId: (field.isIssueField && field.issueField?.id) || null,
      })),
    issueTypes: (raw.owner?.issueTypes?.nodes ?? []).filter((type) => type.isEnabled).map(({ id, name }) => ({ id, name })),
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
    labels?: { nodes: { id: string; name: string }[] };
    repository?: { id: string };
    parent?: { id: string } | null;
    issueType?: { id: string } | null;
    milestone?: { id: string; title: string } | null;
    blockedBy?: { nodes: { id: string }[] };
    relatesTo?: { nodes: { id: string }[] };
    issueFieldValues?: { nodes: { __typename: string; name?: string; dateValue?: string; numberValue?: number; field?: { id?: string } | null }[] } | null;
    comments?: { nodes: { id: string; body: string; createdAt: string; updatedAt: string; author: { login: string } | null }[] };
  } | null;
  fieldValues: { nodes: (FieldValue & { field?: { id?: string } })[] };
}

/**
 * Issues and draft issues of a board (pull requests and archived items left out). The values of the issue fields
 * the board shows are read on the issues and kept under the board field.
 * @param {string} token Token.
 * @param {Board} board Board, with its fields.
 * @returns {Promise<RemoteItem[]>} Items.
 */
export async function boardItems(token: string, board: Board): Promise<RemoteItem[]> {
  const id = board.id;
  const issueFields = new Map(board.fields.filter((field) => field.issueFieldId).map((field) => [field.issueFieldId!, field]));
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
                  ... on Issue {
                    id number title body state url updatedAt
                    assignees(first: 20) { nodes { login } }
                    labels(first: 50) { nodes { id name } }
                    repository { id }
                    parent { id }
                    issueType { id }
                    milestone { id title }
                    blockedBy(first: 50) { nodes { id } }
                    relatesTo(first: 50) { nodes { id } }
                    issueFieldValues(first: 30) {
                      nodes {
                        __typename
                        ... on IssueFieldSingleSelectValue { name field { ... on IssueFieldSingleSelect { id } } }
                        ... on IssueFieldDateValue { dateValue: value field { ... on IssueFieldDate { id } } }
                        ... on IssueFieldNumberValue { numberValue: value field { ... on IssueFieldNumber { id } } }
                      }
                    }
                    comments(first: 100) { nodes { id body createdAt updatedAt author { login } } }
                  }
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
      // Issue fields: their values are the issue's (an option by its name, among the issue field's options).
      for (const field of issueFields.values()) delete fields[field.id];
      for (const value of content.issueFieldValues?.nodes ?? []) {
        const field = value.field?.id ? issueFields.get(value.field.id) : undefined;
        if (!field) continue;
        if (value.__typename === 'IssueFieldSingleSelectValue') {
          const optionId = field.options.find((option) => option.name === value.name)?.id;
          if (optionId) fields[field.id] = { optionId };
        } else if (value.__typename === 'IssueFieldDateValue' && value.dateValue) fields[field.id] = { date: value.dateValue.slice(0, 10) };
        else if (value.__typename === 'IssueFieldNumberValue' && value.numberValue !== undefined) fields[field.id] = { number: value.numberValue };
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
        labels: content.labels?.nodes ?? [],
        repositoryId: content.repository?.id ?? null,
        parentId: content.parent?.id ?? null,
        issueTypeId: content.issueType?.id ?? null,
        milestone: content.milestone ?? null,
        blockedBy: (content.blockedBy?.nodes ?? []).map((issue) => issue.id),
        relatesTo: (content.relatesTo?.nodes ?? []).map((issue) => issue.id),
        comments: (content.comments?.nodes ?? []).map((comment) => ({ ...comment, author: comment.author?.login ?? null })),
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
 * Sets (or clears, with null) the value of an issue field on an issue.
 * @param {string} token Token.
 * @param {string} issueId Issue node id.
 * @param {string} issueFieldId Issue field id.
 * @param {FieldValue | null} value Value (option of the issue field, date or number), or null to clear.
 * @returns {Promise<void>}
 */
export async function setIssueFieldValue(token: string, issueId: string, issueFieldId: string, value: FieldValue | null): Promise<void> {
  const field =
    value === null
      ? { fieldId: issueFieldId, delete: true }
      : value.optionId
        ? { fieldId: issueFieldId, singleSelectOptionId: value.optionId }
        : value.date
          ? { fieldId: issueFieldId, dateValue: value.date }
          : { fieldId: issueFieldId, numberValue: value.number };
  await githubRequest(
    token,
    'mutation OrdoSetIssueField($issueId: ID!, $field: IssueFieldCreateOrUpdateInput!) { updateIssueFieldValue(input: { issueId: $issueId, issueField: $field }) { clientMutationId } }',
    { issueId, field },
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

/**
 * Labels of a repository.
 * @param {string} token Token.
 * @param {string} repositoryId Repository node id.
 * @returns {Promise<{ id: string, name: string }[]>} Labels.
 */
export async function repositoryLabels(token: string, repositoryId: string): Promise<{ id: string; name: string }[]> {
  const data = await githubRequest<{ node: { labels: { nodes: { id: string; name: string }[] } } | null }>(
    token,
    'query OrdoLabels($id: ID!) { node(id: $id) { ... on Repository { labels(first: 100) { nodes { id name } } } } }',
    { id: repositoryId },
  );
  return data.node?.labels.nodes ?? [];
}

/**
 * Creates a label in a repository.
 * @param {string} token Token.
 * @param {string} repositoryId Repository node id.
 * @param {string} name Name.
 * @param {string} color Hex color, without #.
 * @returns {Promise<{ id: string, name: string }>} Label.
 */
export async function createLabel(token: string, repositoryId: string, name: string, color: string): Promise<{ id: string; name: string }> {
  return (
    await githubRequest<{ createLabel: { label: { id: string; name: string } } }>(
      token,
      'mutation OrdoCreateLabel($repositoryId: ID!, $name: String!, $color: String!) { createLabel(input: { repositoryId: $repositoryId, name: $name, color: $color }) { label { id name } } }',
      { repositoryId, name, color },
    )
  ).createLabel.label;
}

/**
 * Adds and removes labels of an issue.
 * @param {string} token Token.
 * @param {string} issueId Issue node id.
 * @param {string[]} add Label ids to add.
 * @param {string[]} remove Label ids to remove.
 * @returns {Promise<void>}
 */
export async function setIssueLabels(token: string, issueId: string, add: string[], remove: string[]): Promise<void> {
  if (add.length) {
    await githubRequest(token, 'mutation OrdoAddLabels($id: ID!, $ids: [ID!]!) { addLabelsToLabelable(input: { labelableId: $id, labelIds: $ids }) { clientMutationId } }', { id: issueId, ids: add });
  }
  if (remove.length) {
    await githubRequest(
      token,
      'mutation OrdoRemoveLabels($id: ID!, $ids: [ID!]!) { removeLabelsFromLabelable(input: { labelableId: $id, labelIds: $ids }) { clientMutationId } }',
      { id: issueId, ids: remove },
    );
  }
}

/**
 * Makes an issue a sub-issue of another (replacing its parent), or detaches it from its parent.
 * @param {string} token Token.
 * @param {string} issueId Issue node id.
 * @param {string | null} parentId New parent issue, or null.
 * @param {string | null} previousId Current parent issue, or null.
 * @returns {Promise<void>}
 */
export async function setIssueParent(token: string, issueId: string, parentId: string | null, previousId: string | null): Promise<void> {
  if (parentId) {
    await githubRequest(
      token,
      'mutation OrdoAddSubIssue($parentId: ID!, $issueId: ID!) { addSubIssue(input: { issueId: $parentId, subIssueId: $issueId, replaceParent: true }) { clientMutationId } }',
      { parentId, issueId },
    );
  } else if (previousId) {
    await githubRequest(
      token,
      'mutation OrdoRemoveSubIssue($parentId: ID!, $issueId: ID!) { removeSubIssue(input: { issueId: $parentId, subIssueId: $issueId }) { clientMutationId } }',
      { parentId: previousId, issueId },
    );
  }
}

/**
 * Adds a comment to an issue.
 * @param {string} token Token.
 * @param {string} issueId Issue node id.
 * @param {string} body Markdown.
 * @returns {Promise<string>} Comment node id.
 */
export async function addIssueComment(token: string, issueId: string, body: string): Promise<string> {
  return (
    await githubRequest<{ addComment: { commentEdge: { node: { id: string } } } }>(
      token,
      'mutation OrdoAddComment($id: ID!, $body: String!) { addComment(input: { subjectId: $id, body: $body }) { commentEdge { node { id } } } }',
      { id: issueId, body },
    )
  ).addComment.commentEdge.node.id;
}

/**
 * Changes the body of an issue comment.
 * @param {string} token Token.
 * @param {string} id Comment node id.
 * @param {string} body Markdown.
 * @returns {Promise<void>}
 */
export async function updateIssueComment(token: string, id: string, body: string): Promise<void> {
  await githubRequest(token, 'mutation OrdoUpdateComment($id: ID!, $body: String!) { updateIssueComment(input: { id: $id, body: $body }) { clientMutationId } }', { id, body });
}

/**
 * Deletes an issue comment.
 * @param {string} token Token.
 * @param {string} id Comment node id.
 * @returns {Promise<void>}
 */
export async function deleteIssueComment(token: string, id: string): Promise<void> {
  await githubRequest(token, 'mutation OrdoDeleteComment($id: ID!) { deleteIssueComment(input: { id: $id }) { clientMutationId } }', { id });
}

/**
 * Sets (or clears, with null) the issue type of an issue.
 * @param {string} token Token.
 * @param {string} issueId Issue node id.
 * @param {string | null} issueTypeId Issue type, or null.
 * @returns {Promise<void>}
 */
export async function setIssueType(token: string, issueId: string, issueTypeId: string | null): Promise<void> {
  await githubRequest(
    token,
    'mutation OrdoSetIssueType($issueId: ID!, $issueTypeId: ID) { updateIssueIssueType(input: { issueId: $issueId, issueTypeId: $issueTypeId }) { clientMutationId } }',
    { issueId, issueTypeId },
  );
}

/**
 * Sets (or clears, with null) the milestone of an issue.
 * @param {string} token Token.
 * @param {string} issueId Issue node id.
 * @param {string | null} milestoneId Milestone node id, or null.
 * @returns {Promise<void>}
 */
export async function setIssueMilestone(token: string, issueId: string, milestoneId: string | null): Promise<void> {
  await githubRequest(token, 'mutation OrdoSetMilestone($id: ID!, $milestoneId: ID) { updateIssue(input: { id: $id, milestoneId: $milestoneId }) { clientMutationId } }', {
    id: issueId,
    milestoneId,
  });
}

/**
 * Milestones of a repository (open and closed), with its "owner/name".
 * @param {string} token Token.
 * @param {string} repositoryId Repository node id.
 * @returns {Promise<{ nameWithOwner: string, milestones: { id: string, title: string }[] }>} Repository milestones.
 */
export async function repositoryMilestones(token: string, repositoryId: string): Promise<{ nameWithOwner: string; milestones: { id: string; title: string }[] }> {
  const data = await githubRequest<{ node: { nameWithOwner: string; milestones: { nodes: { id: string; title: string }[] } } | null }>(
    token,
    'query OrdoMilestones($id: ID!) { node(id: $id) { ... on Repository { nameWithOwner milestones(first: 100, states: [OPEN, CLOSED]) { nodes { id title } } } } }',
    { id: repositoryId },
  );
  if (!data.node) throw clientError('BAD_USER_INPUT', 'Dépôt GitHub introuvable, ou le jeton n’y a plus accès.');
  return { nameWithOwner: data.node.nameWithOwner, milestones: data.node.milestones.nodes };
}

/**
 * Base URL of the REST API next to the GraphQL one (https://api.github.com, or <host>/api/v3 on GitHub Enterprise).
 * @returns {string} Base URL.
 */
function restBase(): string {
  const url = env.GITHUB_GRAPHQL_URL.replace(/\/+$/, '');
  return url.endsWith('/api/graphql') ? `${url.slice(0, -'/graphql'.length)}/v3` : url.replace(/\/graphql$/, '');
}

/**
 * Creates a milestone in a repository (the GraphQL API has no mutation for it: REST).
 * @param {string} token Token.
 * @param {string} nameWithOwner Repository "owner/name".
 * @param {string} title Title.
 * @returns {Promise<{ id: string, title: string }>} Milestone (node id).
 */
export async function createMilestone(token: string, nameWithOwner: string, title: string): Promise<{ id: string; title: string }> {
  let response: Response;
  try {
    response = await fetch(`${restBase()}/repos/${nameWithOwner}/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'Ordo' },
      body: JSON.stringify({ title }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw clientError('BAD_USER_INPUT', `GitHub injoignable (${error instanceof Error ? error.message : String(error)}).`);
  }
  const body = (await response.json().catch(() => ({}))) as { node_id?: string; title?: string; message?: string };
  if (!response.ok || !body.node_id) throw clientError('BAD_USER_INPUT', `Jalon « ${title} » non créé sur GitHub : ${body.message ?? response.status}.`);
  return { id: body.node_id, title: body.title ?? title };
}

/**
 * Adds or removes a "blocked by" dependency between two issues.
 * @param {string} token Token.
 * @param {string} issueId Blocked issue.
 * @param {string} blockingIssueId Blocking issue.
 * @param {boolean} add Add (true) or remove (false).
 * @returns {Promise<void>}
 */
export async function setBlockedBy(token: string, issueId: string, blockingIssueId: string, add: boolean): Promise<void> {
  const mutation = add ? 'addBlockedBy' : 'removeBlockedBy';
  await githubRequest(token, `mutation OrdoBlockedBy($issueId: ID!, $blockingIssueId: ID!) { ${mutation}(input: { issueId: $issueId, blockingIssueId: $blockingIssueId }) { clientMutationId } }`, {
    issueId,
    blockingIssueId,
  });
}

/**
 * Adds or removes a "relates to" relationship between two issues.
 * @param {string} token Token.
 * @param {string} issueId Issue.
 * @param {string} relatedIssueId Related issue.
 * @param {boolean} add Add (true) or remove (false).
 * @returns {Promise<void>}
 */
export async function setRelatesTo(token: string, issueId: string, relatedIssueId: string, add: boolean): Promise<void> {
  const mutation = add ? 'addRelatesTo' : 'removeRelatesTo';
  await githubRequest(token, `mutation OrdoRelatesTo($issueId: ID!, $relatedIssueId: ID!) { ${mutation}(input: { issueId: $issueId, relatedIssueId: $relatedIssueId }) { clientMutationId } }`, {
    issueId,
    relatedIssueId,
  });
}
