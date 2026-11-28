import type { EventScope as CalendarEventScope } from '@ordo/shared';
import { answerInModal } from '../dialogs/ask-choice';
import { ScopeChoices, type ScopeQuestion } from './ScopeChoices';
import { scopeTitle } from './scope-title';

/**
 * Asks which occurrences of a repetition a change applies to (every domain: events, routines, slots, forecasts…), in a modal (forms are in the side panel, under
 * it).
 * @param {ScopeQuestion} question Question.
 * @returns {Promise<CalendarEventScope | null>} Scope, or null when cancelled.
 */
export function askScope(question: ScopeQuestion): Promise<CalendarEventScope | null> {
  return answerInModal<CalendarEventScope>(question.title ?? scopeTitle(question.action), (answer) => <ScopeChoices {...question} onAnswer={answer} />);
}
