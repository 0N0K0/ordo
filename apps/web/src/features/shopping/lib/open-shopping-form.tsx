import { openFormPanel } from '../../../components/panels/panels';
import { ShoppingForm, type ShoppingFormProps } from '../components/ShoppingForm';

/**
 * Opens the form of a product of a base list or of an item of a list (titled « Élément » when opened read only, for a
 * closed or archived list; the panel follows its list, read only once closed or archived elsewhere).
 * @param {ShoppingFormProps['target']} target Product or item, edited when given.
 * @param {boolean} [readOnly=false] Item of a closed or archived list, for the title. Optional. Default = false.
 * @returns {void}
 */
export function openShoppingForm(target: ShoppingFormProps['target'], readOnly = false): void {
  const editing = target.kind === 'product' ? target.product : target.item;
  const itemTitle = readOnly ? 'Élément' : 'Modifier l’élément';
  openFormPanel(target.kind === 'product' ? (editing ? 'Modifier le produit' : 'Nouveau produit') : editing ? itemTitle : 'Élément hors références', (close) => (
    <ShoppingForm target={target} onDone={close} />
  ));
}
