import type { UseFormReturnType } from '@mantine/form';
import type { ReactNode } from 'react';
import { parisDay, parisParts, parisToday, monthOfDay } from '../../lib/dates';

/** Name of the action that picks today, in every date picker. */
export const TODAY_LABEL = 'Aujourd’hui';

/** Name of the action that picks the current month, in every month picker. */
export const THIS_MONTH_LABEL = 'Ce mois-ci';

/** A preset of a Mantine picker: its value and its name. */
interface PickerPreset {
  value: string;
  label: string;
}

/**
 * Day of a bound given to a Mantine picker: a day, a date-time « YYYY-MM-DD HH:mm:ss » or an instant.
 * @param {string | Date} bound Bound.
 * @returns {string} Day (YYYY-MM-DD).
 */
export function pickerDay(bound: string | Date): string {
  return typeof bound === 'string' ? bound.split(' ')[0] : parisDay(bound);
}

/**
 * Days of a Mantine calendar with today marked in Paris: Mantine marks the day of the browser's zone, this one is the
 * day of the app (`data-today`, highlighted with `highlightToday`). The props of each day given are kept.
 * @param {(day: string) => P} [getDayProps] Props of each day. Optional. Default = none.
 * @returns {(day: string) => P & { 'data-today': true | undefined }} Props of each day.
 */
export function parisTodayDays<P extends object = object>(getDayProps?: (day: string) => P): (day: string) => P & { 'data-today': true | undefined } {
  return (day) => ({ ...(getDayProps?.(day) as P), 'data-today': day === parisToday() || undefined });
}

/**
 * Props of each day of a date picker greying the days some rule excludes (the « Horaires » of a task): still
 * choosable, only dimmed; the props given of each day kept.
 * @param {((day: string) => boolean) | undefined} excluded Whether a day is excluded (YYYY-MM-DD); none: no day greyed.
 * @param {(day: string) => P} [getDayProps] Props of each day. Optional. Default = none.
 * @returns {(day: string) => P} Props of each day.
 */
export function excludedDays<P extends object = object>(excluded: ((day: string) => boolean) | undefined, getDayProps?: (day: string) => P): (day: string) => P {
  return (day) => {
    const props = getDayProps?.(day) as P;
    return excluded?.(day) ? { ...props, style: { opacity: 0.4 } } : props;
  };
}

/**
 * « Aujourd'hui » of a date picker (Mantine `presets`), the same in each one: picks today (with a time for a date-time
 * picker); none when today cannot be picked.
 * @param {{ min?: string | Date | null, max?: string | Date | null, time?: string | null }} [options] Days possible, time of a date-time picker (HH:mm). Optional.
 * @returns {PickerPreset[] | undefined} Presets.
 */
export function todayPresets({ min, max, time }: { min?: string | Date | null; max?: string | Date | null; time?: string | null } = {}): PickerPreset[] | undefined {
  const today = parisToday();
  if ((min && pickerDay(min) > today) || (max && pickerDay(max) < today)) return undefined;
  if (time === undefined) return [{ value: today, label: TODAY_LABEL }];
  const moment = `${today} ${time ?? '00:00'}:00`;
  // A first moment of today given (« YYYY-MM-DD HH:mm:ss »): an earlier time of today is not offered.
  const earliest = typeof min === 'string' && min.includes(' ') ? min : null;
  return [{ value: earliest && earliest > moment ? earliest : moment, label: TODAY_LABEL }];
}

/** One minute, in ms. */
const MINUTE_MS = 60_000;

/**
 * Bound of a Mantine date-time picker from an instant: its day and time in Paris (« YYYY-MM-DD HH:mm:00 »), rounded up
 * to the minute (the pickers choose whole minutes: the bound is never before the instant).
 * @param {Date | number} instant Instant.
 * @returns {string} Bound.
 */
export function pickerMoment(instant: Date | number): string {
  const { date, time } = parisParts(new Date(Math.ceil(new Date(instant).getTime() / MINUTE_MS) * MINUTE_MS));
  return `${date} ${time}:00`;
}

/**
 * « Ce mois-ci » of a month picker (Mantine `presets`): picks the current month; none when it cannot be picked.
 * @param {{ min?: string | null, max?: string | null }} [options] First and last days possible (YYYY-MM-DD). Optional.
 * @returns {PickerPreset[] | undefined} Presets.
 */
export function thisMonthPresets({ min, max }: { min?: string | null; max?: string | null } = {}): PickerPreset[] | undefined {
  const month = monthOfDay(parisToday());
  if ((min && monthOfDay(min) > month) || (max && monthOfDay(max) < month)) return undefined;
  return [{ value: `${month}-01`, label: THIS_MONTH_LABEL }];
}

/** A day and its time of day, kept in two fields of a Mantine form, for `DateTimeField`. */
interface DateTimeBinding {
  day: string | null;
  time: string | null;
  onChange: (date: string | null, time: string | null) => void;
  error?: ReactNode;
  onBlur?: () => void;
}

/**
 * Day and time kept in two fields of a Mantine form: their values, both set at once, their error (the day's first) and
 * their validation on blur. Spread into a `DateTimeField`.
 * @param {UseFormReturnType<V>} form Form.
 * @param {keyof V & string} dateKey Field of the day (YYYY-MM-DD).
 * @param {keyof V & string} timeKey Field of the time (HH:mm).
 * @returns {DateTimeBinding} Props of the field.
 */
export function formDateTime<V>(form: UseFormReturnType<V>, dateKey: keyof V & string, timeKey: keyof V & string): DateTimeBinding {
  const date = form.getInputProps(dateKey);
  const time = form.getInputProps(timeKey);
  return {
    day: (date.value as string | null) || null,
    time: (time.value as string | null) || null,
    onChange: (day, hour) => form.setValues({ [dateKey]: day ?? '', [timeKey]: hour ?? '' } as Partial<V>),
    error: (date.error ?? time.error) as ReactNode,
    onBlur: () => {
      (date.onBlur as (() => void) | undefined)?.();
      (time.onBlur as (() => void) | undefined)?.();
    },
  };
}
