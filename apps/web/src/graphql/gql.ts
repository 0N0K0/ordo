/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n  }\n": typeof types.AccountUserFragmentDoc,
    "\n  query Me {\n    me {\n      ...AccountUser\n    }\n  }\n": typeof types.MeDocument,
    "\n  mutation Login($identifier: String!, $password: String!) {\n    login(identifier: $identifier, password: $password) {\n      ...AccountUser\n    }\n  }\n": typeof types.LoginDocument,
    "\n  mutation Logout {\n    logout\n  }\n": typeof types.LogoutDocument,
    "\n  mutation RequestPasswordReset($identifier: String!) {\n    requestPasswordReset(identifier: $identifier)\n  }\n": typeof types.RequestPasswordResetDocument,
    "\n  mutation ResetPassword($token: String!, $password: String!) {\n    resetPassword(token: $token, password: $password)\n  }\n": typeof types.ResetPasswordDocument,
    "\n  mutation ConfirmEmailChange($token: String!) {\n    confirmEmailChange(token: $token)\n  }\n": typeof types.ConfirmEmailChangeDocument,
    "\n  mutation ChangePassword($currentPassword: String!, $password: String!) {\n    changePassword(currentPassword: $currentPassword, password: $password)\n  }\n": typeof types.ChangePasswordDocument,
    "\n  mutation ChangeUsername($currentPassword: String!, $username: String!) {\n    changeUsername(currentPassword: $currentPassword, username: $username) {\n      ...AccountUser\n    }\n  }\n": typeof types.ChangeUsernameDocument,
    "\n  mutation RequestEmailChange($currentPassword: String!, $email: String!) {\n    requestEmailChange(currentPassword: $currentPassword, email: $email) {\n      ...AccountUser\n    }\n  }\n": typeof types.RequestEmailChangeDocument,
    "\n  mutation CancelEmailChange {\n    cancelEmailChange {\n      ...AccountUser\n    }\n  }\n": typeof types.CancelEmailChangeDocument,
    "\n  fragment ClientFields on Client {\n    id\n    name\n    iconUrl\n    color\n    position\n    favorite\n    archived\n  }\n": typeof types.ClientFieldsFragmentDoc,
    "\n  fragment LabelFields on ProjectCategory {\n    id\n    name\n    color\n  }\n": typeof types.LabelFieldsFragmentDoc,
    "\n  fragment ProjectStatusFields on ProjectStatus {\n    id\n    name\n    color\n    position\n  }\n": typeof types.ProjectStatusFieldsFragmentDoc,
    "\n  fragment ProjectFields on Project {\n    id\n    title\n    clientId\n    parentId\n    iconUrl\n    description\n    statusId\n    startDate\n    endDate\n    color\n    position\n    favorite\n    archived\n    categories {\n      ...LabelFields\n    }\n  }\n": typeof types.ProjectFieldsFragmentDoc,
    "\n  query Workspace {\n    clients {\n      ...ClientFields\n    }\n    projects {\n      ...ProjectFields\n    }\n    projectCategories {\n      ...LabelFields\n    }\n    projectStatuses {\n      ...ProjectStatusFields\n    }\n  }\n": typeof types.WorkspaceDocument,
    "\n  mutation CreateClient($input: ClientInput!) {\n    createClient(input: $input) {\n      ...ClientFields\n    }\n  }\n": typeof types.CreateClientDocument,
    "\n  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {\n    updateClient(id: $id, input: $input) {\n      ...ClientFields\n    }\n  }\n": typeof types.UpdateClientDocument,
    "\n  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {\n    setClientFavorite(id: $id, favorite: $favorite) {\n      ...ClientFields\n    }\n  }\n": typeof types.SetClientFavoriteDocument,
    "\n  mutation SetClientArchived($id: ID!, $archived: Boolean!) {\n    setClientArchived(id: $id, archived: $archived) {\n      ...ClientFields\n    }\n  }\n": typeof types.SetClientArchivedDocument,
    "\n  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {\n    deleteClient(id: $id, deleteProjects: $deleteProjects)\n  }\n": typeof types.DeleteClientDocument,
    "\n  mutation MoveClient($id: ID!, $index: Int!) {\n    moveClient(id: $id, index: $index)\n  }\n": typeof types.MoveClientDocument,
    "\n  mutation CreateProject($input: ProjectInput!) {\n    createProject(input: $input) {\n      ...ProjectFields\n    }\n  }\n": typeof types.CreateProjectDocument,
    "\n  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {\n    updateProject(id: $id, input: $input) {\n      ...ProjectFields\n    }\n  }\n": typeof types.UpdateProjectDocument,
    "\n  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {\n    setProjectFavorite(id: $id, favorite: $favorite) {\n      ...ProjectFields\n    }\n  }\n": typeof types.SetProjectFavoriteDocument,
    "\n  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {\n    setProjectArchived(id: $id, archived: $archived) {\n      ...ProjectFields\n    }\n  }\n": typeof types.SetProjectArchivedDocument,
    "\n  mutation DeleteProject($id: ID!) {\n    deleteProject(id: $id)\n  }\n": typeof types.DeleteProjectDocument,
    "\n  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {\n    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)\n  }\n": typeof types.MoveProjectDocument,
    "\n  mutation CreateProjectCategory($input: ProjectCategoryInput!) {\n    createProjectCategory(input: $input) {\n      ...LabelFields\n    }\n  }\n": typeof types.CreateProjectCategoryDocument,
    "\n  mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {\n    updateProjectCategory(id: $id, input: $input) {\n      ...LabelFields\n    }\n  }\n": typeof types.UpdateProjectCategoryDocument,
    "\n  mutation DeleteProjectCategory($id: ID!) {\n    deleteProjectCategory(id: $id)\n  }\n": typeof types.DeleteProjectCategoryDocument,
    "\n  mutation CreateProjectStatus($input: ProjectStatusInput!) {\n    createProjectStatus(input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": typeof types.CreateProjectStatusDocument,
    "\n  mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {\n    updateProjectStatus(id: $id, input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": typeof types.UpdateProjectStatusDocument,
    "\n  mutation DeleteProjectStatus($id: ID!) {\n    deleteProjectStatus(id: $id)\n  }\n": typeof types.DeleteProjectStatusDocument,
    "\n  mutation MoveProjectStatus($id: ID!, $index: Int!) {\n    moveProjectStatus(id: $id, index: $index)\n  }\n": typeof types.MoveProjectStatusDocument,
};
const documents: Documents = {
    "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n  }\n": types.AccountUserFragmentDoc,
    "\n  query Me {\n    me {\n      ...AccountUser\n    }\n  }\n": types.MeDocument,
    "\n  mutation Login($identifier: String!, $password: String!) {\n    login(identifier: $identifier, password: $password) {\n      ...AccountUser\n    }\n  }\n": types.LoginDocument,
    "\n  mutation Logout {\n    logout\n  }\n": types.LogoutDocument,
    "\n  mutation RequestPasswordReset($identifier: String!) {\n    requestPasswordReset(identifier: $identifier)\n  }\n": types.RequestPasswordResetDocument,
    "\n  mutation ResetPassword($token: String!, $password: String!) {\n    resetPassword(token: $token, password: $password)\n  }\n": types.ResetPasswordDocument,
    "\n  mutation ConfirmEmailChange($token: String!) {\n    confirmEmailChange(token: $token)\n  }\n": types.ConfirmEmailChangeDocument,
    "\n  mutation ChangePassword($currentPassword: String!, $password: String!) {\n    changePassword(currentPassword: $currentPassword, password: $password)\n  }\n": types.ChangePasswordDocument,
    "\n  mutation ChangeUsername($currentPassword: String!, $username: String!) {\n    changeUsername(currentPassword: $currentPassword, username: $username) {\n      ...AccountUser\n    }\n  }\n": types.ChangeUsernameDocument,
    "\n  mutation RequestEmailChange($currentPassword: String!, $email: String!) {\n    requestEmailChange(currentPassword: $currentPassword, email: $email) {\n      ...AccountUser\n    }\n  }\n": types.RequestEmailChangeDocument,
    "\n  mutation CancelEmailChange {\n    cancelEmailChange {\n      ...AccountUser\n    }\n  }\n": types.CancelEmailChangeDocument,
    "\n  fragment ClientFields on Client {\n    id\n    name\n    iconUrl\n    color\n    position\n    favorite\n    archived\n  }\n": types.ClientFieldsFragmentDoc,
    "\n  fragment LabelFields on ProjectCategory {\n    id\n    name\n    color\n  }\n": types.LabelFieldsFragmentDoc,
    "\n  fragment ProjectStatusFields on ProjectStatus {\n    id\n    name\n    color\n    position\n  }\n": types.ProjectStatusFieldsFragmentDoc,
    "\n  fragment ProjectFields on Project {\n    id\n    title\n    clientId\n    parentId\n    iconUrl\n    description\n    statusId\n    startDate\n    endDate\n    color\n    position\n    favorite\n    archived\n    categories {\n      ...LabelFields\n    }\n  }\n": types.ProjectFieldsFragmentDoc,
    "\n  query Workspace {\n    clients {\n      ...ClientFields\n    }\n    projects {\n      ...ProjectFields\n    }\n    projectCategories {\n      ...LabelFields\n    }\n    projectStatuses {\n      ...ProjectStatusFields\n    }\n  }\n": types.WorkspaceDocument,
    "\n  mutation CreateClient($input: ClientInput!) {\n    createClient(input: $input) {\n      ...ClientFields\n    }\n  }\n": types.CreateClientDocument,
    "\n  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {\n    updateClient(id: $id, input: $input) {\n      ...ClientFields\n    }\n  }\n": types.UpdateClientDocument,
    "\n  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {\n    setClientFavorite(id: $id, favorite: $favorite) {\n      ...ClientFields\n    }\n  }\n": types.SetClientFavoriteDocument,
    "\n  mutation SetClientArchived($id: ID!, $archived: Boolean!) {\n    setClientArchived(id: $id, archived: $archived) {\n      ...ClientFields\n    }\n  }\n": types.SetClientArchivedDocument,
    "\n  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {\n    deleteClient(id: $id, deleteProjects: $deleteProjects)\n  }\n": types.DeleteClientDocument,
    "\n  mutation MoveClient($id: ID!, $index: Int!) {\n    moveClient(id: $id, index: $index)\n  }\n": types.MoveClientDocument,
    "\n  mutation CreateProject($input: ProjectInput!) {\n    createProject(input: $input) {\n      ...ProjectFields\n    }\n  }\n": types.CreateProjectDocument,
    "\n  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {\n    updateProject(id: $id, input: $input) {\n      ...ProjectFields\n    }\n  }\n": types.UpdateProjectDocument,
    "\n  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {\n    setProjectFavorite(id: $id, favorite: $favorite) {\n      ...ProjectFields\n    }\n  }\n": types.SetProjectFavoriteDocument,
    "\n  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {\n    setProjectArchived(id: $id, archived: $archived) {\n      ...ProjectFields\n    }\n  }\n": types.SetProjectArchivedDocument,
    "\n  mutation DeleteProject($id: ID!) {\n    deleteProject(id: $id)\n  }\n": types.DeleteProjectDocument,
    "\n  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {\n    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)\n  }\n": types.MoveProjectDocument,
    "\n  mutation CreateProjectCategory($input: ProjectCategoryInput!) {\n    createProjectCategory(input: $input) {\n      ...LabelFields\n    }\n  }\n": types.CreateProjectCategoryDocument,
    "\n  mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {\n    updateProjectCategory(id: $id, input: $input) {\n      ...LabelFields\n    }\n  }\n": types.UpdateProjectCategoryDocument,
    "\n  mutation DeleteProjectCategory($id: ID!) {\n    deleteProjectCategory(id: $id)\n  }\n": types.DeleteProjectCategoryDocument,
    "\n  mutation CreateProjectStatus($input: ProjectStatusInput!) {\n    createProjectStatus(input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": types.CreateProjectStatusDocument,
    "\n  mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {\n    updateProjectStatus(id: $id, input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n": types.UpdateProjectStatusDocument,
    "\n  mutation DeleteProjectStatus($id: ID!) {\n    deleteProjectStatus(id: $id)\n  }\n": types.DeleteProjectStatusDocument,
    "\n  mutation MoveProjectStatus($id: ID!, $index: Int!) {\n    moveProjectStatus(id: $id, index: $index)\n  }\n": types.MoveProjectStatusDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment AccountUser on User {\n    id\n    username\n    email\n    pendingEmail\n  }\n"): typeof import('./graphql').AccountUserFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').MeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Login($identifier: String!, $password: String!) {\n    login(identifier: $identifier, password: $password) {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').LoginDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Logout {\n    logout\n  }\n"): typeof import('./graphql').LogoutDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequestPasswordReset($identifier: String!) {\n    requestPasswordReset(identifier: $identifier)\n  }\n"): typeof import('./graphql').RequestPasswordResetDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetPassword($token: String!, $password: String!) {\n    resetPassword(token: $token, password: $password)\n  }\n"): typeof import('./graphql').ResetPasswordDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ConfirmEmailChange($token: String!) {\n    confirmEmailChange(token: $token)\n  }\n"): typeof import('./graphql').ConfirmEmailChangeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangePassword($currentPassword: String!, $password: String!) {\n    changePassword(currentPassword: $currentPassword, password: $password)\n  }\n"): typeof import('./graphql').ChangePasswordDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangeUsername($currentPassword: String!, $username: String!) {\n    changeUsername(currentPassword: $currentPassword, username: $username) {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').ChangeUsernameDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RequestEmailChange($currentPassword: String!, $email: String!) {\n    requestEmailChange(currentPassword: $currentPassword, email: $email) {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').RequestEmailChangeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CancelEmailChange {\n    cancelEmailChange {\n      ...AccountUser\n    }\n  }\n"): typeof import('./graphql').CancelEmailChangeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ClientFields on Client {\n    id\n    name\n    iconUrl\n    color\n    position\n    favorite\n    archived\n  }\n"): typeof import('./graphql').ClientFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment LabelFields on ProjectCategory {\n    id\n    name\n    color\n  }\n"): typeof import('./graphql').LabelFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ProjectStatusFields on ProjectStatus {\n    id\n    name\n    color\n    position\n  }\n"): typeof import('./graphql').ProjectStatusFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ProjectFields on Project {\n    id\n    title\n    clientId\n    parentId\n    iconUrl\n    description\n    statusId\n    startDate\n    endDate\n    color\n    position\n    favorite\n    archived\n    categories {\n      ...LabelFields\n    }\n  }\n"): typeof import('./graphql').ProjectFieldsFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Workspace {\n    clients {\n      ...ClientFields\n    }\n    projects {\n      ...ProjectFields\n    }\n    projectCategories {\n      ...LabelFields\n    }\n    projectStatuses {\n      ...ProjectStatusFields\n    }\n  }\n"): typeof import('./graphql').WorkspaceDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateClient($input: ClientInput!) {\n    createClient(input: $input) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').CreateClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {\n    updateClient(id: $id, input: $input) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').UpdateClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {\n    setClientFavorite(id: $id, favorite: $favorite) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').SetClientFavoriteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetClientArchived($id: ID!, $archived: Boolean!) {\n    setClientArchived(id: $id, archived: $archived) {\n      ...ClientFields\n    }\n  }\n"): typeof import('./graphql').SetClientArchivedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {\n    deleteClient(id: $id, deleteProjects: $deleteProjects)\n  }\n"): typeof import('./graphql').DeleteClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveClient($id: ID!, $index: Int!) {\n    moveClient(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveClientDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateProject($input: ProjectInput!) {\n    createProject(input: $input) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').CreateProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {\n    updateProject(id: $id, input: $input) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').UpdateProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {\n    setProjectFavorite(id: $id, favorite: $favorite) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').SetProjectFavoriteDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetProjectArchived($id: ID!, $archived: Boolean!) {\n    setProjectArchived(id: $id, archived: $archived) {\n      ...ProjectFields\n    }\n  }\n"): typeof import('./graphql').SetProjectArchivedDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProject($id: ID!) {\n    deleteProject(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {\n    moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)\n  }\n"): typeof import('./graphql').MoveProjectDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateProjectCategory($input: ProjectCategoryInput!) {\n    createProjectCategory(input: $input) {\n      ...LabelFields\n    }\n  }\n"): typeof import('./graphql').CreateProjectCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {\n    updateProjectCategory(id: $id, input: $input) {\n      ...LabelFields\n    }\n  }\n"): typeof import('./graphql').UpdateProjectCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProjectCategory($id: ID!) {\n    deleteProjectCategory(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectCategoryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateProjectStatus($input: ProjectStatusInput!) {\n    createProjectStatus(input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n"): typeof import('./graphql').CreateProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {\n    updateProjectStatus(id: $id, input: $input) {\n      ...ProjectStatusFields\n    }\n  }\n"): typeof import('./graphql').UpdateProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteProjectStatus($id: ID!) {\n    deleteProjectStatus(id: $id)\n  }\n"): typeof import('./graphql').DeleteProjectStatusDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MoveProjectStatus($id: ID!, $index: Int!) {\n    moveProjectStatus(id: $id, index: $index)\n  }\n"): typeof import('./graphql').MoveProjectStatusDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
