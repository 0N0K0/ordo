import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type {
  LinkedMailFieldsFragment,
  MailDraftQuery,
  SaveMailDraftInput,
  MailAccountFieldsFragment,
  MailAccountInput,
  MailViewFieldsFragment,
  SendMailInput,
} from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type MailAccount = MailAccountFieldsFragment;
export type MailView = MailViewFieldsFragment;
export type LinkedMail = LinkedMailFieldsFragment;
export type MailDraft = MailDraftQuery['mailDraft'];
export type { MailAccountInput, SaveMailDraftInput, SendMailInput };

/**
 * Loads a draft to go on writing it.
 * @param {{ accountId: string, folder: string, uid: number }} location Draft.
 * @returns {Promise<MailDraft>} Draft.
 */
export async function fetchMailDraft(location: { accountId: string; folder: string; uid: number }): Promise<MailDraft> {
  return (await execute(MailDraftDocument, location)).mailDraft;
}

graphql(`
  fragment MailAccountFields on MailAccount {
    id
    name
    email
    displayName
    imapHost
    imapPort
    imapSecure
    imapUser
    smtpHost
    smtpPort
    smtpSecure
    smtpUser
    saveSent
    signature
  }
`);

graphql(`
  fragment MailViewFields on MailView {
    accountId
    folder
    uid
    messageId
    inReplyTo
    references
    subject
    from {
      name
      address
    }
    to {
      name
      address
    }
    cc {
      name
      address
    }
    replyTo {
      name
      address
    }
    date
    html
    text
    attachments {
      index
      filename
      contentType
      size
      inline
    }
    linkedProjectIds
  }
`);

graphql(`
  fragment LinkedMailFields on LinkedMail {
    id
    projectId
    accountId
    messageId
    inReplyTo
    references
    subject
    from {
      name
      address
    }
    to {
      name
      address
    }
    cc {
      name
      address
    }
    date
    html
    text
    sent
    attachments {
      id
      name
      size
      inline
      url
    }
  }
`);

const MailAccountsDocument = graphql(`
  query MailAccounts {
    mailAccounts {
      ...MailAccountFields
    }
  }
`);

const MailFoldersDocument = graphql(`
  query MailFolders($accountId: ID!) {
    mailFolders(accountId: $accountId) {
      path
      name
      specialUse
      unseen
      depth
    }
  }
`);

const MailMessagesDocument = graphql(`
  query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String, $unread: Boolean) {
    mailMessages(accountId: $accountId, folder: $folder, page: $page, search: $search, unread: $unread) {
      total
      pageSize
      messages {
        uid
        subject
        from {
          name
          address
        }
        to {
          name
          address
        }
        date
        seen
        flagged
        hasAttachments
      }
    }
  }
`);

const MailMessageDocument = graphql(`
  query MailMessage($accountId: ID!, $folder: String!, $uid: Int!) {
    mailMessage(accountId: $accountId, folder: $folder, uid: $uid) {
      ...MailViewFields
    }
  }
`);

const UnreadMailCountDocument = graphql(`
  query UnreadMailCount {
    unreadMailCount
  }
`);

const ProjectMailsDocument = graphql(`
  query ProjectMails($projectId: ID!) {
    projectMails(projectId: $projectId) {
      ...LinkedMailFields
    }
  }
`);

const TestMailAccountDocument = graphql(`
  mutation TestMailAccount($input: MailAccountInput!, $id: ID) {
    testMailAccount(input: $input, id: $id)
  }
`);

const CreateMailAccountDocument = graphql(`
  mutation CreateMailAccount($input: MailAccountInput!) {
    createMailAccount(input: $input) {
      id
    }
  }
`);

const UpdateMailAccountDocument = graphql(`
  mutation UpdateMailAccount($id: ID!, $input: MailAccountInput!) {
    updateMailAccount(id: $id, input: $input) {
      id
    }
  }
`);

const SetMailSignatureDocument = graphql(`
  mutation SetMailSignature($id: ID!, $signature: String!) {
    setMailSignature(id: $id, signature: $signature) {
      id
    }
  }
`);

const DeleteMailAccountDocument = graphql(`
  mutation DeleteMailAccount($id: ID!) {
    deleteMailAccount(id: $id)
  }
`);

const MoveMailAccountDocument = graphql(`
  mutation MoveMailAccount($id: ID!, $index: Int!) {
    moveMailAccount(id: $id, index: $index)
  }
`);

const SetMailSeenDocument = graphql(`
  mutation SetMailSeen($accountId: ID!, $folder: String!, $uids: [Int!]!, $seen: Boolean!) {
    setMailSeen(accountId: $accountId, folder: $folder, uids: $uids, seen: $seen)
  }
`);

const DeleteMailsDocument = graphql(`
  mutation DeleteMails($accountId: ID!, $folder: String!, $uids: [Int!]!) {
    deleteMails(accountId: $accountId, folder: $folder, uids: $uids)
  }
`);

const LinkMailDocument = graphql(`
  mutation LinkMail($accountId: ID!, $folder: String!, $uid: Int!, $projectId: ID!) {
    linkMail(accountId: $accountId, folder: $folder, uid: $uid, projectId: $projectId) {
      id
    }
  }
`);

const UnlinkMailDocument = graphql(`
  mutation UnlinkMail($id: ID!) {
    unlinkMail(id: $id)
  }
`);

const MailDraftDocument = graphql(`
  query MailDraft($accountId: ID!, $folder: String!, $uid: Int!) {
    mailDraft(accountId: $accountId, folder: $folder, uid: $uid) {
      accountId
      folder
      uid
      to {
        address
      }
      cc {
        address
      }
      bcc {
        address
      }
      subject
      html
      text
      inReplyTo
      references
      projectId
      attachments {
        index
        filename
        size
        inline
      }
    }
  }
`);

const SaveMailDraftDocument = graphql(`
  mutation SaveMailDraft($input: SaveMailDraftInput!) {
    saveMailDraft(input: $input) {
      accountId
      folder
      uid
      attachments {
        index
        filename
        size
        inline
      }
    }
  }
`);

const DeleteMailDraftDocument = graphql(`
  mutation DeleteMailDraft($location: MailLocationInput!) {
    deleteMailDraft(location: $location)
  }
`);

const SendMailDocument = graphql(`
  mutation SendMail($input: SendMailInput!) {
    sendMail(input: $input)
  }
`);

export const mailQueryKey = ['mail'] as const;

/**
 * Configured mail accounts.
 * @returns {UseQueryResult} Query state.
 */
export function useMailAccounts() {
  return useQuery({
    queryKey: [...mailQueryKey, 'accounts'],
    queryFn: async () => (await execute(MailAccountsDocument)).mailAccounts,
  });
}

/**
 * Folders of an account, with their unread counts (refreshed every two minutes).
 * @param {string | null} accountId Account.
 * @returns {UseQueryResult} Query state.
 */
export function useMailFolders(accountId: string | null) {
  return useQuery({
    queryKey: [...mailQueryKey, 'folders', accountId],
    queryFn: async () => (await execute(MailFoldersDocument, { accountId: accountId! })).mailFolders,
    enabled: accountId !== null,
    refetchInterval: 120_000,
    retry: false,
  });
}

/**
 * A page of a folder, latest first (refreshed every minute).
 * @param {object | null} params Account, folder, page and search; null when nothing is selected.
 * @returns {UseQueryResult} Query state.
 */
export function useMailMessages(params: { accountId: string; folder: string; page: number; search: string } | null) {
  return useQuery({
    queryKey: [...mailQueryKey, 'messages', params],
    queryFn: async () => (await execute(MailMessagesDocument, params!)).mailMessages,
    enabled: params !== null,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    retry: false,
  });
}

/**
 * Unread mails of the inbox of every account, latest first (refreshed every two minutes).
 * @param {string[]} accountIds Accounts.
 * @returns {{ data: { accountId: string, message: object }[] | undefined, isPending: boolean, error: Error | null }} Mails, loading state and first error.
 */
export function useUnreadMails(accountIds: string[]) {
  return useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: [...mailQueryKey, 'unread-messages', accountId],
      queryFn: async () => (await execute(MailMessagesDocument, { accountId, folder: 'INBOX', page: 0, search: '', unread: true })).mailMessages,
      refetchInterval: 120_000,
      retry: false,
    })),
    combine: (results) => ({
      // An unreachable account leaves out its mails, not the others.
      data: results.every((result) => result.data || result.error)
        ? results
            .flatMap((result, index) => (result.data?.messages ?? []).map((message) => ({ accountId: accountIds[index], message })))
            .sort((a, b) => String(b.message.date).localeCompare(String(a.message.date)))
        : undefined,
      isPending: results.some((result) => result.isPending),
      error: results.find((result) => result.error)?.error ?? null,
    }),
  });
}

/**
 * A message read from the server (opening it marks it as read).
 * @param {object | null} params Account, folder and UID.
 * @returns {UseQueryResult} Query state.
 */
export function useMailMessage(params: { accountId: string; folder: string; uid: number } | null) {
  return useQuery({
    queryKey: [...mailQueryKey, 'message', params],
    queryFn: async () => (await execute(MailMessageDocument, params!)).mailMessage,
    enabled: params !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Unread mails in every inbox, for the sidebar (refreshed every two minutes).
 * @param {boolean} enabled Whether accounts exist.
 * @returns {UseQueryResult} Query state.
 */
export function useUnreadMailCount(enabled: boolean) {
  return useQuery({
    queryKey: [...mailQueryKey, 'unread'],
    queryFn: async () => (await execute(UnreadMailCountDocument)).unreadMailCount,
    enabled,
    refetchInterval: 120_000,
    retry: false,
  });
}

/**
 * Mails linked to a project.
 * @param {string} projectId Project.
 * @returns {UseQueryResult} Query state.
 */
export function useProjectMails(projectId: string) {
  return useQuery({
    queryKey: [...mailQueryKey, 'project', projectId],
    queryFn: async () => (await execute(ProjectMailsDocument, { projectId })).projectMails,
  });
}

/**
 * Mutation refreshing the mail data once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useMailMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: mailQueryKey }),
  });
}

/**
 * Mail account settings.
 * @returns {object} Mutations.
 */
export function useMailAccountMutations() {
  return {
    test: useMutation({
      mutationFn: async (variables: { input: MailAccountInput; id?: string }) => (await execute(TestMailAccountDocument, variables)).testMailAccount,
    }),
    create: useMailMutation(async (input: MailAccountInput) => (await execute(CreateMailAccountDocument, { input })).createMailAccount),
    update: useMailMutation(
      async (variables: { id: string; input: MailAccountInput }) => (await execute(UpdateMailAccountDocument, variables)).updateMailAccount,
    ),
    setSignature: useMailMutation(
      async (variables: { id: string; signature: string }) => (await execute(SetMailSignatureDocument, variables)).setMailSignature,
    ),
    remove: useMailMutation(async (id: string) => (await execute(DeleteMailAccountDocument, { id })).deleteMailAccount),
    move: useMailMutation(async (variables: { id: string; index: number }) => (await execute(MoveMailAccountDocument, variables)).moveMailAccount),
  };
}

/**
 * Actions on mails: read state, deletion, project links, sending.
 * @returns {object} Mutations.
 */
export function useMailActions() {
  return {
    setSeen: useMailMutation(
      async (variables: { accountId: string; folder: string; uids: number[]; seen: boolean }) =>
        (await execute(SetMailSeenDocument, variables)).setMailSeen,
    ),
    remove: useMailMutation(
      async (variables: { accountId: string; folder: string; uids: number[] }) => (await execute(DeleteMailsDocument, variables)).deleteMails,
    ),
    link: useMailMutation(
      async (variables: { accountId: string; folder: string; uid: number; projectId: string }) =>
        (await execute(LinkMailDocument, variables)).linkMail,
    ),
    unlink: useMailMutation(async (id: string) => (await execute(UnlinkMailDocument, { id })).unlinkMail),
    send: useMailMutation(async (input: SendMailInput) => (await execute(SendMailDocument, { input })).sendMail),
    saveDraft: useMailMutation(async (input: SaveMailDraftInput) => (await execute(SaveMailDraftDocument, { input })).saveMailDraft),
    deleteDraft: useMailMutation(
      async (location: { accountId: string; folder: string; uid: number }) =>
        (await execute(DeleteMailDraftDocument, { location })).deleteMailDraft,
    ),
  };
}
