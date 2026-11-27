import * as fmt from '../../lib/format';

/** What tells the real due day of an item apart from that of its rule. */
export interface RealDue {
  /** Real due day (YYYY-MM-DD): the one late state, lists and reminders read; null: none. */
  day: string | null;
  /** Due day of its rule (the stored « Échéance » of a task, the due day of the rule of an occurrence); null: none. */
  ruleDay: string | null;
  /** Why they differ, after the rule's day in the tooltip (« hors horaires », « hors créneaux »). */
  reason: string;
}

/**
 * Tooltip of a real due day that differs from that of its rule (« Échéance du dim. 29 nov., hors horaires »); null
 * when they are the same, or without a day on either side.
 * @param {RealDue} due Real due day, the rule's, the reason.
 * @returns {string | null} Tooltip.
 */
export const realDueTooltip = ({ day, ruleDay, reason }: RealDue): string | null => (day && ruleDay && day !== ruleDay ? `Échéance du ${fmt.weekday(ruleDay)}, ${reason}` : null);
