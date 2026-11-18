import { END_AFTER_START, endsAfter, monthOfDay } from '@ordo/shared';
import type { UseFormReturnType } from '@mantine/form';
import type { FocusEventHandler, ReactNode } from 'react';

/** A bound of a period: a day (YYYY-MM-DD), a month (YYYY-MM), a time (HH:mm) or an instant; empty when null or ''. */
type Bound = string | null;

/** Side of a period. */
export type RangeSide = 'start' | 'end';

/** Start and end of a period, bound to where they are kept (a form, a draft, a saved item…). */
export interface RangeBinding<B extends Bound = Bound> {
  /** Start and end. */
  value: readonly [B, B];
  /** Called with both bounds once one changed (the other one following, see `followBounds`). */
  onChange: (next: [B, B]) => void;
  /** Errors of each bound (the form's); without one on the end, an end before the start gets END_AFTER_START. Optional. */
  errors?: readonly [ReactNode?, ReactNode?];
  /** Blur handlers of each bound (the form validation on blur). Optional. */
  onBlur?: readonly [FocusEventHandler | undefined, FocusEventHandler | undefined];
}

/** Props of one bound's input: its value, change, error and blur. */
export interface BoundProps<B extends Bound> {
  value: B;
  onChange: (value: B) => void;
  error?: ReactNode;
  onBlur?: FocusEventHandler;
}

/** Props of one bound's date picker: the bound props, and the days it may take. */
export interface DateBoundProps<B extends Bound> extends BoundProps<B> {
  minDate?: string;
  maxDate?: string;
}

/**
 * Bounds of a period once one of them changed: a start set after the end moves the end to it, an end set before the
 * start moves the start to it (decision Q).
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
 * Props of the two inputs of a period: each change moves the other bound when they cross, the end shows
 * END_AFTER_START when before the start.
 * @param {RangeBinding<B>} binding Where the bounds are kept.
 * @param {boolean} [strict=false] The end must come strictly after (times). Optional. Default = false.
 * @returns {{ start: BoundProps<B>, end: BoundProps<B> }} Props of the start and end inputs.
 */
export function rangeProps<B extends Bound>({ value, onChange, errors, onBlur }: RangeBinding<B>, strict = false): { start: BoundProps<B>; end: BoundProps<B> } {
  const [start, end] = value;
  return {
    start: { value: start, onChange: (next) => onChange(followBounds(value, 'start', next)), error: errors?.[0], onBlur: onBlur?.[0] },
    end: { value: end, onChange: (next) => onChange(followBounds(value, 'end', next)), error: errors?.[1] ?? rangeError(start, end, strict), onBlur: onBlur?.[1] },
  };
}

/** Days every bound of a date period may take, and its kind. */
export interface DateRangeOptions {
  /** First day possible (YYYY-MM-DD). Optional. */
  min?: string;
  /** Last day possible (YYYY-MM-DD). Optional. */
  max?: string;
  /** The bounds are months (YYYY-MM), for month pickers. Optional. */
  month?: boolean;
}

/**
 * Props of the two date pickers of a period (DatePickerInput, MonthPickerInput, DateTimePicker): as `rangeProps`,
 * and the end cannot be picked before the start (decision Q). Spread into each picker: `{...range.start}`.
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
 * Period kept in two fields of a Mantine form: their values, both set at once, their errors and their validation on blur.
 * @param {UseFormReturnType<V>} form Form.
 * @param {keyof V & string} startKey Field of the start.
 * @param {keyof V & string} endKey Field of the end.
 * @returns {RangeBinding<B>} Binding, for `dateRangeProps` / `rangeProps`.
 */
export function formRange<V, B extends Bound = Bound>(form: UseFormReturnType<V>, startKey: keyof V & string, endKey: keyof V & string): RangeBinding<B> {
  const start = form.getInputProps(startKey);
  const end = form.getInputProps(endKey);
  return {
    value: [start.value as B, end.value as B],
    onChange: ([first, last]) => form.setValues({ [startKey]: first, [endKey]: last } as Partial<V>),
    errors: [start.error as ReactNode, end.error as ReactNode],
    onBlur: [start.onBlur as FocusEventHandler, end.onBlur as FocusEventHandler],
  };
}
