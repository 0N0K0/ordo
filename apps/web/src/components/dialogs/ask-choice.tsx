import type { ReactNode } from 'react';
import { openModal } from '../panels/open-modal';
import { ChoiceList, type Choice } from './ChoiceList';

/**
 * Asks a question in a modal and waits for the answer: null when cancelled (« Annuler », Escape, a click outside).
 * @param {ReactNode} title Title of the modal.
 * @param {(answer: (value: T | null) => void) => ReactNode} render Content, given what answers.
 * @returns {Promise<T | null>} Answer.
 */
export function answerInModal<T>(title: ReactNode, render: (answer: (value: T | null) => void) => ReactNode): Promise<T | null> {
  return new Promise((resolve) => {
    let answered = false;
    // eslint-disable-next-line no-restricted-syntax -- answerInModal itself.
    openModal(
      title,
      (close) =>
        render((value) => {
          answered = true;
          close();
          resolve(value);
        }),
      { onClose: () => !answered && resolve(null) },
    );
  });
}

/**
 * Asks to choose between answers, in a modal (`ChoiceList`): a question that is not a confirmation of a destructive
 * action (`confirmDestructive`).
 * @param {ReactNode} title Title of the modal.
 * @param {ReactNode} question Question.
 * @param {readonly Choice<T>[]} choices Answers.
 * @returns {Promise<T | null>} Answer, or null when cancelled.
 */
export function askChoice<T>(title: ReactNode, question: ReactNode, choices: readonly Choice<T>[]): Promise<T | null> {
  return answerInModal<T>(title, (answer) => <ChoiceList question={question} choices={choices} onAnswer={answer} />);
}
