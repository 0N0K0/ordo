import { EmptyState } from '../feedback/EmptyState';
import { confirmDestructive } from '../dialogs/confirm-destructive';
import {
  ActionIcon,
  Button,
  ColorInput,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  labelFormSchema,
  labelNameSchema,
  type LabelFormValues,
} from "@ordo/shared";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useColorSwatches } from "../../features/workspace/use-color-swatches";
import { showFormError, useAppForm } from "../../lib/form";
import { notifyError, notifySuccess } from "../../lib/notify";

export interface Label {
  id: string;
  name: string;
  color: string;
}

type LabelMutation<TVariables> = UseMutationResult<
  unknown,
  Error,
  TVariables,
  unknown
>;

interface LabelManagerProps {
  title: string;
  description: string;
  /** "la catégorie" / "le statut", used in messages. */
  noun: string;
  labels: Label[];
  /** Number of projects using each label. */
  usage: Map<string, number>;
  create: LabelMutation<LabelFormValues>;
  update: LabelMutation<{ id: string; input: Partial<LabelFormValues> }>;
  remove: LabelMutation<{ id: string }>;
  /** When given, labels can be reordered. */
  move?: LabelMutation<{ id: string; index: number }>;
  /** Extra control of a row (e.g. status category). */
  renderExtra?: (label: Label) => ReactNode;
  /** "projets" / "tâches", used in the deletion message. */
  usageNoun?: string;
}

/**
 * Editable row of a label: name saved on blur / Enter, color saved on change.
 * @param {object} props Component props.
 * @returns {JSX.Element} Row.
 */
function LabelRow({
  label,
  index,
  count,
  usage,
  noun,
  update,
  move,
  onDelete,
  extra,
}: {
  extra?: ReactNode;
  label: Label;
  index: number;
  count: number;
  usage: number;
  noun: string;
  update: LabelManagerProps["update"];
  move?: LabelManagerProps["move"];
  onDelete: () => void;
}) {
  const swatches = useColorSwatches();
  const [name, setName] = useState(label.name);
  const [error, setError] = useState<string | null>(null);

  /**
   * Saves the name when it changed and is valid.
   * @returns {void}
   */
  const saveName = () => {
    const result = labelNameSchema.safeParse(name);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Nom invalide.");
      return;
    }
    if (result.data === label.name) return;
    update.mutate(
      { id: label.id, input: { name: result.data } },
      {
        onError: (mutationError) => {
          setName(label.name);
          notifyError(mutationError.message);
        },
      },
    );
  };

  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <ColorInput
        aria-label={`Couleur de ${noun} ${label.name}`}
        value={label.color}
        onChangeEnd={(color) =>
          update.mutate(
            { id: label.id, input: { color } },
            { onError: (e) => notifyError(e.message) },
          )
        }
        swatches={swatches}
        swatchesPerRow={7}
        w={130}
      />
      <TextInput
        aria-label={`Nom de ${noun}`}
        value={name}
        error={error}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setError(null);
        }}
        onBlur={saveName}
        onKeyDown={(event) =>
          event.key === "Enter" && event.currentTarget.blur()
        }
        style={{ flex: 1 }}
        rightSection={
          usage > 0 ? (
            <Text size="xs" c="dimmed" pr="xs">
              {usage}
            </Text>
          ) : undefined
        }
        rightSectionWidth="auto"
      />
      {extra}
      {move && (
        <>
          <Tooltip label="Monter">
            <ActionIcon
              variant="default"
              size="input-sm"
              aria-label="Monter"
              disabled={index === 0}
              onClick={() => move.mutate({ id: label.id, index: index - 1 })}
            >
              <ArrowUpIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Descendre">
            <ActionIcon
              variant="default"
              size="input-sm"
              aria-label="Descendre"
              disabled={index === count - 1}
              onClick={() => move.mutate({ id: label.id, index: index + 1 })}
            >
              <ArrowDownIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </>
      )}
      <Tooltip label="Supprimer">
        <ActionIcon
          variant="subtle"
          color="red"
          size="input-sm"
          aria-label={`Supprimer ${noun} ${label.name}`}
          onClick={onDelete}
        >
          <TrashIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * List of configurable labels (project categories or statuses) with creation form.
 * @param {LabelManagerProps} props Component props.
 * @returns {JSX.Element} Manager.
 */
export function LabelManager({
  title,
  description,
  noun,
  labels,
  usage,
  create,
  update,
  remove,
  move,
  renderExtra,
  usageNoun = "projets",
}: LabelManagerProps) {
  const swatches = useColorSwatches();
  const form = useAppForm<LabelFormValues>({
    initialValues: { name: "", color: swatches[0] },
    schema: labelFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    create.mutate(values, {
      onSuccess: () => form.setValues({ name: "", color: values.color }),
      onError: (error) => showFormError(form, error),
    });
  });

  /**
   * Asks for confirmation before deleting a label.
   * @param {Label} label Label to delete.
   * @returns {void}
   */
  const confirmDelete = (label: Label) => {
    const used = usage.get(label.id) ?? 0;
    confirmDestructive({ title: `Supprimer ${noun}`, risks: (
<>
<Text size="sm">
            « {label.name} » sera supprimé définitivement
            {used > 0
              ? ` et retiré des ${used} ${used > 1 ? usageNoun : usageNoun.replace(/s$/, "")} qui l’utilisent`
              : ""}
            . Cette action est irréversible.
          </Text>
</>
), onConfirm: () => { remove.mutate(
                { id: label.id },
                {
                  onSuccess: () => notifySuccess(`« ${label.name} » supprimé.`),
                  onError: (error) => notifyError(error.message),
                },
              ); } });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} size="h4">
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </Stack>

        {labels.length === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <TagIcon aria-hidden />
            </ThemeIcon>
            <EmptyState compact message="Aucun élément pour le moment." />
          </Group>
        ) : (
          <Stack gap="xs">
            {labels.map((label, index) => (
              <LabelRow
                key={`${label.id}-${label.name}`}
                label={label}
                index={index}
                count={labels.length}
                usage={usage.get(label.id) ?? 0}
                noun={noun}
                update={update}
                move={move}
                onDelete={() => confirmDelete(label)}
                extra={renderExtra?.(label)}
              />
            ))}
          </Stack>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <ColorInput
              aria-label="Couleur"
              swatches={swatches}
              swatchesPerRow={7}
              w={130}
              {...form.getInputProps("color")}
            />
            <TextInput
              placeholder="Nom"
              aria-label="Nom"
              style={{ flex: 1 }}
              {...form.getInputProps("name")}
            />
            <Button
              type="submit"
              leftSection={<PlusIcon aria-hidden />}
              loading={create.isPending}
            >
              Ajouter
            </Button>
          </Group>
        </form>
      </Stack>
    </Paper>
  );
}
