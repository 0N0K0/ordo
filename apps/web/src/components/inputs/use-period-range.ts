import { useState } from 'react';
import { parisToday } from '../../lib/dates';
import { presetRange, type PeriodPreset } from '../../lib/periods';

/** Period chosen in an export form: its preset, the dates typed for « Dates choisies », and the resulting days. */
export interface PeriodRange<P extends string> {
  /** Today (YYYY-MM-DD). */
  today: string;
  preset: P;
  setPreset(preset: P): void;
  /** Dates typed when the preset is « custom ». */
  custom: [string | null, string | null];
  setCustom: (custom: [string | null, string | null]) => void;
  /** First and last days of the period. */
  from: string | null;
  to: string | null;
  /** Both days are known and in order. */
  valid: boolean;
}

/**
 * Period of an export form: a preset (the previous month at first for typed dates), or dates typed.
 * @param {P} initial Preset chosen at first.
 * @param {(preset: P, today: string) => [string, string] | null} [resolve] Days of the presets of the form beyond PERIOD_PRESETS (null: a preset of PERIOD_PRESETS). Optional.
 * @returns {PeriodRange<P>} Period.
 */
export function usePeriodRange<P extends string = PeriodPreset>(initial: P, resolve?: (preset: P, today: string) => [string, string] | null): PeriodRange<P> {
  const today = parisToday();
  const [preset, setPreset] = useState<P>(initial);
  const [custom, setCustom] = useState<[string | null, string | null]>(() => presetRange('lastMonth', today));
  const [from, to] = preset === 'custom' ? custom : (resolve?.(preset, today) ?? presetRange(preset as Exclude<PeriodPreset, 'custom'>, today));
  return { today, preset, setPreset, custom, setCustom, from, to, valid: Boolean(from && to && from <= to) };
}
