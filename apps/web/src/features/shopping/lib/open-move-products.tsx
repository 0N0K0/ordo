import { openFormPanel } from '../../../components/panels/panels';
import type { ShoppingBaseList } from '../api';
import { MoveProductsForm } from '../components/MoveProductsForm';

/**
 * Opens, in the side panel, the form moving products of a base list to another one.
 * @param {ShoppingBaseList} baseList Base list the products leave.
 * @param {string[]} [productIds] Products chosen at first. Optional. Default = none.
 * @returns {void}
 */
export function openMoveProducts(baseList: ShoppingBaseList, productIds: string[] = []): void {
  openFormPanel('Déplacer vers une autre référence', (close) => <MoveProductsForm baseList={baseList} productIds={productIds} onDone={close} />);
}
