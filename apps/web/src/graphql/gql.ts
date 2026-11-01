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


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
