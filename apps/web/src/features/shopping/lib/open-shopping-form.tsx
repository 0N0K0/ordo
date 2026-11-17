import { openFormPanel } from '../../../components/panels/panels';
import { ShoppingForm, type ShoppingFormProps } from '../components/ShoppingForm';

/**
 * Opens the form of a product of a base list or of an item of a list.
 * @param {ShoppingFormProps['target']} target Product or item, edited when given.
 * @returns {void}
 */
export function openShoppingForm(target: ShoppingFormProps['target']): void {
  const editing = target.kind === 'product' ? target.product : target.item;
  openFormPanel(target.kind === 'product' ? (editing ? 'Modifier le produit' : 'Nouveau produit') : editing ? 'Modifier l’élément' : 'Élément hors références', (close) => (
    <ShoppingForm target={target} onDone={close} />
  ));
}
