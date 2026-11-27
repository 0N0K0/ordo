import { useState, type ReactNode } from 'react';
import { FoldHeading } from '../actions/FoldHeading';
import { plural } from '../../lib/text';
import { byExceptionDay } from './exceptions';

/** Exceptions shown at most before « + X exceptions ». */
const SHOWN_EXCEPTIONS = 5;

/**
 * Exceptions folded the same way in their summary and their list: sorted by day, 5 of them, or 4 and « + X
 * exceptions » unfolding the others in place (« Moins d’exceptions » folds them again).
 * @template E
 * @param {readonly E[]} lines Exceptions.
 * @returns {{ sorted: E[], shown: E[], more: ReactNode }} All sorted, those shown, the toggle (none with 5 at most).
 */
export function useFoldedExceptions<E extends { day: string }>(lines: readonly E[]): { sorted: E[]; shown: E[]; more: ReactNode } {
  const [expanded, setExpanded] = useState(false);
  const sorted = byExceptionDay(lines);
  const folded = sorted.length > SHOWN_EXCEPTIONS;
  const hidden = sorted.length - SHOWN_EXCEPTIONS + 1;
  return {
    sorted,
    shown: folded && !expanded ? sorted.slice(0, SHOWN_EXCEPTIONS - 1) : sorted,
    more: folded && (
      <FoldHeading inline expanded={expanded} onToggle={() => setExpanded(!expanded)}>
        {expanded ? 'Moins d’exceptions' : `+ ${hidden} ${plural(hidden, 'exception')}`}
      </FoldHeading>
    ),
  };
}
