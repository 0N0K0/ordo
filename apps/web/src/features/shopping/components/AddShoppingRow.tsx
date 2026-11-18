import { shoppingItemSchema, type ShoppingItemInput } from '@ordo/shared';
import { ListPlusIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { AddRowButton, AddRowField } from '../../../components/data-table/cells/AddRowField';

/** Fields of a row added in a group (its category, store, way of keeping or person). */
type ShoppingPlace = Partial<Omit<ShoppingItemInput, 'name'>>;

export interface ShoppingAdd {
  /** Placeholder of the name field ("Ajouter un produit"). */
  label: string;
  /** Creates a row from its name, in a category (or store); resolves once created. */
  onCreate: (name: string, place: ShoppingPlace) => Promise<unknown>;
  /** Picks products of the base lists instead (offered in a menu with the typed row). Optional. */
  onPick?: () => void;
}

interface AddShoppingRowProps extends ShoppingAdd {
  place: ShoppingPlace;
  /** Name of the category (or store), for the accessible labels. */
  groupName: string;
}

/**
 * Field at the end of a category (or of the table), in its add row: a name typed then Enter adds a row in it; when
 * products of the base lists can be picked instead, a menu first offers both.
 * @param {AddShoppingRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function AddShoppingRow({ label, onCreate, onPick, place, groupName }: AddShoppingRowProps) {
  const [typing, setTyping] = useState(!onPick);
  if (typing) {
    return (
      <AddRowField
        label={label}
        where={`dans ${groupName}`}
        schema={shoppingItemSchema.shape.name}
        autoFocus={Boolean(onPick)}
        onCreate={(name) => onCreate(name, place)}
        onCancel={onPick ? () => setTyping(false) : undefined}
      />
    );
  }
  return (
    <ActionsMenu
      name={groupName}
      position="bottom-start"
      target={<AddRowButton label="Ajouter" aria-label={`Ajouter dans ${groupName}`} />}
      items={[
        { label: 'Depuis les références…', icon: <ListPlusIcon aria-hidden />, onClick: onPick },
        { label: 'Hors références', icon: <PencilSimpleLineIcon aria-hidden />, onClick: () => setTyping(true) },
      ]}
    />
  );
}
