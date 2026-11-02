import { Modal } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useRef, useState } from 'react';
import type { CalendarEventScope } from './api';
import { ScopeChoices, type ScopeQuestion } from './ScopeChoices';
import { scopeTitle } from './scope-title';

let modalCount = 0;

/**
 * Asks which occurrences of a recurring event a change applies to, in a modal of the modal manager.
 * Only from outside another managed modal (the manager shows one modal at a time and remounts the others):
 * inside a form, use `useScopeQuestion`.
 * @param {ScopeQuestion} question Question.
 * @returns {Promise<CalendarEventScope | null>} Scope, or null when cancelled.
 */
export function askScope(question: ScopeQuestion): Promise<CalendarEventScope | null> {
  return new Promise((resolve) => {
    const modalId = `event-scope-${++modalCount}`;
    let answered = false;
    modals.open({
      modalId,
      title: scopeTitle(question.action),
      onClose: () => !answered && resolve(null),
      children: (
        <ScopeChoices
          {...question}
          onAnswer={(scope) => {
            answered = true;
            modals.close(modalId);
            resolve(scope);
          }}
        />
      ),
    });
  });
}

/**
 * Scope question rendered by the component itself (stacked over its own modal, which stays mounted).
 * @returns {{ ask: (question: ScopeQuestion) => Promise<CalendarEventScope | null>, dialog: JSX.Element }} Asker and its dialog.
 */
export function useScopeQuestion() {
  const [question, setQuestion] = useState<ScopeQuestion | null>(null);
  const resolver = useRef<((scope: CalendarEventScope | null) => void) | null>(null);

  /**
   * Answers the pending question.
   * @param {CalendarEventScope | null} scope Scope.
   * @returns {void}
   */
  const answer = (scope: CalendarEventScope | null) => {
    resolver.current?.(scope);
    resolver.current = null;
    setQuestion(null);
  };

  return {
    ask: (next: ScopeQuestion) =>
      new Promise<CalendarEventScope | null>((resolve) => {
        resolver.current = resolve;
        setQuestion(next);
      }),
    dialog: (
      <Modal opened={question !== null} onClose={() => answer(null)} title={question ? scopeTitle(question.action) : ''} centered zIndex={300}>
        {question && <ScopeChoices {...question} onAnswer={answer} />}
      </Modal>
    ),
  };
}
