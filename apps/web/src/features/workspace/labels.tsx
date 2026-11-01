import {
  ActionIcon,
  Button,
  ColorInput,
  ColorSwatch,
  Group,
  MultiSelect,
  Popover,
  Select,
  Stack,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { labelFormSchema, type LabelFormValues } from '@ordo/shared';
import { PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { showFormError, useAppForm } from '../../lib/form';
import { useCreateProjectCategory, useCreateProjectStatus, type ProjectCategory, type ProjectStatus } from './api';
import { useColorSwatches } from './use-color-swatches';

/**
 * Option renderer showing the label color.
 * @param {object} props Option props.
 * @param {{ label: string, color?: string }} props.option Option.
 * @returns {JSX.Element} Option content.
 */
function LabelOption({ option }: { option: { label: string; color?: string } }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <ColorSwatch color={option.color ?? 'transparent'} size={12} />
      {option.label}
    </Group>
  );
}

interface CreateLabelPopoverProps {
  kind: 'category' | 'status';
  onCreated: (id: string) => void;
}

/**
 * "+" button opening a small form to create a category or a status on the fly.
 * @param {CreateLabelPopoverProps} props Component props.
 * @param {'category' | 'status'} props.kind What to create.
 * @param {(id: string) => void} props.onCreated Called with the new id.
 * @returns {JSX.Element} Button and popover.
 */
function CreateLabelPopover({ kind, onCreated }: CreateLabelPopoverProps) {
  const [opened, setOpened] = useState(false);
  const swatches = useColorSwatches();
  const createCategory = useCreateProjectCategory();
  const createStatus = useCreateProjectStatus();
  const mutation = kind === 'category' ? createCategory : createStatus;
  const form = useAppForm<LabelFormValues>({
    initialValues: { name: '', color: swatches[0] },
    schema: labelFormSchema,
  });
  const label = kind === 'category' ? 'Nouvelle catégorie' : 'Nouveau statut';

  const handleSubmit = form.onSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: (created) => {
        onCreated(created.id);
        form.reset();
        setOpened(false);
      },
      onError: (error) => showFormError(form, error),
    });
  });

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" withArrow trapFocus shadow="md">
      <Popover.Target>
        <Tooltip label={label}>
          <ActionIcon variant="default" size="input-sm" aria-label={label} onClick={() => setOpened((open) => !open)}>
            <PlusIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        {/* Not a nested <form>: the popover renders inside the project form. */}
        <Stack gap="sm" w={240}>
          <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
          <ColorInput label="Couleur" required swatches={swatches} swatchesPerRow={7} {...form.getInputProps('color')} />
          <Group justify="flex-end">
            <Button size="xs" loading={mutation.isPending} onClick={() => handleSubmit()}>
              Créer
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

interface CategoriesInputProps {
  categories: ProjectCategory[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

/**
 * Project categories multi-select, with on-the-fly creation.
 * @param {CategoriesInputProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function CategoriesInput({ categories, value, onChange, error }: CategoriesInputProps) {
  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <MultiSelect
        label="Catégories"
        placeholder={value.length ? undefined : 'Aucune'}
        data={categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
        renderOption={({ option }) => <LabelOption option={option as { label: string; color?: string }} />}
        value={value}
        onChange={onChange}
        error={error}
        searchable
        clearable
        style={{ flex: 1 }}
      />
      <CreateLabelPopover kind="category" onCreated={(id) => onChange([...value, id])} />
    </Group>
  );
}

interface StatusInputProps {
  statuses: ProjectStatus[];
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

/**
 * Project status select, with on-the-fly creation.
 * @param {StatusInputProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function StatusInput({ statuses, value, onChange, error }: StatusInputProps) {
  const current = statuses.find((status) => status.id === value);
  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <Select
        label="Statut"
        placeholder="Aucun"
        data={[...statuses]
          .sort((a, b) => a.position - b.position)
          .map((status) => ({ value: status.id, label: status.name, color: status.color }))}
        renderOption={({ option }) => <LabelOption option={option as { label: string; color?: string }} />}
        leftSection={current ? <ColorSwatch color={current.color} size={12} /> : undefined}
        value={value}
        onChange={onChange}
        error={error}
        clearable
        style={{ flex: 1 }}
      />
      <CreateLabelPopover kind="status" onCreated={onChange} />
    </Group>
  );
}
