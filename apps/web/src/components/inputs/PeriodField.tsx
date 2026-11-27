import { Input, Popover, SegmentedControl, SimpleGrid, Stack, Text, type MantineSize, type PopoverProps } from '@mantine/core';
import { DatePicker, TimePicker } from '@mantine/dates';
import { CalendarBlankIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { parisToday } from '../../lib/dates';
import { ActionButton } from '../actions/ActionButton';
import { InheritanceNote, type InheritedFieldState } from '../inheritance/InheritedField';
import inheritedClasses from '../inheritance/InheritedField.module.css';
import { excludedDays, parisTodayDays, todayPresets } from './date-fields';
import type { RangeBinding } from './date-range';
import classes from './PeriodField.module.css';
import { boundText, PERIOD_BOUNDS, PERIOD_OPEN_BOUNDS, periodError, pickPeriodDay, type PeriodDraft, type PeriodSide } from './period-field';

/** Inheritance of one bound of a period (a task's « Ouverture » or « Échéance »): what `InheritanceNote` shows, and the parent. */
export interface PeriodBoundInheritance extends InheritedFieldState {
  /** Name of the parent the value comes from. */
  from: string;
}

/** Pair of values, one per bound (start, end). */
type PerBound<T> = readonly [T, T];

/** Props of `PeriodField`. */
export interface PeriodFieldProps extends RangeBinding<string | null> {
  label?: ReactNode;
  'aria-label'?: string;
  description?: ReactNode;
  /** Text of the field without any bound. Optional. Default = « — ». */
  placeholder?: string;
  /** Bounds that must be given: both (true), the start or the end only. Optional. Default = none. */
  required?: boolean | PeriodSide;
  /** Names of the bounds. Optional. Default = « Début » / « Fin ». */
  bounds?: PerBound<string>;
  /** Words of an empty bound. Optional. Default = « Dès le début » / « Jusqu’à la fin ». */
  openBounds?: PerBound<string>;
  /** What an empty bound goes by, shown greyed in its place (an inherited day: « 12 nov. 2026 (parent) »). Optional. */
  hints?: PerBound<string | null | undefined>;
  /** Inheritance of each bound: its mention and « Vider » / « Rétablir l'héritage » under the field. Optional. */
  inheritance?: PerBound<PeriodBoundInheritance | undefined>;
  /** First and last days possible (YYYY-MM-DD). Optional. */
  min?: string;
  max?: string;
  /** One day, the two times on it (a slot). Optional. */
  sameDay?: boolean;
  /** Moving the start moves the end by as many days. Optional. */
  keepLength?: boolean;
  /** The times may stay empty (« dès » / « avant » of a routine). Optional. */
  optionalTimes?: boolean;
  /** Days shown with their weekday. Optional. */
  weekday?: boolean;
  /** Days greyed in the calendar for each bound, still choosable (`excludedDays`: days its « Horaires » exclude). Optional. */
  excluded?: PerBound<((day: string) => boolean) | undefined>;
  /**
   * What the field shows for a bound in place of its day (the real « Échéance » of a task: `RealDueDate`); the
   * calendar still opens on its day. Optional. Default = its day.
   */
  shownBounds?: PerBound<ReactNode | undefined>;
  /** Error of the field, before those of its bounds. Optional. */
  error?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  size?: MantineSize;
  w?: number | string;
  style?: CSSProperties;
  popoverProps?: Partial<PopoverProps>;
  'data-autofocus'?: boolean;
}

const SIDES: PerBound<PeriodSide> = ['start', 'end'];

/**
 * Index of a side in the pairs.
 * @param {PeriodSide} side Side.
 * @returns {0 | 1} Index.
 */
const indexOf = (side: PeriodSide) => (side === 'start' ? 0 : 1);

/**
 * Field of a period « du … au … », the same everywhere a start and an end go together: one field, a calendar of the
 * range in its dropdown. The bound being chosen (« Début » / « Fin », or the names given) is picked in the calendar:
 * the start first, then the end; a start after the end moves the end, an end before the start moves the start, the
 * days before the start greyed for the end. Each bound not required can stay empty (« Dès le début » / « Jusqu’à la
 * fin ») and is emptied on its own (« Sans début » / « Sans fin »); « Aujourd'hui » picks today as the bound being
 * chosen, and today is highlighted. With `times`, each bound has its time (a date-time period; `sameDay`: one day and
 * its two times). The period is given (`onChange`) once complete (its end picked), when a bound is emptied, and when
 * the dropdown closes with a change: a panel saved field by field saves it then. A bound inherited is greyed in the
 * field (`hints`), with its mention and its actions under it (`inheritance`, `InheritanceNote`).
 * @param {PeriodFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function PeriodField({
  value,
  times,
  onChange,
  errors,
  onBlur,
  label,
  'aria-label': ariaLabel,
  description,
  placeholder = '—',
  required = false,
  bounds = PERIOD_BOUNDS,
  openBounds = PERIOD_OPEN_BOUNDS,
  hints,
  inheritance,
  excluded,
  shownBounds,
  min,
  max,
  sameDay = false,
  keepLength = false,
  optionalTimes = false,
  weekday = false,
  error,
  disabled = false,
  readOnly = false,
  size = 'sm',
  w,
  style,
  popoverProps,
  'data-autofocus': autofocus,
}: PeriodFieldProps) {
  const id = useId();
  const withTimes = times !== undefined;
  const saved: PeriodDraft = { days: [value[0], value[1]], times: [times?.[0] ?? null, times?.[1] ?? null], side: 'start' };
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState<PeriodDraft>(saved);
  const [month, setMonth] = useState(parisToday());
  // Last period given while the dropdown is open (the saved one may follow later): not given twice.
  const given = useRef<PeriodDraft | null>(null);
  const needed = (side: PeriodSide) => required === true || required === side;

  /**
   * Gives the period when it changed.
   * @param {PeriodDraft} next Period.
   * @returns {void}
   */
  const commit = (next: PeriodDraft) => {
    const before = given.current ?? saved;
    const changed = SIDES.some((_, index) => next.days[index] !== before.days[index] || (withTimes && next.times[index] !== before.times[index]));
    given.current = next;
    if (changed) onChange([next.days[0], next.days[1]], withTimes ? [next.times[0], next.times[1]] : undefined);
  };
  /**
   * Opens the dropdown on the period as saved, the calendar on its start (else its end, else today).
   * @returns {void}
   */
  const open = () => {
    if (disabled || readOnly) return;
    given.current = null;
    setDraft(saved);
    setMonth(saved.days[0] ?? saved.days[1] ?? parisToday());
    setOpened(true);
  };
  /**
   * Closes the dropdown: the period is given if it changed, then its fields are left (validation on blur).
   * @param {PeriodDraft} [last] Period to give (the draft by default). Optional.
   * @returns {void}
   */
  const close = (last: PeriodDraft = draft) => {
    commit(last);
    setOpened(false);
    onBlur?.[0]?.();
    onBlur?.[1]?.();
  };
  /**
   * A day picked in the calendar: the bound being chosen; a complete period is given (and closes without times).
   * @param {string | null} day Day.
   * @returns {void}
   */
  const pick = (day: string | null) => {
    if (!day) return;
    const { draft: next, complete } = pickPeriodDay(draft, day, { sameDay, keepLength });
    setDraft(next);
    if (!complete) return;
    if (withTimes) commit(next);
    else close(next);
  };
  /**
   * Empties a bound (and its time), given at once.
   * @param {0 | 1} index Bound.
   * @returns {void}
   */
  const clear = (index: 0 | 1) => {
    const next: PeriodDraft = { ...draft, days: index ? [draft.days[0], null] : [null, draft.days[1]], times: index ? [draft.times[0], null] : [null, draft.times[1]] };
    setDraft(next);
    commit(next);
  };
  /**
   * Changes the time of a bound (given when the dropdown closes).
   * @param {0 | 1} index Bound.
   * @param {string} time Time (empty: none).
   * @returns {void}
   */
  const setTime = (index: 0 | 1, time: string) => setDraft({ ...draft, times: index ? [draft.times[0], time || null] : [time || null, draft.times[1]] });

  const shown = opened ? draft : saved;
  const fieldError = error ?? errors?.[0] ?? errors?.[1] ?? periodError(saved.days, withTimes ? saved.times : undefined);
  const [start, end] = shown.days;
  const active = indexOf(shown.side);
  const endMin = !sameDay && shown.side === 'end' && start && (!min || start > min) ? start : min;

  /**
   * A bound in the field: its day (and time), else what it goes by, greyed; null when empty.
   * @param {0 | 1} index Bound.
   * @returns {ReactNode} Text.
   */
  const boundNode = (index: 0 | 1): ReactNode => {
    const day = saved.days[index];
    const custom = shownBounds?.[index];
    if (custom !== undefined && custom !== null && (day || hints?.[index])) return custom;
    if (day) {
      const words = boundText(day, withTimes && !sameDay ? saved.times[index] : null, weekday);
      return inheritance?.[index]?.origin?.state === 'INHERITED' ? <span className={inheritedClasses.inherited}>{words}</span> : words;
    }
    const hint = hints?.[index];
    return hint ? <span className={inheritedClasses.inherited}>{hint}</span> : null;
  };
  /**
   * The period in words: « Du 3 nov. 2026 au 12 nov. 2026 », « Dès le 3 nov. 2026 », « Jusqu’au 12 nov. 2026 »,
   * « 3 nov. 2026, 09:00 – 17:00 ».
   * @returns {ReactNode} Text, or the placeholder.
   */
  const text = (): ReactNode => {
    const [first, last] = [boundNode(0), boundNode(1)];
    const hours = withTimes && (saved.times[0] || saved.times[1]) ? `${saved.times[0] ?? '…'} – ${saved.times[1] ?? '…'}` : null;
    if (saved.days[0] && (sameDay || saved.days[0] === saved.days[1])) return [boundText(saved.days[0], null, weekday), hours].filter(Boolean).join(', ');
    if (first && last) return <>Du {first} au {last}</>;
    if (first) return <>Dès le {first}</>;
    if (last) return <>Jusqu’au {last}</>;
    return <Input.Placeholder>{placeholder}</Input.Placeholder>;
  };

  const notes = inheritance?.map((bound, index) => bound && <InheritanceNote key={index} {...bound} about={bounds[index]} readOnly={readOnly} />);
  const clearAll = !readOnly && !disabled && !required && (start || end) && !opened;

  return (
    <Stack gap={4} w={w} style={style}>
      <Input.Wrapper id={id} label={label} description={description} error={fieldError} required={required !== false} size={size}>
        <Popover opened={opened} onClose={() => close()} position="bottom-start" shadow="md" trapFocus returnFocus withinPortal {...popoverProps}>
          <Popover.Target>
            <Input
              id={id}
              component="button"
              type="button"
              pointer={!readOnly && !disabled}
              size={size}
              classNames={{ input: classes.input }}
              disabled={disabled}
              error={Boolean(fieldError)}
              aria-label={ariaLabel}
              aria-haspopup="dialog"
              aria-expanded={opened}
              data-autofocus={autofocus}
              leftSection={<CalendarBlankIcon aria-hidden />}
              rightSection={clearAll ? <Input.ClearButton aria-label="Effacer la période" onClick={() => onChange([null, null], withTimes ? [null, null] : undefined)} /> : undefined}
              rightSectionPointerEvents={clearAll ? 'auto' : 'none'}
              onClick={() => (opened ? close() : open())}
            >
              {text()}
            </Input>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              {!sameDay && (
                <SegmentedControl
                  fullWidth
                  size="xs"
                  aria-label="Borne à choisir"
                  value={shown.side}
                  onChange={(side) => {
                    const next = side as PeriodSide;
                    setDraft({ ...draft, side: next });
                    const day = draft.days[indexOf(next)];
                    if (day) setMonth(day);
                  }}
                  data={SIDES.map((side, index) => ({
                    value: side,
                    label: (
                      <Stack gap={0}>
                        <Text size="xs" c="dimmed" inherit={false}>
                          {bounds[index]}
                        </Text>
                        <Text size="sm">{shown.days[index] ? boundText(shown.days[index]!, withTimes ? shown.times[index] : null, weekday) : (hints?.[index] ?? openBounds[index])}</Text>
                      </Stack>
                    ),
                  }))}
                />
              )}
              {(withTimes || SIDES.some((side) => !needed(side))) && (
                <SimpleGrid cols={2} spacing="xs">
                  {SIDES.map((side, index) => (
                    <Stack key={side} gap={4} align="flex-start">
                      {withTimes && (
                        <TimePicker
                          size="xs"
                          label={sameDay ? bounds[index] : undefined}
                          aria-label={sameDay ? undefined : `Heure, ${bounds[index]}`}
                          clearable={optionalTimes}
                          value={shown.times[index] ?? ''}
                          onChange={(time) => setTime(index as 0 | 1, time)}
                        />
                      )}
                      {!sameDay && !needed(side) && shown.days[index] && (
                        <ActionButton priority="tertiary" size="xs" icon={<XIcon aria-hidden />} onClick={() => clear(index as 0 | 1)}>
                          Sans {bounds[index].toLowerCase()}
                        </ActionButton>
                      )}
                    </Stack>
                  ))}
                </SimpleGrid>
              )}
              <DatePicker
                highlightToday
                presets={todayPresets({ min: endMin, max })}
                date={month}
                onDateChange={setMonth}
                value={shown.days[active]}
                onChange={pick}
                minDate={endMin}
                maxDate={max}
                getDayProps={parisTodayDays(
                  excludedDays(excluded?.[active], (day) => {
                    const range = Boolean(start && end && start !== end);
                    return {
                      selected: day === start || day === end,
                      inRange: range && day >= start! && day <= end!,
                      firstInRange: range && day === start,
                      lastInRange: range && day === end,
                    };
                  }),
                )}
              />
              {opened && periodError(draft.days, withTimes ? draft.times : undefined) && (
                <Text size="xs" c="var(--mantine-color-error)">
                  {periodError(draft.days, withTimes ? draft.times : undefined)}
                </Text>
              )}
              {withTimes && (
                <ActionButton size="xs" icon={<CheckIcon aria-hidden />} onClick={() => close()} style={{ alignSelf: 'flex-end' }}>
                  Valider
                </ActionButton>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Input.Wrapper>
      {notes}
    </Stack>
  );
}
