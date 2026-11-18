import { ColorField } from '../inputs/ColorField';
import { Select, Stack, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useState, type ReactNode } from 'react';
import { IconField, type IconValue } from '../../features/workspace/components/IconField';
import { useColorSwatches } from '../../lib/use-color-swatches';
import { useAppForm, formCallbacks } from '../../lib/form';
import { categoryOptions, categoryTree } from '../tree/category-tree';
import { treeSelectProps } from '../tree/tree-select';
import { useSettingsItemLook, type SettingsListKind } from './settings-api';
import { FormActions } from '../dialogs/FormActions';

/** Item of a settings list: a name, a color, an image, whether it is archived and, in a tree, a parent. */
export interface SettingsItem {
  id: string;
  name: string;
  color?: string | null;
  iconUrl?: string | null;
  parentId?: string | null;
  position?: number;
  /** Archived: hidden behind « Afficher les archivés », read only (restored, or deleted). */
  archived: boolean;
}

/** Values of the form of an item: its name, color and parent, and those of its list (`E`). */
export type SettingsItemValues<E extends object = Record<string, never>> = { name: string; color: string; parentId: string | null } & E;

/** Fields of a list of its own (a status category, base lists…), after the common ones. */
export interface SettingsItemExtra<C extends SettingsItem, E extends object> {
  /** Their starting values: those of the item edited, or of a new one. */
  initial: (item?: C) => E;
  /** Their fields, given the item edited (none: a new one). */
  render: (form: UseFormReturnType<SettingsItemValues<E>>, item?: C) => ReactNode;
}

/**
 * What a settings list and the form of its items share (a quick creation elsewhere included): the list, the look of
 * its items, the rule and fields of the form and its saves.
 */
export interface SettingsItemKind<C extends SettingsItem, E extends object = Record<string, never>> {
  kind: SettingsListKind;
  /** Items have a color (none: their image or initials alone). Optional. Default = true. */
  withColor?: boolean;
  /** A color is required (else, in a tree, the one of its parent). Optional. Default = true for a flat list. */
  colorRequired?: boolean;
  /** Placeholder of the name (« Virement, carte, chèque… »). Optional. */
  namePlaceholder?: string;
  /** Rule of the values (zod, `@ordo/shared`). */
  schema: Parameters<typeof useAppForm>[0]['schema'];
  /** Fields of the list of its own, in the form. Optional. */
  extra?: SettingsItemExtra<C, E>;
  /** Saves a new item, gives its id. */
  create: (values: SettingsItemValues<E>) => Promise<string>;
  /** Saves an item edited. */
  update: (id: string, values: SettingsItemValues<E>) => Promise<unknown>;
}

interface SettingsItemFormProps<C extends SettingsItem, E extends object> extends SettingsItemKind<C, E> {
  /** Item edited; none: a new one. */
  item?: C;
  /** Parent of a new item (in a tree). Optional. */
  parentId?: string | null;
  /** Items of the tree, for the choice of the parent; none: a flat list. Optional. */
  tree?: readonly C[];
  /** The parent is chosen in the form (else only by drag and drop). Optional. Default = true. */
  withParent?: boolean;
  /** Starting values of a new item (an address picked on a map…). Optional. */
  initial?: Partial<SettingsItemValues<E>>;
  /** Closes the form; given the id of the item created (none: edited, or cancelled). */
  onDone: (createdId?: string) => void;
}

/**
 * Form of an item of a settings list (every list, flat or tree): its name, color, image (shown as its avatar, its
 * initials on its color without one), parent in a tree, and the fields of its list.
 * @param {SettingsItemFormProps<C, E>} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SettingsItemForm<C extends SettingsItem, E extends object = Record<string, never>>({
  kind,
  item,
  parentId = null,
  tree,
  withParent = true,
  initial,
  withColor = true,
  colorRequired = !tree,
  namePlaceholder,
  schema,
  extra,
  create,
  update,
  onDone,
}: SettingsItemFormProps<C, E>) {
  const swatches = useColorSwatches();
  const look = useSettingsItemLook();
  const [icon, setIcon] = useState<IconValue>({ file: null, remove: false });
  const [pending, setPending] = useState(false);
  const parentColor = tree && parentId ? categoryTree(tree).find((placed) => placed.category.id === parentId)?.color : null;
  const form = useAppForm<SettingsItemValues<E>>({
    initialValues: {
      name: item?.name ?? '',
      color: item ? (item.color ?? '') : withColor && (colorRequired || !parentColor) ? (parentColor ?? swatches[0]) : '',
      parentId: item ? (item.parentId ?? null) : parentId,
      ...(extra?.initial(item) ?? ({} as E)),
      ...(!item && initial),
    } as SettingsItemValues<E>,
    schema,
  });

  const callbacks = formCallbacks(form, item ? 'Modifications enregistrées.' : 'Ajout enregistré.', (id: string) => onDone(item ? undefined : id));
  const handleSubmit = form.onSubmit(async (values) => {
    setPending(true);
    try {
      const id = item ? (await update(item.id, values), item.id) : await create(values);
      // The image (and a color the list does not save itself) go through the look of every list.
      if (icon.file || icon.remove || withColor) {
        await look.mutateAsync({ kind, id, input: { ...(withColor && { color: values.color || null }), ...(icon.file ? { icon: icon.file } : icon.remove ? { removeIcon: true } : {}) } });
      }
      callbacks.onSuccess(id);
    } catch (error) {
      callbacks.onError(error as Error);
    } finally {
      setPending(false);
    }
  });

  const values = form.getValues();
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required placeholder={namePlaceholder} data-autofocus {...form.getInputProps('name')} />
        {withColor && <ColorField required={colorRequired} description={colorRequired ? undefined : 'Vide : celle de son parent.'} {...form.getInputProps('color')} />}
        <IconField value={icon} onChange={setIcon} currentUrl={item?.iconUrl ?? null} name={values.name} color={withColor ? values.color || parentColor : null} />
        {tree && withParent && (
          <Select label="Parent" placeholder="Aucun (premier niveau)" clearable searchable {...treeSelectProps(categoryOptions(tree, item?.id))} {...form.getInputProps('parentId')} />
        )}
        {extra?.render(form, item)}
        <FormActions onCancel={() => onDone()} submitLabel={item ? 'Enregistrer' : 'Créer'} loading={pending} />
      </Stack>
    </form>
  );
}
