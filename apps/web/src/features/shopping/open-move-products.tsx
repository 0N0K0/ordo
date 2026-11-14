import { closePanel, openPanel } from '../../components/panels/panels';
import type { ShoppingBaseList } from './api';
import { MoveProductsForm } from './MoveProductsForm';

let panelCount = 0;

/**
 * Opens, in the side panel, the form moving products of a base list to another one.
 * @param {ShoppingBaseList} baseList Base list the products leave.
 * @param {string[]} [productIds] Products chosen at first. Optional. Default = none.
 * @returns {void}
 */
export function openMoveProducts(baseList: ShoppingBaseList, productIds: string[] = []): void {
  const panelId = `move-products-${++panelCount}`;
  openPanel({
    panelId,
    title: 'Déplacer vers une autre liste type',
    children: <MoveProductsForm baseList={baseList} productIds={productIds} onDone={() => closePanel(panelId)} />,
  });
}
