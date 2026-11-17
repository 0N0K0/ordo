import { Menu, Text, TextInput, UnstyledButton } from '@mantine/core';
import { shoppingItemSchema, type ShoppingItemInput } from '@ordo/shared';
import { ListPlusIcon, PencilSimpleLineIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError } from '../../lib/notify';
import addClasses from '../tasks/views/table-extras.module.css';

/** Fields of a row added in a group (its category, store, way of keeping or person). */
export type ShoppingPlace = Partial<Omit<ShoppingItemInput, 'name'>>;

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
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  /**
   * Creates the typed row, then stays ready for the next one.
   * @returns {void}
   */
  const submit = () => {
    const result = shoppingItemSchema.shape.name.safeParse(name);
    if (!result.success) {
      if (name.trim()) notifyError(result.error.issues[0]?.message ?? 'Nom invalide.');
      return;
    }
    setPending(true);
    onCreate(result.data, place)
      .then(() => setName(''))
      .catch((error: Error) => notifyError(error.message))
      .finally(() => setPending(false));
  };

  return (
    <>
      {typing ? (
        <TextInput
          variant="unstyled"
          size="xs"
          classNames={{ input: addClasses.addInput }}
          leftSection={<PlusIcon aria-hidden />}
          placeholder={`${label} (Entrée pour valider, Échap pour annuler)`}
          aria-label={`${label} dans ${groupName}`}
          autoFocus={Boolean(onPick)}
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') {
              setName('');
              if (onPick) setTyping(false);
            }
          }}
          onBlur={() => onPick && !name.trim() && setTyping(false)}
          w={360}
          maw="100%"
        />
      ) : (
        <Menu position="bottom-start" shadow="md" withinPortal>
          <Menu.Target>
            <UnstyledButton className={addClasses.addButton} aria-label={`Ajouter dans ${groupName}`}>
              <PlusIcon aria-hidden />
              <Text span size="sm">
                Ajouter
              </Text>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<ListPlusIcon aria-hidden />} onClick={onPick}>
              Depuis les références…
            </Menu.Item>
            <Menu.Item leftSection={<PencilSimpleLineIcon aria-hidden />} onClick={() => setTyping(true)}>
              Hors références
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </>
  );
}
