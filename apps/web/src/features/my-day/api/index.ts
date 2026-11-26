import { readMyDaySettings, type MyDaySettings } from '@ordo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { graphql } from '../../../graphql';
import { execute } from '../../../lib/graphql-client';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { onMutationError } from '../../../lib/notify';

graphql(`
  fragment MyDaySettingsFields on MyDaySettings {
    tasks
    routines
    schedules
    hiddenCalendarIds
    hiddenScheduleIds
    filters
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
    queryFn: async (): Promise<MyDaySettings> => readMyDaySettings((await execute(MyDaySettingsDocument)).myDaySettings),
  });
}

/**
 * Saves the settings of « Ma journée » of the user in the current workspace, as a whole: shown at once, put back as they
 * were when the save fails (the caller tells the error). Saves made in a row wait for each other: one a newer one waits
 * behind is not sent (the newer one holds it), and the settings are read again after the last only.
 * @returns {UseMutationResult<MyDaySettings, Error, MyDaySettings>} Mutation state.
 */
export function useSaveMyDaySettings() {
  return useInvalidatingMutation(async (input: MyDaySettings): Promise<MyDaySettings> => readMyDaySettings((await execute(UpdateMyDaySettingsDocument, { input })).updateMyDaySettings), {
    invalidate: [myDaySettingsKey],
    optimistic: (queryClient, input) => queryClient.setQueryData(myDaySettingsKey, input),
    background: true,
    queue: { id: 'my-day-settings', superseded: (input) => input },
  });
}

/** Settings of a user who chose none. */
const NO_SETTINGS: MyDaySettings = readMyDaySettings(null);

/** A change of the settings: the fields changed, or how to change them from the settings as they are. */
export type MyDaySettingsChange = Partial<MyDaySettings> | ((current: MyDaySettings) => Partial<MyDaySettings>);

/**
 * Settings of « Ma journée » as the page shows them, and their change: a change is shown at once (the filters typed in
 * stay as typed) and builds on the one made just before, even while it is being saved, so that quick changes are all
 * kept; the whole set is saved (`useSaveMyDaySettings`), a failure of the last change told by a toast and the settings
 * saved shown again. Nothing changes before the saved settings are loaded (`ready`).
 * @returns {{ query: UseQueryResult<MyDaySettings>, ready: boolean, settings: MyDaySettings, change: (change: MyDaySettingsChange) => void }} Settings saved (query), loaded, shown, and their change.
 */
export function useMyDaySettingsState() {
  const queryClient = useQueryClient();
  const query = useMyDaySettings();
  const { mutateAsync } = useSaveMyDaySettings();
  // Settings asked last, until saved.
  const [wanted, setWanted] = useState<MyDaySettings | null>(null);
  const latest = useRef<MyDaySettings | null>(null);
  /**
   * Changes the settings and saves them.
   * @param {MyDaySettingsChange} asked Fields changed, or how to change them.
   * @returns {void}
   */
  const change = (asked: MyDaySettingsChange) => {
    // Not loaded yet: a change would save the defaults over the settings saved.
    if (!query.data && !latest.current) return;
    const current = latest.current ?? queryClient.getQueryData<MyDaySettings>(myDaySettingsKey) ?? NO_SETTINGS;
    const next = { ...current, ...(typeof asked === 'function' ? asked(current) : asked) };
    latest.current = next;
    setWanted(next);
    /**
     * Once the last change asked is saved or refused: the settings of the cache are shown again.
     * @returns {void}
     */
    const settle = () => {
      if (latest.current !== next) return;
      latest.current = null;
      setWanted(null);
    };
    void mutateAsync(next).then(settle, (error: Error) => {
      // A newer change waiting sends this one too: only the failure of the last one asked is told.
      if (latest.current !== next) return;
      settle();
      onMutationError(error);
    });
  };
  return { query, ready: query.data !== undefined, settings: wanted ?? query.data ?? NO_SETTINGS, change };
}
