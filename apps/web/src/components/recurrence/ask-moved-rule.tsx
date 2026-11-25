import { RuleChoiceRequired, type Recurrence } from '@ordo/shared';
import { openFormPanel } from '../panels/panels';
import { GraphQLRequestError } from '../../lib/graphql-client';
import { ActionDeclined } from '../../lib/notify';
import { MovedRuleForm } from './MovedRuleForm';

/**
 * Asks the new rule of a repetition on the last day of the month moved to another day, in the side panel
 * (`MovedRuleForm`, over the panel already open), and waits for it: null when given up (« Annuler », the panel closed).
 * @param {Recurrence} proposal Rule proposed.
 * @param {string} start Day the moved series is shown from.
 * @returns {Promise<Recurrence | null>} Rule chosen, or null.
 */
export function askMovedRule(proposal: Recurrence, start: string): Promise<Recurrence | null> {
  return new Promise((resolve) => {
    let answered = false;
    openFormPanel(
      'Nouvelle règle de la répétition',
      (close) => (
        <MovedRuleForm
          initial={proposal}
          start={start}
          onCancel={close}
          onSubmit={(rule) => {
            answered = true;
            close();
            resolve(rule);
          }}
        />
      ),
      { onClose: () => !answered && resolve(null) },
    );
  });
}

/**
 * Rule proposed by a refusal of a move of a repetition on the last day of the month without its new rule: by the API
 * (RULE_CHOICE_REQUIRED, extension `movedRule`), or by a shared computation run in the app (`RuleChoiceRequired`).
 * @param {unknown} error Error caught.
 * @returns {{ rule: Recurrence, start: string } | null} Rule proposed and the day it is shown from, or null (another error).
 */
function proposedRule(error: unknown): { rule: Recurrence; start: string } | null {
  if (error instanceof RuleChoiceRequired) return { rule: error.proposal, start: error.start };
  if (error instanceof GraphQLRequestError && error.code === 'RULE_CHOICE_REQUIRED') return (error.extensions.movedRule as { rule: Recurrence; start: string } | undefined) ?? null;
  return null;
}

/**
 * Runs a move of an occurrence that may move a repetition on the last day of the month (« Celle-ci et les suivantes »,
 * « Toutes »): first without a new rule; when refused for want of one, asks it (`askMovedRule`, prefilled with the rule
 * proposed), then runs it again with it. Given up: `ActionDeclined` (silent in the error toasts; the caller puts back
 * what it showed). Other refusals are passed on.
 * @param {(movedRule: Recurrence | null) => Promise<T> | T} run The move, with the new rule chosen or none.
 * @returns {Promise<T>} Its result.
 */
export async function withMovedRuleChoice<T>(run: (movedRule: Recurrence | null) => Promise<T> | T): Promise<T> {
  try {
    return await run(null);
  } catch (error) {
    const proposal = proposedRule(error);
    if (!proposal) throw error;
    const chosen = await askMovedRule(proposal.rule, proposal.start);
    if (!chosen) throw new ActionDeclined();
    return run(chosen);
  }
}
