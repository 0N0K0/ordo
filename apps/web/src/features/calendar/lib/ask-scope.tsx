import { openModal } from '../../../components/panels/open-modal';

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
  return new Promise((resolve) => {
    let answered = false;
    openModal(
      question.title ?? scopeTitle(question.action),
      (close) => (
        <ScopeChoices
          {...question}
          onAnswer={(scope) => {
            answered = true;
            close();
            resolve(scope);
          }}
        />
      ),
      { onClose: () => !answered && resolve(null) },
    );
  });
}

