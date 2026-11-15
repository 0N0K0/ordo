import { createElement } from 'react';
import { openFormPanel } from '../../components/panels/panels';
import { useShoppingData, type ShoppingItem } from '../shopping/api';
import { StockPurchaseForm } from './StockPurchaseForm';

/**
 * Proposal to add items just bought to the stock: those of references followed in stock that do not go there by
 * themselves (the others are added by the server, or not followed).
 * @returns {(items: ShoppingItem[]) => void} Opens the proposal (nothing when none is concerned).
 */
export function useStockProposal() {
  const { data } = useShoppingData();
  const products = new Map((data?.shoppingProducts ?? []).map((product) => [product.id, product]));
  return (items: ShoppingItem[]) => {
    const concerned = items.filter((item) => {
      const product = item.productId ? products.get(item.productId) : undefined;
      return product?.stockTracked && !product.autoStock;
    });
    if (concerned.length) openFormPanel('Ajouter au stock', (close) => createElement(StockPurchaseForm, { items: concerned, onDone: close }));
  };
}
