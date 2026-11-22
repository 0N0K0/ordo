import { END_AFTER_START, endsAfter } from '@ordo/shared';
import type { UseFormReturnType } from '@mantine/form';
import type { FocusEventHandler, ReactNode } from 'react';
import { monthOfDay } from '../../lib/dates';

/** A bound of a period: a day (YYYY-MM-DD), a month (YYYY-MM), a time (HH:mm) or an instant; empty when null or ''. */
type Bound = string | null;

/** Side of a period. */
type RangeSide = 'start' | 'end';

/** Times of day (HH:mm) of the start and the end of a date-time period; empty when null. */
export type RangeTimes = readonly [string | null, string | null];

/** Start and end of a period, bound to where they are kept (a form, a draft, a saved item…). */
export interface RangeBinding<B extends Bound = Bound> {
  /** Start and end. */
  value: readonly [B, B];
  /** Called with both bounds once one changed (the other one following, see `followBounds`), and their times for a date-time period. */
  onChange: (next: [B, B], times?: [string | null, string | null]) => void;
  /** Times of the start and the end, for a date-time period (`PeriodField`). Optional. */
  times?: RangeTimes;
  /** Errors of each bound (the form's); without one on the end, an end before the start gets END_AFTER_START. Optional. */
  errors?: readonly [ReactNode?, ReactNode?];
  /** Blur handlers of each bound (the form validation on blur). Optional. */
  onBlur?: readonly [(() => void) | undefined, (() => void) | undefined];
}

/** Props of one bound's input: its value, change, error and blur. */
interface BoundProps<B extends Bound> {
  value: B;
  onChange: (value: B) => void;
  error?: ReactNode;
  onBlur?: FocusEventHandler;
}

/** Props of one bound's date picker: the bound props, and the days it may take. */
interface DateBoundProps<B extends Bound> extends BoundProps<B> {
  minDate?: string;
  maxDate?: string;
}

/**
 * Bounds of a period once one of them changed: a start set after the end moves the end to it, an end set before the
 * start moves the start to it.
 * @param {readonly [B, B]} bounds Start and end before.
 * @param {RangeSide} side Bound changed.
 * @param {B} value Its new value.
 * @returns {[B, B]} Start and end after.
 */
export function followBounds<B extends Bound>([start, end]: readonly [B, B], side: RangeSide, value: B): [B, B] {
  if (side === 'start') return [value, value && end && value > end ? value : end];
  return [start && value && value < start ? value : start, value];
}

/**
 * Error of a period whose end comes before its start (« La fin doit suivre le début. »), else none.
 * @param {Bound | undefined} start Start.
 * @param {Bound | undefined} end End.
 * @param {boolean} [strict=false] The end must come strictly after (times). Optional. Default = false.
 * @returns {string | undefined} Error.
 */
export function rangeError(start: Bound | undefined, end: Bound | undefined, strict = false): string | undefined {
  return endsAfter(start, end, strict) ? undefined : END_AFTER_START;
}

/**
 * Props of the two inputs of a period: a change moves the other bound when they cross, the end shows END_AFTER_START
 * when before the start. Typed bounds (times: each key stroke is a change, « 1 » of « 10:00 » reads 01:00) move the
 * other one only when the field is left (`onLeave`), never while typing; picked bounds (days) at once.
 * @param {RangeBinding<B>} binding Where the bounds are kept.
 * @param {boolean} [strict=false] The end must come strictly after (times). Optional. Default = false.
 * @param {boolean} [onLeave=false] The other bound follows when the field is left, not on each change (typed times). Optional. Default = false.
 * @returns {{ start: BoundProps<B>, end: BoundProps<B> }} Props of the start and end inputs.
 */
export function rangeProps<B extends Bound>({ value, onChange, errors, onBlur }: RangeBinding<B>, strict = false, onLeave = false): { start: BoundProps<B>; end: BoundProps<B> } {
  const [start, end] = value;
  /**
   * Props of one bound.
   * @param {RangeSide} side Bound.
   * @returns {Pick<BoundProps<B>, 'onChange' | 'onBlur'>} Its change and its leaving.
   */
  const bound = (side: RangeSide): Pick<BoundProps<B>, 'onChange' | 'onBlur'> => {
    const index = side === 'start' ? 0 : 1;
    const left = onBlur?.[index];
    if (!onLeave) return { onChange: (next) => onChange(followBounds(value, side, next)), onBlur: left };
    return {
      onChange: (next) => onChange(side === 'start' ? [next, end] : [start, next]),
      onBlur: () => {
        const followed = followBounds(value, side, value[index]);
        if (followed[0] !== start || followed[1] !== end) onChange(followed);
        // Once the bounds are set: what follows leaving the field (a save) reads them.
        if (left) queueMicrotask(left);
      },
    };
  };
  return {
    start: { value: start, ...bound('start'), error: errors?.[0] },
    end: { value: end, ...bound('end'), error: errors?.[1] ?? rangeError(start, end, strict) },
  };
}

/** Days every bound of a date period may take, and its kind. */
interface DateRangeOptions {
  /** First day possible (YYYY-MM-DD). Optional. */
  min?: string;
  /** Last day possible (YYYY-MM-DD). Optional. */
  max?: string;
  /** The bounds are months (YYYY-MM), for month pickers. Optional. */
  month?: boolean;
}

/**
 * Props of the two date pickers of a period kept in two fields (a cell per bound, `MonthField`): as `rangeProps`,
 * and the end cannot be picked before the start. Spread into each picker: `{...range.start}`.
 * @param {RangeBinding} binding Where the bounds are kept (a picker may give null).
 * @param {DateRangeOptions} [options] Days possible, months. Optional.
 * @returns {{ start: DateBoundProps<Bound>, end: DateBoundProps<Bound> }} Props of the start and end pickers.
 */
export function dateRangeProps(binding: RangeBinding, { min, max, month = false }: DateRangeOptions = {}): { start: DateBoundProps<Bound>; end: DateBoundProps<Bound> } {
  const toPicker = (bound: Bound) => (month && bound ? `${bound}-01` : bound);
  const fromPicker = (picked: Bound) => (month && picked ? monthOfDay(picked) : picked);
  const { start, end } = rangeProps(binding);
  const first = toPicker(binding.value[0]);
  return {
    start: { ...start, value: toPicker(start.value), onChange: (picked) => start.onChange(fromPicker(picked)), minDate: min, maxDate: max },
    end: { ...end, value: toPicker(end.value), onChange: (picked) => end.onChange(fromPicker(picked)), minDate: first && (!min || first > min) ? first : min, maxDate: max },
  };
}

/**
 * Period kept in fields of a Mantine form: its days (and their times for a date-time period), all set at once, their
 * errors (a time's when its day has none) and their validation on blur.
 * @param {UseFormReturnType<V>} form Form.
 * @param {keyof V & string} startKey Field of the start.
 * @param {keyof V & string} endKey Field of the end.
 * @param {readonly [keyof V & string, keyof V & string]} [timeKeys] Fields of the times of the start and the end (HH:mm). Optional.
 * @returns {RangeBinding<B>} Binding, for `PeriodField` / `dateRangeProps` / `rangeProps`.
 */
export function formRange<V, B extends Bound = Bound>(
  form: UseFormReturnType<V>,
  startKey: keyof V & string,
  endKey: keyof V & string,
  timeKeys?: readonly [keyof V & string, keyof V & string],
): RangeBinding<B> {
  const start = form.getInputProps(startKey);
  const end = form.getInputProps(endKey);
  const times = timeKeys?.map((key) => form.getInputProps(key));
  return {
    value: [start.value as B, end.value as B],
    ...(times && { times: [(times[0].value as string | null) || null, (times[1].value as string | null) || null] as const }),
    onChange: ([first, last], hours) =>
      form.setValues({ [startKey]: first, [endKey]: last, ...(timeKeys && hours ? { [timeKeys[0]]: hours[0], [timeKeys[1]]: hours[1] } : {}) } as Partial<V>),
    errors: [(start.error ?? times?.[0].error) as ReactNode, (end.error ?? times?.[1].error) as ReactNode],
    onBlur: [
      () => {
        (start.onBlur as (() => void) | undefined)?.();
        (times?.[0].onBlur as (() => void) | undefined)?.();
      },
      () => {
        (end.onBlur as (() => void) | undefined)?.();
        (times?.[1].onBlur as (() => void) | undefined)?.();
      },
    ],
  };
}
