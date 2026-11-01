/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
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