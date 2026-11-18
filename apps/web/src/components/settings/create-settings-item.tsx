import type { ReactNode } from 'react';
import { openFormPanel } from '../panels/panels';
import { SettingsItemForm, type SettingsItem, type SettingsItemKind, type SettingsItemValues } from './SettingsItemForm';

/** What the form of a new item gets beyond its kind: the items of its tree (to choose its parent), values of its own. */
interface CreateItemOptions<C extends SettingsItem, E extends object> {
  /** Items of the tree, for the choice of the parent; none: a flat list. Optional. */
  tree?: readonly C[];
  /** Starting values (besides the name typed). Optional. */
  initial?: Partial<SettingsItemValues<E>>;
}

/**
 * Creates an item of a settings list from a select (a tag, a status, a category, a store…): its settings form (name,
 * color, image, fields of its list) opens in the side panel, the name typed filled in.
 * @param {ReactNode} title Title of the panel (« Nouvelle étiquette »).
 * @param {SettingsItemKind<C, E>} kind List and form of the item.
 * @param {string} name Name typed.
 * @param {CreateItemOptions<C, E>} [options] Tree and starting values. Optional.
 * @returns {Promise<{ id: string, name: string } | null>} Item created (its id and the name saved), null when the form is cancelled.
 */
export function createSettingsItem<C extends SettingsItem, E extends object>(
  title: ReactNode,
  kind: SettingsItemKind<C, E>,
  name: string,
  { tree, initial }: CreateItemOptions<C, E> = {},
): Promise<{ id: string; name: string } | null> {
  return new Promise((resolve) => {
    let saved = name;
    let settled = false;
    /**
     * Gives the result once: the item created, or nothing (cancelled, panel closed).
     * @param {string} [id] Id of the item created. Optional.
     * @returns {void}
     */
    const settle = (id?: string) => {
      if (settled) return;
      settled = true;
      resolve(id ? { id, name: saved } : null);
    };
    openFormPanel(
      title,
      (close) => (
        <SettingsItemForm<C, E>
          {...kind}
          create={async (values) => {
            saved = values.name;
            return kind.create(values);
          }}
          tree={tree}
          initial={{ ...initial, name } as Partial<SettingsItemValues<E>>}
          onDone={(id) => {
            settle(id);
            close();
          }}
        />
      ),
      { onClose: () => settle() },
    );
  });
}

/**
 * Creator of the items of a settings list, for the `onCreate` of a select: the settings form, then the id created.
 * @param {ReactNode} title Title of the panel.
 * @param {SettingsItemKind<C, E>} kind List and form of the item.
 * @param {CreateItemOptions<C, E>} [options] Tree and starting values. Optional.
 * @returns {(name: string) => Promise<string | null>} Creator: the id of the item created, null when cancelled.
 */
export function itemCreator<C extends SettingsItem, E extends object>(title: ReactNode, kind: SettingsItemKind<C, E>, options?: CreateItemOptions<C, E>): (name: string) => Promise<string | null> {
  return async (name) => (await createSettingsItem(title, kind, name, options))?.id ?? null;
}
