import { ArrowsLeftRightIcon } from '@phosphor-icons/react';
import { countOf } from '../../../lib/text';
import type { RowAction } from '../../../components/actions/ActionsMenu';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { useWorkScheduleMutations } from '../api';

/** What a créneau counts in, and an éphéméride does not (lot 16). */
const SLOT_ONLY = 'le temps libre des conditions de créneaux, les heures de travail (temps prévu, avertissement « hors des heures de travail »)';

/**
 * « Convertir en éphéméride » / « Convertir en créneau » of a schedule, and of a whole kind (lot 16): entries of their
 * « … » menus (the lists, and the panel of a slot opened from the agenda: decision FX), asked first with what changes in meaning (the free time, the working hours, its kind), then the
 * occurrences of routines lost confirmed as for any change of the schedules. Ids stay: the slot conditions naming the
 * schedule or its kind keep it. Read only once archived; a kind serving as a budget context stays one of éphémérides.
 * @returns {{ schedule: Function, type: Function }} Entries.
 */
export function useScheduleConversion() {
  const { setEphemeris, setTypeEphemeris } = useWorkScheduleMutations();
  return {
    /**
     * Entry converting a schedule; a schedule of a kind leaves it (a kind is one nature or the other).
     * @param {{ id: string, label: string, ephemeris: boolean, archived: boolean }} schedule Schedule.
     * @param {{ label: string } | undefined} type Its kind, if any.
     * @param {() => void} [onDone] Once converted (the panel of a slot closes: what it holds is no longer the schedule). Optional.
     * @returns {RowAction} Entry.
     */
    schedule: (schedule: { id: string; label: string; ephemeris: boolean; archived: boolean }, type: { label: string } | undefined, onDone?: () => void): RowAction => {
      const toEphemeris = !schedule.ephemeris;
      const label = toEphemeris ? 'Convertir en éphéméride' : 'Convertir en créneau';
      const kind = type ? ` Il quitte son type « ${type.label} » (un type est tout de créneaux ou tout d’éphémérides) : les conditions qui citent ce type ne le comptent plus.` : '';
      return {
        label,
        icon: <ArrowsLeftRightIcon aria-hidden />,
        disabled: schedule.archived,
        onClick: () =>
          confirmDestructive({
            title: label,
            reversible: true,
            confirmLabel: 'Convertir',
            confirmIcon: <ArrowsLeftRightIcon aria-hidden />,
            risks: toEphemeris
              ? `« ${schedule.label} » devient une éphéméride : elle ne compte plus dans ${SLOT_ONLY}.${kind} Les conditions qui la citent par son nom la gardent.`
              : `« ${schedule.label} » devient un créneau : il compte dans ${SLOT_ONLY}.${kind} Les conditions qui le citent par son nom le gardent.`,
            run: async () => {
              await setEphemeris.mutateAsync({ id: schedule.id, ephemeris: toEphemeris });
              onDone?.();
            },
            done: toEphemeris ? 'Converti en éphéméride.' : 'Convertie en créneau.',
          }),
      };
    },
    /**
     * Entry converting a whole kind, its schedules with it.
     * @param {{ id: string, label: string, ephemeris: boolean, budgetContext: boolean, archived: boolean }} type Kind.
     * @param {number} count Its schedules.
     * @returns {RowAction} Entry.
     */
    type: (type: { id: string; label: string; ephemeris: boolean; budgetContext: boolean; archived: boolean }, count: number): RowAction => {
      const toEphemeris = !type.ephemeris;
      const label = toEphemeris ? 'Convertir en type d’éphémérides' : 'Convertir en type de créneaux';
      const schedules = countOf(count, toEphemeris ? 'créneau' : 'éphéméride', toEphemeris ? 'créneaux' : 'éphémérides');
      return {
        label,
        icon: <ArrowsLeftRightIcon aria-hidden />,
        disabled: type.archived || (!toEphemeris && type.budgetContext),
        hint: !toEphemeris && type.budgetContext ? 'Il sert de contexte au budget : retirez d’abord « Sert de contexte au budget ».' : undefined,
        onClick: () =>
          confirmDestructive({
            title: label,
            reversible: true,
            confirmLabel: 'Convertir',
            confirmIcon: <ArrowsLeftRightIcon aria-hidden />,
            risks: `Le type « ${type.label} » et ses ${schedules} deviennent ${toEphemeris ? 'des éphémérides : ils ne comptent plus' : 'des créneaux : ils comptent'} dans ${SLOT_ONLY}. Les conditions qui citent le type ou ses éléments les gardent.`,
            run: () => setTypeEphemeris.mutateAsync({ id: type.id, ephemeris: toEphemeris }),
            done: 'Type converti.',
          }),
      };
    },
  };
}
