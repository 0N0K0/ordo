import { keepPreviousData, useIsFetching, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { MailSearchCriteria, MailSearchInput } from '@ordo/shared';
import { execute } from '../../lib/graphql-client';
import { MAIL_CHECK_MS, requestMailCheck } from './mail-check';

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
    labelIds
    done
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
      parent
      todo
    }
  }
`);

const MailMessagesDocument = graphql(`
  query MailMessages($accountId: ID!, $folder: String!, $page: Int!, $search: String, $unread: Boolean, $state: String, $sort: String, $ascending: Boolean) {
    mailMessages(accountId: $accountId, folder: $folder, page: $page, search: $search, unread: $unread, state: $state, sort: $sort, ascending: $ascending) {
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
        labelIds
        done
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

const TodoMailCountDocument = graphql(`
  query TodoMailCount {
    todoMailCount
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

const MailLabelsDocument = graphql(`
  query MailLabels {
    mailLabels {
      id
      name
      color
      position
    }
  }
`);

const ScheduledMailsDocument = graphql(`
  query ScheduledMails {
    scheduledMails {
      id
      accountId
      sendAt
      subject
      to
      status
      error
    }
  }
`);

const MarkMailsDocument = graphql(`
  mutation MarkMails($accountId: ID!, $folder: String!, $uids: [Int!]!, $labelId: ID, $on: Boolean, $done: Boolean) {
    markMails(accountId: $accountId, folder: $folder, uids: $uids, labelId: $labelId, on: $on, done: $done)
  }
`);

const ReportMailSpamDocument = graphql(`
  mutation ReportMailSpam($accountId: ID!, $folder: String!, $uids: [Int!]!, $spam: Boolean!) {
    reportMailSpam(accountId: $accountId, folder: $folder, uids: $uids, spam: $spam)
  }
`);

const MoveMailsDocument = graphql(`
  mutation MoveMails($accountId: ID!, $folder: String!, $uids: [Int!]!, $target: String!) {
    moveMails(accountId: $accountId, folder: $folder, uids: $uids, target: $target)
  }
`);

const CreateMailFolderDocument = graphql(`
  mutation CreateMailFolder($accountId: ID!, $parent: String, $name: String!) {
    createMailFolder(accountId: $accountId, parent: $parent, name: $name)
  }
`);

const RenameMailFolderDocument = graphql(`
  mutation RenameMailFolder($accountId: ID!, $path: String!, $name: String!) {
    renameMailFolder(accountId: $accountId, path: $path, name: $name)
  }
`);

const DeleteMailFolderDocument = graphql(`
  mutation DeleteMailFolder($accountId: ID!, $path: String!) {
    deleteMailFolder(accountId: $accountId, path: $path)
  }
`);

const CreateMailLabelDocument = graphql(`
  mutation CreateMailLabel($name: String!, $color: String!) {
    createMailLabel(name: $name, color: $color)
  }
`);

const UpdateMailLabelDocument = graphql(`
  mutation UpdateMailLabel($id: ID!, $name: String!, $color: String!) {
    updateMailLabel(id: $id, name: $name, color: $color)
  }
`);

const DeleteMailLabelDocument = graphql(`
  mutation DeleteMailLabel($id: ID!) {
    deleteMailLabel(id: $id)
  }
`);

const ScheduleMailDocument = graphql(`
  mutation ScheduleMail($input: SendMailInput!, $sendAt: DateTime!) {
    scheduleMail(input: $input, sendAt: $sendAt)
  }
`);

const SendScheduledMailDocument = graphql(`
  mutation SendScheduledMail($id: ID!) {
    sendScheduledMail(id: $id)
  }
`);

const CancelScheduledMailDocument = graphql(`
  mutation CancelScheduledMail($id: ID!) {
    cancelScheduledMail(id: $id)
  }
`);

const MailSearchesDocument = graphql(`
  query MailSearches {
    mailSearches {
      id
      name
      criteria
      position
    }
  }
`);

const MailSearchResultsDocument = graphql(`
  query MailSearchResults($id: ID!, $page: Int!) {
    mailSearchResults(id: $id, page: $page) {
      total
      pageSize
      messages {
        accountId
        folder
        folderName
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
        labelIds
        done
      }
    }
  }
`);

const MailAdvancedSearchDocument = graphql(`
  query MailAdvancedSearch($criteria: JSON!, $page: Int!) {
    mailAdvancedSearch(criteria: $criteria, page: $page) {
      total
      pageSize
      messages {
        accountId
        folder
        folderName
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
        labelIds
        done
      }
    }
  }
`);

const MoveMailFolderDocument = graphql(`
  mutation MoveMailFolder($accountId: ID!, $path: String!, $parent: String) {
    moveMailFolder(accountId: $accountId, path: $path, parent: $parent)
  }
`);

const CreateMailSearchDocument = graphql(`
  mutation CreateMailSearch($input: MailSearchInput!) {
    createMailSearch(input: $input)
  }
`);

const UpdateMailSearchDocument = graphql(`
  mutation UpdateMailSearch($id: ID!, $input: MailSearchInput!) {
    updateMailSearch(id: $id, input: $input)
  }
`);

const DeleteMailSearchDocument = graphql(`
  mutation DeleteMailSearch($id: ID!) {
    deleteMailSearch(id: $id)
  }
`);

export type MailSearch = Awaited<ReturnType<typeof fetchSearches>>[number];

/**
 * Search folders.
 * @returns {Promise<object[]>} Searches, in order.
 */
async function fetchSearches() {
  return (await execute(MailSearchesDocument)).mailSearches;
}

export type MailLabel = Awaited<ReturnType<typeof fetchLabels>>[number];
export type ScheduledMail = Awaited<ReturnType<typeof fetchScheduled>>[number];

/**
 * Flags of mails.
 * @returns {Promise<object[]>} Flags, in order.
 */
async function fetchLabels() {
  return (await execute(MailLabelsDocument)).mailLabels;
}

/**
 * Scheduled mails (waiting or failed).
 * @returns {Promise<object[]>} Mails, by time.
 */
async function fetchScheduled() {
  return (await execute(ScheduledMailsDocument)).scheduledMails;
}

export const mailQueryKey = ['mail'] as const;

/**
 * Search folders.
 * @returns {UseQueryResult} Query state.
 */
export function useMailSearches() {
  return useQuery({ queryKey: [...mailQueryKey, 'searches'], queryFn: fetchSearches });
}

/**
 * A page of the mails of a search folder, or of an advanced search (fetched every 10 minutes).
 * @param {object | null} params Search (or criteria) and page; null when none is open.
 * @returns {UseQueryResult} Query state.
 */
export function useMailSearchResults(params: { id: string; page: number } | { criteria: MailSearchCriteria; page: number } | null) {
  return useQuery({
    queryKey: [...mailQueryKey, 'search-results', params],
    queryFn: async () =>
      params && 'criteria' in params
        ? (await execute(MailAdvancedSearchDocument, { criteria: params.criteria, page: params.page })).mailAdvancedSearch
        : (await execute(MailSearchResultsDocument, params as { id: string; page: number })).mailSearchResults,
    enabled: params !== null,
    placeholderData: keepPreviousData,
    refetchInterval: MAIL_CHECK_MS,
    retry: false,
  });
}

/**
 * Search folders: create, update, delete.
 * @returns {object} Mutations.
 */
export function useMailSearchMutations() {
  return {
    create: useMailMutation(async (input: MailSearchInput) => (await execute(CreateMailSearchDocument, { input })).createMailSearch),
    update: useMailMutation(async (variables: { id: string; input: MailSearchInput }) => (await execute(UpdateMailSearchDocument, variables)).updateMailSearch),
    remove: useMailMutation(async (id: string) => (await execute(DeleteMailSearchDocument, { id })).deleteMailSearch),
  };
}

/**
 * Flags of mails.
 * @returns {UseQueryResult} Query state.
 */
export function useMailLabels() {
  return useQuery({ queryKey: [...mailQueryKey, 'labels'], queryFn: fetchLabels });
}

/**
 * Scheduled mails (refreshed every minute: they leave once sent).
 * @returns {UseQueryResult} Query state.
 */
export function useScheduledMails() {
  return useQuery({ queryKey: [...mailQueryKey, 'scheduled'], queryFn: fetchScheduled, refetchInterval: 60_000 });
}

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
 * Folders of an account, with their unread counts (fetched every 10 minutes).
 * @param {string | null} accountId Account.
 * @returns {UseQueryResult} Query state.
 */
export function useMailFolders(accountId: string | null) {
  return useQuery({
    queryKey: [...mailQueryKey, 'folders', accountId],
    queryFn: async () => (await execute(MailFoldersDocument, { accountId: accountId! })).mailFolders,
    enabled: accountId !== null,
    refetchInterval: MAIL_CHECK_MS,
    retry: false,
  });
}

/**
 * A page of a folder, latest first (fetched every 10 minutes).
 * @param {object | null} params Account, folder, page and search; null when nothing is selected.
 * @returns {UseQueryResult} Query state.
 */
export function useMailMessages(
  params: { accountId: string; folder: string; page: number; search: string; state?: 'all' | 'todo' | 'done'; sort?: string; ascending?: boolean } | null,
) {
  return useQuery({
    queryKey: [...mailQueryKey, 'messages', params],
    queryFn: async () => (await execute(MailMessagesDocument, params!)).mailMessages,
    enabled: params !== null,
    placeholderData: keepPreviousData,
    refetchInterval: MAIL_CHECK_MS,
    retry: false,
  });
}

/**
 * Unread mails of the inbox of every account, latest first (fetched every 10 minutes).
 * @param {string[]} accountIds Accounts.
 * @returns {{ data: { accountId: string, message: object }[] | undefined, isPending: boolean, error: Error | null }} Mails, loading state and first error.
 */
export function useUnreadMails(accountIds: string[]) {
  return useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: [...mailQueryKey, 'unread-messages', accountId],
      queryFn: async () => (await execute(MailMessagesDocument, { accountId, folder: 'INBOX', page: 0, search: '', unread: true })).mailMessages,
      refetchInterval: MAIL_CHECK_MS,
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
 * Unread mails in every inbox, for the sidebar (fetched every 10 minutes).
 * @param {boolean} enabled Whether accounts exist.
 * @returns {UseQueryResult} Query state.
 */
export function useUnreadMailCount(enabled: boolean) {
  return useQuery({
    queryKey: [...mailQueryKey, 'unread'],
    queryFn: async () => (await execute(UnreadMailCountDocument)).unreadMailCount,
    enabled,
    refetchInterval: MAIL_CHECK_MS,
    retry: false,
  });
}

/**
 * Mails to do in every account (every folder but drafts, sent, archive, junk and trash), for the sidebar
 * (fetched every 10 minutes).
 * @param {boolean} enabled Whether accounts exist.
 * @returns {UseQueryResult} Query state.
 */
export function useTodoMailCount(enabled: boolean) {
  return useQuery({
    queryKey: [...mailQueryKey, 'todo'],
    queryFn: async () => (await execute(TodoMailCountDocument)).todoMailCount,
    enabled,
    refetchInterval: MAIL_CHECK_MS,
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
    mark: useMailMutation(
      async (variables: { accountId: string; folder: string; uids: number[]; labelId?: string; on?: boolean; done?: boolean }) =>
        (await execute(MarkMailsDocument, variables)).markMails,
    ),
    spam: useMailMutation(
      async (variables: { accountId: string; folder: string; uids: number[]; spam: boolean }) => (await execute(ReportMailSpamDocument, variables)).reportMailSpam,
    ),
    move: useMailMutation(
      async (variables: { accountId: string; folder: string; uids: number[]; target: string }) => (await execute(MoveMailsDocument, variables)).moveMails,
    ),
    schedule: useMailMutation(async (variables: { input: SendMailInput; sendAt: string }) => (await execute(ScheduleMailDocument, variables)).scheduleMail),
    sendScheduled: useMailMutation(async (id: string) => (await execute(SendScheduledMailDocument, { id })).sendScheduledMail),
    cancelScheduled: useMailMutation(async (id: string) => (await execute(CancelScheduledMailDocument, { id })).cancelScheduledMail),
  };
}

/**
 * Folders of an account: create, rename, delete.
 * @returns {object} Mutations.
 */
export function useMailFolderMutations() {
  return {
    create: useMailMutation(
      async (variables: { accountId: string; parent: string | null; name: string }) => (await execute(CreateMailFolderDocument, variables)).createMailFolder,
    ),
    rename: useMailMutation(
      async (variables: { accountId: string; path: string; name: string }) => (await execute(RenameMailFolderDocument, variables)).renameMailFolder,
    ),
    remove: useMailMutation(async (variables: { accountId: string; path: string }) => (await execute(DeleteMailFolderDocument, variables)).deleteMailFolder),
    move: useMailMutation(
      async (variables: { accountId: string; path: string; parent: string | null }) => (await execute(MoveMailFolderDocument, variables)).moveMailFolder,
    ),
  };
}

/**
 * Flags of mails: create, update, delete.
 * @returns {object} Mutations.
 */
export function useMailLabelMutations() {
  return {
    create: useMailMutation(async (variables: { name: string; color: string }) => (await execute(CreateMailLabelDocument, variables)).createMailLabel),
    update: useMailMutation(async (variables: { id: string; name: string; color: string }) => (await execute(UpdateMailLabelDocument, variables)).updateMailLabel),
    remove: useMailMutation(async (id: string) => (await execute(DeleteMailLabelDocument, { id })).deleteMailLabel),
  };
}

/**
 * Fetches the mails now ("Relever"): the mail views reload (folders, lists, counts) and the new mails are announced.
 * @returns {{ refresh: () => void, fetching: boolean }} Fetch, and whether mails are being fetched.
 */
export function useMailRefresh() {
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: mailQueryKey }) > 0;
  return {
    refresh: () => {
      requestMailCheck();
      void queryClient.invalidateQueries({ queryKey: mailQueryKey });
    },
    fetching,
  };
}
