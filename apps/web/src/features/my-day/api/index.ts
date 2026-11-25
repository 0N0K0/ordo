import type { MyDaySettings } from '@ordo/shared';
import { useQuery } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import { execute } from '../../../lib/graphql-client';
import { useInvalidatingMutation } from '../../../lib/mutation';

graphql(`
  fragment MyDaySettingsFields on MyDaySettings {
    showRoutines
    showTasks
    showEvents
    showEphemerides
    showBirthdays
    projectIds
    withoutProject
    mineOrUnassigned
    showDone
    showCancelled
    hiddenSlotIds
    hiddenSlotKinds
  }
`);

const MyDaySettingsDocument = graphql(`
  query MyDaySettings {
    myDaySettings {
      ...MyDaySettingsFields
    }
  }
`);

const UpdateMyDaySettingsDocument = graphql(`
  mutation UpdateMyDaySettings($input: MyDaySettingsInput!) {
    updateMyDaySettings(input: $input) {
      ...MyDaySettingsFields
    }
  }
`);

/** Key of the settings of « Ma journée » (of the user, in the workspace of the window). */
export const myDaySettingsKey = ['my-day', 'settings'] as const;

/**
 * Settings of « Ma journée » of the user in the current workspace, as saved on the server (the defaults when none
 * were saved).
 * @returns {UseQueryResult<MyDaySettings>} Query state.
 */
export function useMyDaySettings() {
  return useQuery({
    queryKey: myDaySettingsKey,
    queryFn: async (): Promise<MyDaySettings> => (await execute(MyDaySettingsDocument)).myDaySettings,
  });
}

/**
 * Saves the settings of « Ma journée » of the user in the current workspace, as a whole: shown at once, put back as they
 * were when the save fails (the caller tells the error).
 * @returns {UseMutationResult<MyDaySettings, Error, MyDaySettings>} Mutation state.
 */
export function useSaveMyDaySettings() {
  return useInvalidatingMutation(async (input: MyDaySettings): Promise<MyDaySettings> => (await execute(UpdateMyDaySettingsDocument, { input })).updateMyDaySettings, {
    invalidate: [myDaySettingsKey],
    optimistic: (queryClient, input) => queryClient.setQueryData(myDaySettingsKey, input),
    background: true,
  });
}
