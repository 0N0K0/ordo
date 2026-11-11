import { modals } from '@mantine/modals';
import { ShoppingForm, type ShoppingFormProps } from './ShoppingForm';

let modalCount = 0;

/**
 * Opens the form of a product of the base list or of an item of a list.
 * @param {ShoppingFormProps['target']} target Product or item, edited when given.
 * @returns {void}
 */
export function openShoppingForm(target: ShoppingFormProps['target']): void {
  const modalId = `shopping-form-${++modalCount}`;
  const editing = target.kind === 'product' ? target.product : target.item;
  modals.open({
    modalId,
    size: 'lg',
    title: target.kind === 'product' ? (editing ? 'Modifier le produit' : 'Nouveau produit de la liste de base') : editing ? 'Modifier l’élément' : 'Élément hors liste de base',
    children: <ShoppingForm target={target} onDone={() => modals.close(modalId)} />,
  });
}
