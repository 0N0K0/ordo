import { openFormPanel } from '../../../components/panels/panels';
import { relationWords } from '../../../components/people/people-options';
import type { TreasuryRelation } from '../api';
import { RelationForm } from '../components/TeamPanel';

/**
 * Opens the panel of a relation (from its list, or from its birthday in the calendar), or of a new one.
 * @param {TreasuryRelation | undefined} relation Relation, or none for a new one.
 * @param {boolean} perso Personal workspace (its words for a relation).
 * @returns {void}
 */
export function openRelationForm(relation: TreasuryRelation | undefined, perso: boolean): void {
  const words = relationWords(perso);
  openFormPanel(relation ? `Modifier ${words.the}` : words.new, (close) => <RelationForm relation={relation} onDone={close} />);
}
