import { answerInModal } from '../../../components/dialogs/ask-choice';
import type { CalendarEventScope } from '../api';
import { ScopeChoices, type ScopeQuestion } from '../components/ScopeChoices';
import { scopeTitle } from './scope-title';

/**
 * Asks which occurrences of a recurring event a change applies to, in a modal (forms are in the side panel, under
 * it).
 * @param {ScopeQuestion} question Question.
 * @returns {Promise<CalendarEventScope | null>} Scope, or null when cancelled.
 */
export function askScope(question: ScopeQuestion): Promise<CalendarEventScope | null> {
  return answerInModal<CalendarEventScope>(question.title ?? scopeTitle(question.action), (answer) => <ScopeChoices {...question} onAnswer={answer} />);
}
