import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { graphql } from '../../graphql';
import type { CommentTarget } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type { CommentTarget };

export const commentsKey = ['comments'] as const;

const CommentsDocument = graphql(`
  query Comments($target: CommentTarget!, $id: String!) {
    comments(target: $target, id: $id) {
      id
      body
      createdAt
    }
  }
`);

const CommentCountsDocument = graphql(`
  query CommentCounts($target: CommentTarget!, $ids: [String!]!) {
    commentCounts(target: $target, ids: $ids) {
      id
      count
    }
  }
`);

const AddCommentDocument = graphql(`
  mutation AddComment($target: CommentTarget!, $id: String!, $body: String!) {
    addComment(target: $target, id: $id, body: $body) {
      id
    }
  }
`);

const UpdateCommentDocument = graphql(`
  mutation UpdateComment($id: ID!, $body: String!) {
    updateComment(id: $id, body: $body) {
      id
    }
  }
`);

const DeleteCommentDocument = graphql(`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`);

/**
 * Comments of an item, oldest first.
 * @param {CommentTarget} target Kind of item.
 * @param {string | null} id Item (Message-ID for a mail); none: nothing loaded.
 * @returns {UseQueryResult} Query state.
 */
export function useComments(target: CommentTarget, id: string | null) {
  return useQuery({
    queryKey: [...commentsKey, target, id],
    queryFn: async () => (await execute(CommentsDocument, { target, id: id! })).comments,
    enabled: id !== null,
  });
}

/**
 * Number of comments of items of a kind, by id (descriptions not counted).
 * @param {CommentTarget} target Kind of items.
 * @param {readonly string[]} ids Items.
 * @returns {Map<string, number>} Counts.
 */
export function useCommentCounts(target: CommentTarget, ids: readonly string[]): Map<string, number> {
  const sorted = [...new Set(ids)].sort();
  const { data } = useQuery({
    queryKey: [...commentsKey, 'counts', target, sorted],
    queryFn: async () => (await execute(CommentCountsDocument, { target, ids: sorted })).commentCounts,
    enabled: sorted.length > 0,
    placeholderData: (previous) => previous,
  });
  // The same map while the counts stay the same (a dependency of the tables).
  return useMemo(() => new Map((data ?? []).map((item) => [item.id, item.count])), [data]);
}

/**
 * Adding, changing and deleting comments (every count and thread refreshed after).
 * @returns {object} Mutations.
 */
export function useCommentMutations() {
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: commentsKey });
  return {
    add: useMutation({ mutationFn: (variables: { target: CommentTarget; id: string; body: string }) => execute(AddCommentDocument, variables), onSettled }),
    update: useMutation({ mutationFn: (variables: { id: string; body: string }) => execute(UpdateCommentDocument, variables), onSettled }),
    remove: useMutation({ mutationFn: (id: string) => execute(DeleteCommentDocument, { id }), onSettled }),
  };
}
