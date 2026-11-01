/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
export type ClientInput = {
  color?: string | null | undefined;
  icon?: File | null | undefined;
  name: string;
};

export type ClientUpdateInput = {
  /** null clears the color. */
  color?: string | null | undefined;
  /** Replaces the current icon. */
  icon?: File | null | undefined;
  name?: string | null | undefined;
  removeIcon?: boolean | null | undefined;
};

export type ProjectCategoryInput = {
  color: string;
  name: string;
};

export type ProjectCategoryUpdateInput = {
  color?: string | null | undefined;
  name?: string | null | undefined;
};

export type ProjectInput = {
  categoryIds?: Array<string | number> | null | undefined;
  /** Client of a root project; a sub-project inherits the client of its parent. */
  clientId?: string | number | null | undefined;
  color?: string | null | undefined;
  description?: string | null | undefined;
  endDate?: string | null | undefined;
  icon?: File | null | undefined;
  parentId?: string | number | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  title: string;
};

export type ProjectStatusInput = {
  color: string;
  name: string;
};

export type ProjectStatusUpdateInput = {
  color?: string | null | undefined;
  name?: string | null | undefined;
};

export type ProjectUpdateInput = {
  categoryIds?: Array<string | number> | null | undefined;
  /** null detaches the project from its client; omitted leaves it unchanged. */
  clientId?: string | number | null | undefined;
  color?: string | null | undefined;
  description?: string | null | undefined;
  endDate?: string | null | undefined;
  /** Replaces the current icon. */
  icon?: File | null | undefined;
  /** null makes it a root project; omitted leaves it unchanged. */
  parentId?: string | number | null | undefined;
  removeIcon?: boolean | null | undefined;
  startDate?: string | null | undefined;
  statusId?: string | number | null | undefined;
  title?: string | null | undefined;
};

export type AccountUserFragment = { id: string, username: string, email: string, pendingEmail: string | null };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, username: string, email: string, pendingEmail: string | null } | null };

export type LoginMutationVariables = Exact<{
  identifier: string;
  password: string;
}>;


export type LoginMutation = { login: { id: string, username: string, email: string, pendingEmail: string | null } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: boolean };

export type RequestPasswordResetMutationVariables = Exact<{
  identifier: string;
}>;


export type RequestPasswordResetMutation = { requestPasswordReset: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: string;
  password: string;
}>;


export type ResetPasswordMutation = { resetPassword: boolean };

export type ConfirmEmailChangeMutationVariables = Exact<{
  token: string;
}>;


export type ConfirmEmailChangeMutation = { confirmEmailChange: boolean };

export type ChangePasswordMutationVariables = Exact<{
  currentPassword: string;
  password: string;
}>;


export type ChangePasswordMutation = { changePassword: boolean };

export type ChangeUsernameMutationVariables = Exact<{
  currentPassword: string;
  username: string;
}>;


export type ChangeUsernameMutation = { changeUsername: { id: string, username: string, email: string, pendingEmail: string | null } };

export type RequestEmailChangeMutationVariables = Exact<{
  currentPassword: string;
  email: string;
}>;


export type RequestEmailChangeMutation = { requestEmailChange: { id: string, username: string, email: string, pendingEmail: string | null } };

export type CancelEmailChangeMutationVariables = Exact<{ [key: string]: never; }>;


export type CancelEmailChangeMutation = { cancelEmailChange: { id: string, username: string, email: string, pendingEmail: string | null } };

export type ClientFieldsFragment = { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean };

export type LabelFieldsFragment = { id: string, name: string, color: string };

export type ProjectStatusFieldsFragment = { id: string, name: string, color: string, position: number };

export type ProjectFieldsFragment = { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> };

export type WorkspaceQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkspaceQuery = { clients: Array<{ id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean }>, projects: Array<{ id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> }>, projectCategories: Array<{ id: string, name: string, color: string }>, projectStatuses: Array<{ id: string, name: string, color: string, position: number }> };

export type CreateClientMutationVariables = Exact<{
  input: ClientInput;
}>;


export type CreateClientMutation = { createClient: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type UpdateClientMutationVariables = Exact<{
  id: string | number;
  input: ClientUpdateInput;
}>;


export type UpdateClientMutation = { updateClient: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type SetClientFavoriteMutationVariables = Exact<{
  id: string | number;
  favorite: boolean;
}>;


export type SetClientFavoriteMutation = { setClientFavorite: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type SetClientArchivedMutationVariables = Exact<{
  id: string | number;
  archived: boolean;
}>;


export type SetClientArchivedMutation = { setClientArchived: { id: string, name: string, iconUrl: string | null, color: string | null, position: number, favorite: boolean, archived: boolean } };

export type DeleteClientMutationVariables = Exact<{
  id: string | number;
  deleteProjects: boolean;
}>;


export type DeleteClientMutation = { deleteClient: boolean };

export type MoveClientMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveClientMutation = { moveClient: boolean };

export type CreateProjectMutationVariables = Exact<{
  input: ProjectInput;
}>;


export type CreateProjectMutation = { createProject: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type UpdateProjectMutationVariables = Exact<{
  id: string | number;
  input: ProjectUpdateInput;
}>;


export type UpdateProjectMutation = { updateProject: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type SetProjectFavoriteMutationVariables = Exact<{
  id: string | number;
  favorite: boolean;
}>;


export type SetProjectFavoriteMutation = { setProjectFavorite: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type SetProjectArchivedMutationVariables = Exact<{
  id: string | number;
  archived: boolean;
}>;


export type SetProjectArchivedMutation = { setProjectArchived: { id: string, title: string, clientId: string | null, parentId: string | null, iconUrl: string | null, description: string | null, statusId: string | null, startDate: string | null, endDate: string | null, color: string | null, position: number, favorite: boolean, archived: boolean, categories: Array<{ id: string, name: string, color: string }> } };

export type DeleteProjectMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectMutation = { deleteProject: boolean };

export type MoveProjectMutationVariables = Exact<{
  id: string | number;
  parentId?: string | number | null | undefined;
  clientId?: string | number | null | undefined;
  index: number;
}>;


export type MoveProjectMutation = { moveProject: boolean };

export type CreateProjectCategoryMutationVariables = Exact<{
  input: ProjectCategoryInput;
}>;


export type CreateProjectCategoryMutation = { createProjectCategory: { id: string, name: string, color: string } };

export type UpdateProjectCategoryMutationVariables = Exact<{
  id: string | number;
  input: ProjectCategoryUpdateInput;
}>;


export type UpdateProjectCategoryMutation = { updateProjectCategory: { id: string, name: string, color: string } };

export type DeleteProjectCategoryMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectCategoryMutation = { deleteProjectCategory: boolean };

export type CreateProjectStatusMutationVariables = Exact<{
  input: ProjectStatusInput;
}>;


export type CreateProjectStatusMutation = { createProjectStatus: { id: string, name: string, color: string, position: number } };

export type UpdateProjectStatusMutationVariables = Exact<{
  id: string | number;
  input: ProjectStatusUpdateInput;
}>;


export type UpdateProjectStatusMutation = { updateProjectStatus: { id: string, name: string, color: string, position: number } };

export type DeleteProjectStatusMutationVariables = Exact<{
  id: string | number;
}>;


export type DeleteProjectStatusMutation = { deleteProjectStatus: boolean };

export type MoveProjectStatusMutationVariables = Exact<{
  id: string | number;
  index: number;
}>;


export type MoveProjectStatusMutation = { moveProjectStatus: boolean };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const AccountUserFragmentDoc = new TypedDocumentString(`
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
}
    `, {"fragmentName":"AccountUser"}) as unknown as TypedDocumentString<AccountUserFragment, unknown>;
export const ClientFieldsFragmentDoc = new TypedDocumentString(`
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}
    `, {"fragmentName":"ClientFields"}) as unknown as TypedDocumentString<ClientFieldsFragment, unknown>;
export const ProjectStatusFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}
    `, {"fragmentName":"ProjectStatusFields"}) as unknown as TypedDocumentString<ProjectStatusFieldsFragment, unknown>;
export const LabelFieldsFragmentDoc = new TypedDocumentString(`
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
    `, {"fragmentName":"LabelFields"}) as unknown as TypedDocumentString<LabelFieldsFragment, unknown>;
export const ProjectFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}`, {"fragmentName":"ProjectFields"}) as unknown as TypedDocumentString<ProjectFieldsFragment, unknown>;
export const MeDocument = new TypedDocumentString(`
    query Me {
  me {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
}`) as unknown as TypedDocumentString<MeQuery, MeQueryVariables>;
export const LoginDocument = new TypedDocumentString(`
    mutation Login($identifier: String!, $password: String!) {
  login(identifier: $identifier, password: $password) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
}`) as unknown as TypedDocumentString<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = new TypedDocumentString(`
    mutation Logout {
  logout
}
    `) as unknown as TypedDocumentString<LogoutMutation, LogoutMutationVariables>;
export const RequestPasswordResetDocument = new TypedDocumentString(`
    mutation RequestPasswordReset($identifier: String!) {
  requestPasswordReset(identifier: $identifier)
}
    `) as unknown as TypedDocumentString<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>;
export const ResetPasswordDocument = new TypedDocumentString(`
    mutation ResetPassword($token: String!, $password: String!) {
  resetPassword(token: $token, password: $password)
}
    `) as unknown as TypedDocumentString<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const ConfirmEmailChangeDocument = new TypedDocumentString(`
    mutation ConfirmEmailChange($token: String!) {
  confirmEmailChange(token: $token)
}
    `) as unknown as TypedDocumentString<ConfirmEmailChangeMutation, ConfirmEmailChangeMutationVariables>;
export const ChangePasswordDocument = new TypedDocumentString(`
    mutation ChangePassword($currentPassword: String!, $password: String!) {
  changePassword(currentPassword: $currentPassword, password: $password)
}
    `) as unknown as TypedDocumentString<ChangePasswordMutation, ChangePasswordMutationVariables>;
export const ChangeUsernameDocument = new TypedDocumentString(`
    mutation ChangeUsername($currentPassword: String!, $username: String!) {
  changeUsername(currentPassword: $currentPassword, username: $username) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
}`) as unknown as TypedDocumentString<ChangeUsernameMutation, ChangeUsernameMutationVariables>;
export const RequestEmailChangeDocument = new TypedDocumentString(`
    mutation RequestEmailChange($currentPassword: String!, $email: String!) {
  requestEmailChange(currentPassword: $currentPassword, email: $email) {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
}`) as unknown as TypedDocumentString<RequestEmailChangeMutation, RequestEmailChangeMutationVariables>;
export const CancelEmailChangeDocument = new TypedDocumentString(`
    mutation CancelEmailChange {
  cancelEmailChange {
    ...AccountUser
  }
}
    fragment AccountUser on User {
  id
  username
  email
  pendingEmail
}`) as unknown as TypedDocumentString<CancelEmailChangeMutation, CancelEmailChangeMutationVariables>;
export const WorkspaceDocument = new TypedDocumentString(`
    query Workspace {
  clients {
    ...ClientFields
  }
  projects {
    ...ProjectFields
  }
  projectCategories {
    ...LabelFields
  }
  projectStatuses {
    ...ProjectStatusFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}
fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<WorkspaceQuery, WorkspaceQueryVariables>;
export const CreateClientDocument = new TypedDocumentString(`
    mutation CreateClient($input: ClientInput!) {
  createClient(input: $input) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<CreateClientMutation, CreateClientMutationVariables>;
export const UpdateClientDocument = new TypedDocumentString(`
    mutation UpdateClient($id: ID!, $input: ClientUpdateInput!) {
  updateClient(id: $id, input: $input) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<UpdateClientMutation, UpdateClientMutationVariables>;
export const SetClientFavoriteDocument = new TypedDocumentString(`
    mutation SetClientFavorite($id: ID!, $favorite: Boolean!) {
  setClientFavorite(id: $id, favorite: $favorite) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<SetClientFavoriteMutation, SetClientFavoriteMutationVariables>;
export const SetClientArchivedDocument = new TypedDocumentString(`
    mutation SetClientArchived($id: ID!, $archived: Boolean!) {
  setClientArchived(id: $id, archived: $archived) {
    ...ClientFields
  }
}
    fragment ClientFields on Client {
  id
  name
  iconUrl
  color
  position
  favorite
  archived
}`) as unknown as TypedDocumentString<SetClientArchivedMutation, SetClientArchivedMutationVariables>;
export const DeleteClientDocument = new TypedDocumentString(`
    mutation DeleteClient($id: ID!, $deleteProjects: Boolean!) {
  deleteClient(id: $id, deleteProjects: $deleteProjects)
}
    `) as unknown as TypedDocumentString<DeleteClientMutation, DeleteClientMutationVariables>;
export const MoveClientDocument = new TypedDocumentString(`
    mutation MoveClient($id: ID!, $index: Int!) {
  moveClient(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveClientMutation, MoveClientMutationVariables>;
export const CreateProjectDocument = new TypedDocumentString(`
    mutation CreateProject($input: ProjectInput!) {
  createProject(input: $input) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<CreateProjectMutation, CreateProjectMutationVariables>;
export const UpdateProjectDocument = new TypedDocumentString(`
    mutation UpdateProject($id: ID!, $input: ProjectUpdateInput!) {
  updateProject(id: $id, input: $input) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<UpdateProjectMutation, UpdateProjectMutationVariables>;
export const SetProjectFavoriteDocument = new TypedDocumentString(`
    mutation SetProjectFavorite($id: ID!, $favorite: Boolean!) {
  setProjectFavorite(id: $id, favorite: $favorite) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<SetProjectFavoriteMutation, SetProjectFavoriteMutationVariables>;
export const SetProjectArchivedDocument = new TypedDocumentString(`
    mutation SetProjectArchived($id: ID!, $archived: Boolean!) {
  setProjectArchived(id: $id, archived: $archived) {
    ...ProjectFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}
fragment ProjectFields on Project {
  id
  title
  clientId
  parentId
  iconUrl
  description
  statusId
  startDate
  endDate
  color
  position
  favorite
  archived
  categories {
    ...LabelFields
  }
}`) as unknown as TypedDocumentString<SetProjectArchivedMutation, SetProjectArchivedMutationVariables>;
export const DeleteProjectDocument = new TypedDocumentString(`
    mutation DeleteProject($id: ID!) {
  deleteProject(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectMutation, DeleteProjectMutationVariables>;
export const MoveProjectDocument = new TypedDocumentString(`
    mutation MoveProject($id: ID!, $parentId: ID, $clientId: ID, $index: Int!) {
  moveProject(id: $id, parentId: $parentId, clientId: $clientId, index: $index)
}
    `) as unknown as TypedDocumentString<MoveProjectMutation, MoveProjectMutationVariables>;
export const CreateProjectCategoryDocument = new TypedDocumentString(`
    mutation CreateProjectCategory($input: ProjectCategoryInput!) {
  createProjectCategory(input: $input) {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}`) as unknown as TypedDocumentString<CreateProjectCategoryMutation, CreateProjectCategoryMutationVariables>;
export const UpdateProjectCategoryDocument = new TypedDocumentString(`
    mutation UpdateProjectCategory($id: ID!, $input: ProjectCategoryUpdateInput!) {
  updateProjectCategory(id: $id, input: $input) {
    ...LabelFields
  }
}
    fragment LabelFields on ProjectCategory {
  id
  name
  color
}`) as unknown as TypedDocumentString<UpdateProjectCategoryMutation, UpdateProjectCategoryMutationVariables>;
export const DeleteProjectCategoryDocument = new TypedDocumentString(`
    mutation DeleteProjectCategory($id: ID!) {
  deleteProjectCategory(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectCategoryMutation, DeleteProjectCategoryMutationVariables>;
export const CreateProjectStatusDocument = new TypedDocumentString(`
    mutation CreateProjectStatus($input: ProjectStatusInput!) {
  createProjectStatus(input: $input) {
    ...ProjectStatusFields
  }
}
    fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}`) as unknown as TypedDocumentString<CreateProjectStatusMutation, CreateProjectStatusMutationVariables>;
export const UpdateProjectStatusDocument = new TypedDocumentString(`
    mutation UpdateProjectStatus($id: ID!, $input: ProjectStatusUpdateInput!) {
  updateProjectStatus(id: $id, input: $input) {
    ...ProjectStatusFields
  }
}
    fragment ProjectStatusFields on ProjectStatus {
  id
  name
  color
  position
}`) as unknown as TypedDocumentString<UpdateProjectStatusMutation, UpdateProjectStatusMutationVariables>;
export const DeleteProjectStatusDocument = new TypedDocumentString(`
    mutation DeleteProjectStatus($id: ID!) {
  deleteProjectStatus(id: $id)
}
    `) as unknown as TypedDocumentString<DeleteProjectStatusMutation, DeleteProjectStatusMutationVariables>;
export const MoveProjectStatusDocument = new TypedDocumentString(`
    mutation MoveProjectStatus($id: ID!, $index: Int!) {
  moveProjectStatus(id: $id, index: $index)
}
    `) as unknown as TypedDocumentString<MoveProjectStatusMutation, MoveProjectStatusMutationVariables>;