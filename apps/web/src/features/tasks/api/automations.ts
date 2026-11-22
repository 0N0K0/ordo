import { useQuery } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import type { TaskAutomationFieldsFragment, TaskAutomationInput, TaskAutomationPatch } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { taskAutomationsQueryKey } from '../../../lib/query-keys';

/** An automation of the tasks (« quand … alors … ») of the workspace. */
export type TaskAutomation = TaskAutomationFieldsFragment;
export type { TaskAutomationInput, TaskAutomationPatch };

graphql(`
  fragment TaskAutomationFields on TaskAutomation {
    id
    label
    color
    iconUrl
    position
    archived
    enabled
    trigger
    condition
    actions
  }
`);

const TaskAutomationsDocument = graphql(`
  query TaskAutomations {
    taskAutomations {
      ...TaskAutomationFields
    }
  }
`);

const CreateTaskAutomationDocument = graphql(`
  mutation CreateTaskAutomation($input: TaskAutomationInput!) {
    createTaskAutomation(input: $input) {
      id
    }
  }
`);

const UpdateTaskAutomationDocument = graphql(`
  mutation UpdateTaskAutomation($id: ID!, $input: TaskAutomationPatch!) {
    updateTaskAutomation(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteTaskAutomationDocument = graphql(`
  mutation DeleteTaskAutomation($id: ID!) {
    deleteTaskAutomation(id: $id)
  }
`);

export { taskAutomationsQueryKey };

/**
 * Automations of the tasks of the workspace, in their order (archived ones included).
 * @returns {UseQueryResult<TaskAutomation[]>} Query state.
 */
export function useTaskAutomations() {
  return useQuery({ queryKey: taskAutomationsQueryKey, queryFn: async () => (await execute(TaskAutomationsDocument)).taskAutomations });
}

/**
 * Creation, change and deletion of the automations of the tasks.
 * @returns {object} Mutations.
 */
export function useTaskAutomationMutations() {
  const invalidate = [taskAutomationsQueryKey];
  return {
    create: useInvalidatingMutation(async (input: TaskAutomationInput) => (await execute(CreateTaskAutomationDocument, { input })).createTaskAutomation, { invalidate }),
    update: useInvalidatingMutation(async ({ id, input }: { id: string; input: TaskAutomationPatch }) => (await execute(UpdateTaskAutomationDocument, { id, input })).updateTaskAutomation, { invalidate }),
    remove: useInvalidatingMutation(async ({ id }: { id: string }) => (await execute(DeleteTaskAutomationDocument, { id })).deleteTaskAutomation, { invalidate }),
  };
}
