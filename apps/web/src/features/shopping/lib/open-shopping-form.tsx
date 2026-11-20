import { openFormPanel } from '../../../components/panels/panels';
import { ShoppingForm, type ShoppingFormProps } from '../components/ShoppingForm';

/**
 * Opens the form of a product of a base list or of an item of a list (read only: « Élément », for a closed or archived
 * list).
 * @param {ShoppingFormProps['target']} target Product or item, edited when given.
 * @returns {void}
 */
export function openShoppingForm(target: ShoppingFormProps['target']): void {
  const editing = target.kind === 'product' ? target.product : target.item;
  const itemTitle = target.kind === 'item' && target.readOnly ? 'Élément' : 'Modifier l’élément';
  openFormPanel(target.kind === 'product' ? (editing ? 'Modifier le produit' : 'Nouveau produit') : editing ? itemTitle : 'Élément hors références', (close) => (
    <ShoppingForm target={target} onDone={close} />
  ));
}
