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
 * Creates something from a select with its own form, in the side panel (a relation, a context…): the id created, once
 * the form is saved.
 * @param {ReactNode} title Title of the panel (« Nouvelle relation »).
 * @param {(done: (createdId?: string) => void) => ReactNode} form The form, given its closing (with the id created; none: cancelled).
 * @returns {Promise<string | null>} Id created, null when the form is cancelled.
 */
export function createInPanel(title: ReactNode, form: (done: (createdId?: string) => void) => ReactNode): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    /**
     * Gives the result once: the id created, or nothing (cancelled, panel closed).
     * @param {string} [id] Id created. Optional.
     * @returns {void}
     */
    const settle = (id?: string) => {
      if (settled) return;
      settled = true;
      resolve(id ?? null);
    };
    openFormPanel(
      title,
      (close) =>
        form((id) => {
          settle(id);
          close();
        }),
      { onClose: () => settle() },
    );
  });
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
export async function createSettingsItem<C extends SettingsItem, E extends object>(
  title: ReactNode,
  kind: SettingsItemKind<C, E>,
  name: string,
  { tree, initial }: CreateItemOptions<C, E> = {},
): Promise<{ id: string; name: string } | null> {
  let saved = name;
  const id = await createInPanel(title, (done) => (
    <SettingsItemForm<C, E>
      {...kind}
      create={async (values) => {
        saved = values.name;
        return kind.create(values);
      }}
      tree={tree}
      initial={{ ...initial, name } as Partial<SettingsItemValues<E>>}
      onDone={done}
    />
  ));
  return id ? { id, name: saved } : null;
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
