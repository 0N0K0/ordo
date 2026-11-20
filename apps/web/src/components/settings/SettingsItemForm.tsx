import { ColorField } from '../inputs/ColorField';
import { Fieldset, Select, Stack, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import type { ReactNode } from 'react';
import { IconField } from '../inputs/IconField';
import { formIconProps } from '../inputs/icon-field';
import { useColorSwatches } from '../../lib/use-color-swatches';
import { useAppForm, formCallbacks, useFieldSave } from '../../lib/form';
import { useLiveValue, type LiveSource } from '../../lib/live-value';
import { SaveStatus } from '../feedback/SaveStatus';
import { useAsyncAction } from '../../lib/use-async-action';
import { categoryOptions, categoryTree } from '../tree/category-tree';
import { treeSelectProps } from '../tree/tree-select';
import { useSettingsItemLook, type SettingsListKind } from './settings-api';
import { FormActions } from '../dialogs/FormActions';
import type { LossConfirmation } from '../../lib/archive';

/** Item of a settings list: a label, a color, an image, whether it is archived and, in a tree, a parent. */
export interface SettingsItem {
  id: string;
  label: string;
  color?: string | null;
  iconUrl?: string | null;
  parentId?: string | null;
  position?: number;
  /** Archived: hidden behind « Afficher les archivés », read only (restored, or deleted). */
  archived: boolean;
}

/** Values of the form of an item: its label, color and parent, and those of its list (`E`). */
export type SettingsItemValues<E extends object = Record<string, never>> = { label: string; color: string; parentId: string | null } & E;

/** Fields of a list of its own (a status category, base lists…), after the common ones. */
interface SettingsItemExtra<C extends SettingsItem, E extends object> {
  /** Their starting values: those of the item edited, or of a new one. */
  initial: (item?: C) => E;
  /**
   * Their fields, given the item edited (none: a new one) and the save of fields now (an editor without
   * `getInputProps`: an address; nothing on a new item).
   */
  render: (form: UseFormReturnType<SettingsItemValues<E>>, item: C | undefined, commit: (fields: readonly (keyof E & string)[]) => void) => ReactNode;
  /** Those saved on leaving them on an existing item (texts, numbers); the others as soon as they change. Optional. Default = none. */
  onBlur?: readonly (keyof E & string)[];
}

/** Values of the form: those of the item, and its image chosen or removed (a file sent with the values). */
type FormValues<E extends object> = SettingsItemValues<E> & { icon: File | null; removeIcon: boolean };

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
  labelPlaceholder?: string;
  /** Label of the name field (decision AD): « Nom » for people, physical or legal (counterparties). Optional. Default = « Libellé ». */
  labelField?: string;
  /** Rule of the values (zod, `@ordo/shared`). */
  schema: Parameters<typeof useAppForm>[0]['schema'];
  /** Fields of the list of its own, in the form. Optional. */
  extra?: SettingsItemExtra<C, E>;
  /** Saves a new item, gives its id. */
  create: (values: SettingsItemValues<E>) => Promise<string>;
  /** Saves an item edited. */
  update: (id: string, values: SettingsItemValues<E>) => Promise<unknown>;
  /** Asks what archiving or restoring an item loses (the kinds of schedules: occurrences of routines, decision FQ). Optional. Default = never asked. */
  confirmLoss?: LossConfirmation;
}

interface SettingsItemFormProps<C extends SettingsItem, E extends object> extends SettingsItemKind<C, E> {
  /** Item edited; none: a new one. */
  item?: C;
  /** Parent of a new item (in a tree). Optional. */
  parentId?: string | null;
  /** Items of the tree, for the choice of the parent; none: a flat list. Optional. */
  tree?: readonly C[];
  /**
   * Items of the list as it holds them now (`useLiveSource`): the item edited and the tree followed, values changed
   * elsewhere taken (`saved` of `useFieldSave`). Optional. Default = the item and the tree given.
   */
  liveItems?: LiveSource<readonly C[]>;
  /** The parent is chosen in the form (else only by drag and drop). Optional. Default = true. */
  withParent?: boolean;
  /** Starting values of a new item (an address picked on a map…). Optional. */
  initial?: Partial<SettingsItemValues<E>>;
  /** Closes the form; given the id of the item created (none: edited, or cancelled). */
  onDone: (createdId?: string) => void;
}

/**
 * Form of an item of a settings list (every list, flat or tree): its name, color, image (shown as its avatar, its
 * initials on its color without one), parent in a tree, and the fields of its list. A new item is created by its
 * button; an existing one is saved field by field (decision D22): the color and the image through the look of every
 * list, the other fields by the list (a confirmation it asks, declined, puts the field back), the item of the list
 * followed (`liveItems`); the color at once when picked, on leaving it when typed (`commitProps`). Archived (elsewhere,
 * while it is open), it is read only.
 * @param {SettingsItemFormProps<C, E>} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SettingsItemForm<C extends SettingsItem, E extends object = Record<string, never>>({
  kind,
  item: openedItem,
  parentId = null,
  tree: openedTree,
  liveItems,
  withParent = true,
  initial,
  withColor = true,
  colorRequired = !openedTree,
  labelPlaceholder,
  labelField = 'Libellé',
  schema,
  extra,
  create,
  update,
  onDone,
}: SettingsItemFormProps<C, E>) {
  const swatches = useColorSwatches();
  const live = useLiveValue(liveItems);
  // The item and the tree as the list holds them now (the copy opened when it is no longer there).
  const item = openedItem && (live?.find((other) => other.id === openedItem.id) ?? openedItem);
  const tree = openedTree && (live ?? openedTree);
  // Archived (elsewhere, the panel open): read only, as an archived item everywhere.
  const readOnly = Boolean(item?.archived);
  const look = useSettingsItemLook();
  const parentColor = tree && parentId ? categoryTree(tree).find((placed) => placed.category.id === parentId)?.color : null;
  /**
   * Values of the form for an item (its image neither chosen nor removed), or for a new one.
   * @param {C} [of] Item. Optional.
   * @returns {FormValues<E>} Values.
   */
  const valuesOf = (of?: C): FormValues<E> =>
    ({
      label: of?.label ?? '',
      color: of ? (of.color ?? '') : withColor && (colorRequired || !parentColor) ? (parentColor ?? swatches[0]) : '',
      parentId: of ? (of.parentId ?? null) : parentId,
      ...(extra?.initial(of) ?? ({} as E)),
      ...(!of && initial),
      icon: null,
      removeIcon: false,
    }) as FormValues<E>;
  const base = useAppForm<FormValues<E>>({ initialValues: valuesOf(item), schema });

  /**
   * Saves the look of an item (its image, and a color the list does not save itself), through the look of every list.
   * @param {string} id Item.
   * @param {{ color?: string, icon?: File | null, removeIcon?: boolean }} values Color, image chosen or removed.
   * @returns {Promise<unknown>} Saved.
   */
  const saveLook = (id: string, { color, icon, removeIcon }: { color?: string; icon?: File | null; removeIcon?: boolean }) =>
    look.mutateAsync({ kind, id, input: { ...(withColor && color !== undefined && { color: color || null }), ...(icon ? { icon } : removeIcon ? { removeIcon: true } : {}) } });

  /**
   * Values of the item for its list (without its image, saved through its look).
   * @param {FormValues<E>} values Form values.
   * @returns {SettingsItemValues<E>} Values.
   */
  const itemValues = (values: FormValues<E>) => Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'icon' && key !== 'removeIcon')) as SettingsItemValues<E>;

  const { form, saving, commit, commitProps } = useFieldSave(base, {
    save: item
      ? async (changes, values) => {
          const fields = Object.keys(changes);
          if (fields.some((field) => field !== 'icon' && field !== 'removeIcon' && !(withColor && field === 'color'))) await update(item.id, itemValues(values));
          if (fields.some((field) => field === 'icon' || field === 'removeIcon' || (withColor && field === 'color'))) await saveLook(item.id, changes);
        }
      : null,
    schema,
    saved: item && valuesOf(item),
    onBlur: ['label', 'color', ...(extra?.onBlur ?? [])] as (keyof FormValues<E> & string)[],
    readOnly,
  });

  const callbacks = formCallbacks(form, 'Ajout enregistré.', (id: string) => onDone(id));
  const { run: add, loading: pending } = useAsyncAction(
    async (values: FormValues<E>) => {
      const id = await create(itemValues(values));
      if (values.icon || withColor) await saveLook(id, { color: values.color, icon: values.icon });
      return id;
    },
    { onDone: callbacks.onSuccess, onError: (error) => callbacks.onError(error as Error) },
  );
  // A new item only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit(add);

  const values = form.getValues();
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {item && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label={labelField} required placeholder={labelPlaceholder} data-autofocus {...form.getInputProps('label')} />
          {withColor && <ColorField required={colorRequired} description={colorRequired ? undefined : 'Vide : celle de son parent.'} {...commitProps('color')} />}
          <IconField {...formIconProps(form, 'icon', 'removeIcon')} currentUrl={item?.iconUrl ?? null} name={values.label} color={withColor ? values.color || parentColor : null} />
          {tree && withParent && (
            <Select label="Parent" placeholder="Aucun (premier niveau)" clearable searchable {...treeSelectProps(categoryOptions(tree, item?.id))} {...form.getInputProps('parentId')} />
          )}
          {extra?.render(form as unknown as UseFormReturnType<SettingsItemValues<E>>, item, commit as (fields: readonly (keyof E & string)[]) => void)}
          {!item && <FormActions onCancel={() => onDone()} submitLabel="Créer" loading={pending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}
