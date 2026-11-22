import type { ScheduleCase } from '@ordo/shared';
import { describeScheduleCase } from '../../calendar/lib/schedule-text';

/**
 * « Horaires » of a task in words, a line per case (« Toutes les semaines du lundi au vendredi · 09:00–12:00,
 * 14:00–17:00 »); none: no line.
 * @param {readonly ScheduleCase[]} hours Hours.
 * @param {string} start Day their rules are told from (YYYY-MM-DD).
 * @returns {string[]} Lines.
 */
export const taskHoursLines = (hours: readonly ScheduleCase[], start: string): string[] => hours.map((item) => describeScheduleCase(item, start));

/**
 * « Horaires » of a task as one short text (its cases separated by « ; »), as its column shows, filters, sorts and
 * exports them; none: empty.
 * @param {readonly ScheduleCase[]} hours Hours.
 * @param {string} start Day their rules are told from (YYYY-MM-DD).
 * @returns {string} Text.
 */
export const taskHoursText = (hours: readonly ScheduleCase[], start: string): string => taskHoursLines(hours, start).join(' ; ');
