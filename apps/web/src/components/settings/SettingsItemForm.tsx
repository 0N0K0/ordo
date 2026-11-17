import { Button, ColorInput, Group, Select, Stack, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useState, type ReactNode } from 'react';
import { IconField, type IconValue } from '../../features/workspace/IconField';
import { useColorSwatches } from '../../features/workspace/use-color-swatches';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { categoryOptions, categoryTree } from '../category-tree/category-tree';
import { treeSelectProps } from '../tree-select/tree-select';
import { useSettingsItemLook, type SettingsListKind } from './settings-api';

/** Item of a settings list: a name, a color, an image and, in a tree, a parent. */
export interface SettingsItem {
  id: string;
  name: string;
  color?: string | null;
  iconUrl?: string | null;
  parentId?: string | null;
  position?: number;
}

/** Values of the form of an item: its name, color and parent, and those of its list (`E`). */
export type SettingsItemValues<E extends Record<string, unknown> = Record<string, never>> = { name: string; color: string; parentId: string | null } & E;

/** Fields of a list of its own (a status category, base lists…), after the common ones. */
export interface SettingsItemExtra<C extends SettingsItem, E extends Record<string, unknown>> {
  /** Their starting values: those of the item edited, or of a new one. */
  initial: (item?: C) => E;
  /** Their fields. */
  render: (form: UseFormReturnType<SettingsItemValues<E>>) => ReactNode;
}

export interface SettingsItemFormProps<C extends SettingsItem, E extends Record<string, unknown>> {
  kind: SettingsListKind;
  /** Item edited; none: a new one. */
  item?: C;
  /** Parent of a new item (in a tree). Optional. */
  parentId?: string | null;
  /** Items of the tree, for the choice of the parent; none: a flat list. Optional. */
  tree?: readonly C[];
  /** Items have a color (none: their image or initials alone). Optional. Default = true. */
  withColor?: boolean;
  /** A color is required (else, in a tree, the one of its parent). Optional. Default = true for a flat list. */
  colorRequired?: boolean;
  /** Rule of the values (zod, `@ordo/shared`). */
  schema: Parameters<typeof useAppForm>[0]['schema'];
  extra?: SettingsItemExtra<C, E>;
  /** Saves a new item, gives its id. */
  create: (values: SettingsItemValues<E>) => Promise<string>;
  /** Saves the item edited. */
  update: (id: string, values: SettingsItemValues<E>) => Promise<unknown>;
  onDone: () => void;
}

/**
 * Form of an item of a settings list (every list, flat or tree): its name, color, image (shown as its avatar, its
 * initials on its color without one), parent in a tree, and the fields of its list.
 * @param {SettingsItemFormProps<C, E>} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SettingsItemForm<C extends SettingsItem, E extends Record<string, unknown> = Record<string, never>>({
  kind,
  item,
  parentId = null,
  tree,
  withColor = true,
  colorRequired = !tree,
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
    } as SettingsItemValues<E>,
    schema,
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setPending(true);
    try {
      const id = item ? (await update(item.id, values), item.id) : await create(values);
      // The image (and a color the list does not save itself) go through the look of every list.
      if (icon.file || icon.remove || withColor) {
        await look.mutateAsync({ kind, id, input: { ...(withColor && { color: values.color || null }), ...(icon.file ? { icon: icon.file } : icon.remove ? { removeIcon: true } : {}) } });
      }
      notifySuccess(item ? 'Modifications enregistrées.' : 'Ajout enregistré.');
      onDone();
    } catch (error) {
      showFormError(form, error);
    } finally {
      setPending(false);
    }
  });

  const values = form.getValues();
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        {withColor && (
          <ColorInput
            label="Couleur"
            required={colorRequired}
            description={colorRequired ? undefined : 'Vide : celle de son parent.'}
            format="hex"
            swatches={swatches}
            swatchesPerRow={9}
            {...form.getInputProps('color')}
          />
        )}
        <IconField value={icon} onChange={setIcon} currentUrl={item?.iconUrl ?? null} name={values.name} color={withColor ? values.color || parentColor : null} />
        {tree && <Select label="Parent" placeholder="Aucun (premier niveau)" clearable searchable {...treeSelectProps(categoryOptions(tree, item?.id))} {...form.getInputProps('parentId')} />}
        {extra?.render(form)}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {item ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
