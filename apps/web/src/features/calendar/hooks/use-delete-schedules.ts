import { deleteItemsAction } from '../../../components/data-table/selection/selection-actions';
import { useActiveWorkspace } from '../../workspaces/api';
import { useWorkScheduleMutations, type WorkSchedule } from '../api';

/** What a deletion of a schedule needs: its id, its label, its nature. */
type DeletedSchedule = Pick<WorkSchedule, 'id' | 'label'> & { ephemeris?: boolean };

/**
 * « Supprimer » of schedules (créneaux or éphémérides, in their words), the same in their manager and in the calendar
 * (« Toutes » of an occurrence): confirmed with their risks, then deleted, the occurrences of routines they make
 * disappear confirmed too (`remove`, `withLossConfirmation`).
 * @returns {(schedules: readonly DeletedSchedule[], clear?: () => void) => ReturnType<typeof deleteItemsAction>} Action of some schedules (of one nature).
 */
export function useDeleteSchedules() {
  const { remove } = useWorkScheduleMutations();
  const { perso } = useActiveWorkspace();
  return (schedules: readonly DeletedSchedule[], clear?: () => void) => {
    const ephemeris = schedules[0]?.ephemeris ?? false;
    return deleteItemsAction([...schedules], {
      noun: ephemeris ? 'éphéméride' : 'créneau',
      many: ephemeris ? 'éphémérides' : 'créneaux',
      the: ephemeris ? 'l’éphéméride' : 'le créneau',
      label: (schedule) => schedule.label,
      risks: (subject, one) =>
        `${subject} et ${one ? 'ses' : 'leurs'} exceptions seront supprimés définitivement${perso || ephemeris ? '' : ` : ${one ? 'il ne comptera' : 'ils ne compteront'} plus dans le temps prévu`}. Les autres espaces abonnés ne ${one ? 'le' : 'les'} verront plus. Les évènements ne sont pas touchés.`,
      remove: (schedule) => remove.mutateAsync(schedule.id),
      clear,
    });
  };
}
