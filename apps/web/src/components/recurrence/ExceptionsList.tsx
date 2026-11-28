import { Stack, Text } from '@mantine/core';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ExceptionsFocusContext } from './exceptions-focus';
import { IconAction } from '../actions/IconAction';
import { DateField } from '../inputs/DateField';
import type { ExceptionLine } from './exceptions';
import { useFoldedExceptions } from './use-folded-exceptions';
import { FoldCard } from './FoldCard';

/** One exception in the list: its line, its settings and its removal. */
export interface ExceptionEntry extends ExceptionLine {
  /** Its settings (a period, hours…), unfolded on demand; none: nothing to change but its removal. Optional. */
  body?: ReactNode;
  /** Removes it (« Rétablir « its day » »): its occurrences come back as their rule gives them. Optional. */
  onRestore?: () => void;
  /** Its removal running. Optional. */
  restoring?: boolean;
}

/** Adding a « rien » exception on a day of the rule: only such days can be picked. */
export interface ExceptionsAdd {
  isDay: (day: string) => boolean;
  onAdd: (day: string) => void;
  minDate?: string;
  /** Help under the field. Optional. Default = « Un jour de la règle dont l’occurrence n’a pas lieu. ». */
  description?: string;
}

interface ExceptionsListProps {
  entries: readonly ExceptionEntry[];
  /** Adds a « rien » exception on a day of the rule (only such days can be picked); none: not offered. Optional. */
  add?: ExceptionsAdd;
  /** Under the list (« Ajouter une exception » of a period…). Optional. */
  footer?: ReactNode;
  /** Shown without any exception. Optional. Default = « Aucune exception. ». */
  emptyText?: string;
}

/**
 * Exceptions of a repetition to change, the same in every modal: one card each, sorted by day, 5 of them or 4 and
 * « + X exceptions » (`useFoldedExceptions`), all folded at first, those added since unfolded (`FoldCard`; those with
 * settings unfold), each removable (« Rétablir » : its occurrence comes back); a « rien » exception added on a day of
 * the rule. In a modal opened by « Modifier les exceptions » (`ExceptionsFocusContext`), it scrolls into view.
 * @param {ExceptionsListProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function ExceptionsList({ entries, add, footer, emptyText = 'Aucune exception.' }: ExceptionsListProps) {
  // Folded or unfolded by hand; otherwise those there at the opening folded, those added since unfolded.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [initial] = useState(() => new Set(entries.map((entry) => entry.key)));
  const { shown, more } = useFoldedExceptions(entries);
  // Opened by « Modifier les exceptions »: the list scrolls into view once the modal shows it.
  const focused = useContext(ExceptionsFocusContext);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focused) return;
    const timer = window.setTimeout(() => root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0);
    return () => window.clearTimeout(timer);
  }, [focused]);
  /**
   * Whether an exception is unfolded.
   * @param {string} key Its key.
   * @returns {boolean} Unfolded.
   */
  const isOpen = (key: string) => toggled.get(key) ?? !initial.has(key);
  /**
   * Folds or unfolds an exception.
   * @param {string} key Its key.
   * @returns {void}
   */
  const toggle = (key: string) => setToggled((current) => new Map(current).set(key, !isOpen(key)));
  return (
    <Stack gap="xs" ref={root}>
      {!entries.length && (
        <Text size="sm" c="dimmed">
          {emptyText}
        </Text>
      )}
      {shown.map((entry) => (
        <FoldCard
          key={entry.key}
          title={entry.text}
          collapsible={Boolean(entry.body)}
          opened={isOpen(entry.key)}
          onToggle={() => toggle(entry.key)}
          actions={
            entry.onRestore && (
              <IconAction
                label="Rétablir"
                item={entry.text}
                size="sm"
                loading={entry.restoring}
                onClick={() => {
                  // Keys of the following ones may shift: their folds start over.
                  setToggled(new Map());
                  entry.onRestore?.();
                }}
              >
                <ArrowCounterClockwiseIcon aria-hidden />
              </IconAction>
            )
          }
        >
          {entry.body}
        </FoldCard>
      ))}
      {more}
      {add && (
        <DateField
          label="Ajouter une exception « rien »"
          description={add.description ?? 'Un jour de la règle dont l’occurrence n’a pas lieu.'}
          placeholder="Choisir un jour"
          size="xs"
          w={280}
          value={null}
          minDate={add.minDate}
          excludeDate={(day) => !add.isDay(day)}
          onChange={(day) => day && add.onAdd(day)}
        />
      )}
      {footer}
    </Stack>
  );
}
