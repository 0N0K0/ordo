import type { TreasuryDirection } from '@ordo/shared';
import { SettingsItemForm } from '../../../components/settings/SettingsItemForm';
import type { TreasuryCategory } from '../api';
import { useAccountItems, useCategoryItems, useCounterpartyItems, useMethodItems } from '../hooks/use-settings-items';

/** Closes a creation form; given the id of the item created (none: cancelled). */
type OnCreated = (createdId?: string) => void;

/**
 * New bank account, with the fields of its settings list.
 * @param {{ onDone: OnCreated }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function AccountItemForm({ onDone }: { onDone: OnCreated }) {
  return <SettingsItemForm {...useAccountItems()} onDone={onDone} />;
}

/**
 * New category of a direction, with the fields of its settings list (its parent among the categories of the direction).
 * @param {{ direction: TreasuryDirection, categories: TreasuryCategory[], onDone: OnCreated }} props Direction, all categories, and the closing.
 * @returns {JSX.Element} Form.
 */
export function CategoryItemForm({ direction, categories, onDone }: { direction: TreasuryDirection; categories: TreasuryCategory[]; onDone: OnCreated }) {
  return <SettingsItemForm {...useCategoryItems(direction)} tree={categories.filter((category) => category.direction === direction && !category.archived)} onDone={onDone} />;
}

/**
 * New payment method, with the fields of its settings list; it serves the direction given (both when omitted).
 * @param {{ direction?: TreasuryDirection, onDone: OnCreated }} props Direction of the entry, and the closing.
 * @returns {JSX.Element} Form.
 */
export function MethodItemForm({ direction, onDone }: { direction?: TreasuryDirection; onDone: OnCreated }) {
  return <SettingsItemForm {...useMethodItems()} initial={{ incoming: direction !== 'OUT', outgoing: direction !== 'IN' }} onDone={onDone} />;
}

/**
 * New counterparty, with the fields of its settings list.
 * @param {{ onDone: OnCreated }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function CounterpartyItemForm({ onDone }: { onDone: OnCreated }) {
  return <SettingsItemForm {...useCounterpartyItems()} onDone={onDone} />;
}
