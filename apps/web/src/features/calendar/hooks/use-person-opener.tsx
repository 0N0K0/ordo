import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useTasksData } from '../../tasks/api';
import { treasurySettingsQuery } from '../../treasury/api';
import { openRelationForm } from '../../treasury/lib/open-relation';
import { openMemberForm } from '../../treasury/lib/open-member';
import { useActiveWorkspace } from '../../workspaces/api';

/** Person a birthday is of (query `birthdays`): a relation (maybe also a contributor) or a member of the team or household. */
export interface BirthdayPerson {
  contributorId?: string | null;
  relationId?: string | null;
}

/**
 * Opener of the panel of the person of a birthday, where its birth date is edited: its relation (the treasury settings
 * fetched when not loaded yet), else its member's form. Nothing when it is gone.
 * @returns {(person: BirthdayPerson) => void} Opener.
 */
export function usePersonOpener(): (person: BirthdayPerson) => void {
  const queryClient = useQueryClient();
  const { data } = useTasksData();
  const { perso } = useActiveWorkspace();
  return useCallback(
    (person: BirthdayPerson) => {
      if (person.relationId) {
        void queryClient.ensureQueryData(treasurySettingsQuery).then((settings) => {
          const relation = settings.treasuryRelations.find((item) => item.id === person.relationId);
          if (relation) openRelationForm(relation, perso);
        });
        return;
      }
      const contributor = data?.contributors.find((item) => item.id === person.contributorId);
      if (contributor) openMemberForm(contributor);
    },
    [queryClient, data, perso],
  );
}
