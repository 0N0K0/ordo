import { Avatar, Button, CloseButton, ColorSwatch, Group, Menu, NumberInput, Paper, Popover, Stack, Text } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { routineSchema, type Recurrence } from '@ordo/shared';
import {
  AlarmIcon,
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowsClockwiseIcon,
  CaretDownIcon,
  CheckCircleIcon,
  ClockIcon,
  FolderIcon,
  LinkIcon,
  TagIcon,
  TrashIcon,
  UserPlusIcon,
} from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { categoryTree } from '../../components/category-tree/category-tree';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess, notifyWithUndo } from '../../lib/notify';
import { confirmDestructive } from '../shopping/list-modals';
import { ProjectSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { useRoutineMutations, type Routine, type RoutineBulkChanges, type RoutineCategory } from './api';
import { routinesLabel, useBulkRoutineChanges } from './routine-cell-edit';
import { DAILY, isDone, ruleOf } from './routine-format';
import classes from './Routines.module.css';

interface RoutineBulkBarProps {
  /** Selected routines. */
  routines: Routine[];
  /** Every routine (for the dependencies). */
  all: Routine[];
  categories: RoutineCategory[];
  context: TaskContext;
  onClear: () => void;
}

/**
 * Actions on the selected routines: categories, assignees and dependencies added or removed, repetition, time to spend
 * and project set, ticked or unticked, archived or restored, deleted. Each field change can be undone from its toast.
 * @param {RoutineBulkBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function RoutineBulkBar({ routines, all, categories, context, onClear }: RoutineBulkBarProps) {
  const applyBulk = useBulkRoutineChanges();
  const { bulkArchive, bulkDone, bulkRemove } = useRoutineMutations();
  const ids = routines.map((routine) => routine.id);
  const label = routinesLabel(ids.length);
  const allArchived = routines.every((routine) => routine.archived);
  const allDone = routines.every((routine) => routine.currentDate === null || isDone(routine));
  const [estimate, setEstimate] = useState<string | number>('');
  const [fromTime, setFromTime] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [startDate, setStartDate] = useState(localToday());
  const [rule, setRule] = useState<Recurrence>(DAILY);
  const [repetitionOpened, setRepetitionOpened] = useState(false);

  /**
   * Applies field changes to the selection.
   * @param {RoutineBulkChanges} changes Changes.
   * @param {string} message Success message.
   * @returns {void}
   */
  const apply = (changes: RoutineBulkChanges, message: string) => applyBulk(ids, changes, message);

  /**
   * Multi-select of the selection: what at least one selected routine has (« (2/5) » when not all of them), checked or
   * unchecked in one go: an option checked is added to every selected routine, one unchecked removed from all of them.
   * @param {object} options Options.
   * @param {string} options.name Name of the field.
   * @param {ReactNode} options.icon Icon.
   * @param {(routine: Routine) => string[]} options.of Values of a routine.
   * @param {{ value: string, label: string }[]} options.choices Options that may be added.
   * @param {(id: string) => ReactNode} [options.renderIcon] Icon of an option. Optional.
   * @param {(added: string[], removed: string[]) => RoutineBulkChanges} options.changes Changes of the selection.
   * @returns {JSX.Element} Multi-select.
   */
  const selectionSelect = ({
    name,
    icon,
    of,
    choices,
    renderIcon,
    changes,
  }: {
    name: string;
    icon: ReactNode;
    of: (routine: Routine) => string[];
    choices: { value: string; label: string }[];
    renderIcon?: (id: string) => ReactNode;
    changes: (added: string[], removed: string[]) => RoutineBulkChanges;
  }) => {
    const counts = new Map<string, number>();
    for (const routine of routines) for (const id of of(routine)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const present = [...counts.keys()];
    const data = choices.map((choice) => {
      const count = counts.get(choice.value) ?? 0;
      return { value: choice.value, label: count > 0 && count < routines.length ? `${choice.label} (${count}/${routines.length})` : choice.label };
    });
    return (
      <BatchMultiSelect
        size="xs"
        w={220}
        aria-label={`${name} des routines sélectionnées`}
        placeholder={present.length ? undefined : name}
        leftSection={icon}
        data={data}
        value={present}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            {renderIcon?.(option.value)}
            {option.label}
          </Group>
        )}
        onChange={(next) => {
          const added = next.filter((id) => !present.includes(id));
          const removed = present.filter((id) => !next.includes(id));
          if (added.length || removed.length) apply(changes(added, removed), `${name} modifiés sur ${label}.`);
        }}
        comboboxProps={{ position: 'top-start', withinPortal: true }}
        searchable
      />
    );
  };

  const placed = categoryTree(categories);

  return (
    <Paper shadow="md" withBorder radius="md" className={classes.bulkBar} role="region" aria-label="Actions sur la sélection">
      <Group gap="xs" wrap="wrap">
        <Text size="sm" fw={600}>
          {label} sélectionnée{ids.length > 1 ? 's' : ''}
        </Text>
        {selectionSelect({
          name: 'Catégories',
          icon: <TagIcon aria-hidden />,
          of: (routine) => routine.categoryIds,
          choices: placed.map((item) => ({ value: item.category.id, label: item.path })),
          renderIcon: (id) => {
            const color = placed.find((item) => item.category.id === id)?.color;
            return color ? <ColorSwatch color={color} size={10} /> : null;
          },
          changes: (added, removed) => ({ addCategoryIds: added, removeCategoryIds: removed }),
        })}
        {selectionSelect({
          name: 'Assignés',
          icon: <UserPlusIcon aria-hidden />,
          of: (routine) => routine.assigneeIds,
          choices: context.contributors.map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) })),
          renderIcon: (id) => {
            const contributor = context.contributorById.get(id);
            return <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />;
          },
          changes: (added, removed) => ({ addAssigneeIds: added, removeAssigneeIds: removed }),
        })}
        {selectionSelect({
          name: 'Dépend de',
          icon: <LinkIcon aria-hidden />,
          of: (routine) => routine.requiredIds,
          choices: all
            .filter((routine) => !routine.archived)
            .map((routine) => ({ value: routine.id, label: routine.title }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
          changes: (added, removed) => ({ addRequiredIds: added, removeRequiredIds: removed }),
        })}
        <Popover opened={repetitionOpened} onChange={setRepetitionOpened} position="top-start" width={420} shadow="md" trapFocus withinPortal>
          <Popover.Target>
            <Button
              size="xs"
              variant="default"
              leftSection={<ArrowsClockwiseIcon aria-hidden />}
              rightSection={<CaretDownIcon aria-hidden />}
              onClick={() => {
                // Starts from the rule of the first selected routine.
                setStartDate(routines[0]?.startDate ?? localToday());
                setRule((routines[0] && ruleOf(routines[0])) ?? DAILY);
                setRepetitionOpened((value) => !value);
              }}
            >
              Répétition
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="sm">
              <DatePickerInput label="Première fois" size="xs" valueFormat="D MMM YYYY" value={startDate} onChange={(value) => value && setStartDate(value)} popoverProps={{ withinPortal: false }} />
              <RecurrenceEditor value={rule} onChange={(value) => setRule(value ?? DAILY)} start={startDate} withinPortal={false} />
              <Group justify="flex-end" gap="sm">
                <Button size="xs" variant="default" onClick={() => setRepetitionOpened(false)}>
                  Annuler
                </Button>
                <Button
                  size="xs"
                  onClick={() => {
                    setRepetitionOpened(false);
                    apply({ startDate, recurrence: rule }, `Répétition appliquée à ${label}.`);
                  }}
                >
                  Appliquer à {label}
                </Button>
              </Group>
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Popover position="top-start" shadow="md" trapFocus withinPortal>
          <Popover.Target>
            <Button size="xs" variant="default" leftSection={<AlarmIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
              Horaire
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TimeInput size="xs" label="À partir de" value={fromTime} onChange={(event) => setFromTime(event.currentTarget.value)} w={110} data-autofocus />
              <TimeInput size="xs" label="Avant" value={dueTime} onChange={(event) => setDueTime(event.currentTarget.value)} w={110} />
              <Button
                size="xs"
                onClick={() => {
                  if (fromTime && dueTime && fromTime >= dueTime) return notifyError('L’heure maximale doit suivre l’heure de début.');
                  apply({ fromTime: fromTime || null, dueTime: dueTime || null }, `Horaire appliqué à ${label}.`);
                }}
              >
                Appliquer
              </Button>
            </Group>
          </Popover.Dropdown>
        </Popover>
        <Popover position="top-start" shadow="md" trapFocus withinPortal>
          <Popover.Target>
            <Button size="xs" variant="default" leftSection={<ClockIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
              Temps prévu
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <NumberInput
                size="xs"
                label="Minutes"
                placeholder="Aucun"
                min={1}
                max={24 * 60}
                allowDecimal={false}
                allowNegative={false}
                value={estimate}
                onChange={setEstimate}
                w={120}
                data-autofocus
              />
              <Button
                size="xs"
                onClick={() => {
                  const result = routineSchema.shape.estimate.safeParse(estimate === '' ? null : Number(estimate));
                  if (!result.success) return notifyError(result.error.issues[0]?.message ?? 'Durée invalide.');
                  apply({ estimate: result.data }, result.data ? `Temps prévu appliqué à ${label}.` : `Temps prévu retiré de ${label}.`);
                }}
              >
                Appliquer
              </Button>
            </Group>
          </Popover.Dropdown>
        </Popover>
        <Popover position="top-start" shadow="md" trapFocus withinPortal width={320}>
          <Popover.Target>
            <Button size="xs" variant="default" leftSection={<FolderIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
              Projet
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <ProjectSelect
              context={context}
              size="xs"
              label="Projet du temps chronométré"
              placeholder="Aucun"
              clearable
              comboboxProps={{ withinPortal: false }}
              value={null}
              onChange={(projectId) => apply({ projectId }, projectId ? `Projet appliqué à ${label}.` : `Projet retiré de ${label}.`)}
            />
          </Popover.Dropdown>
        </Popover>
        <Button
          size="xs"
          variant="default"
          leftSection={allDone ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckCircleIcon aria-hidden />}
          loading={bulkDone.isPending}
          onClick={() =>
            bulkDone.mutate(
              { ids, done: !allDone },
              {
                onSuccess: (count) =>
                  notifyWithUndo(`${routinesLabel(count)} ${allDone ? 'décochée' : 'cochée'}${count > 1 ? 's' : ''}.`, () =>
                    bulkDone.mutate({ ids, done: allDone }, { onError: (error) => notifyError(error.message) }),
                  ),
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          {allDone ? 'Décocher' : 'Cocher'}
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={allArchived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
          loading={bulkArchive.isPending}
          onClick={() =>
            bulkArchive.mutate(
              { ids, archived: !allArchived },
              {
                onSuccess: () => {
                  notifyWithUndo(`${label} ${allArchived ? 'restaurée' : 'archivée'}${ids.length > 1 ? 's' : ''}.`, () =>
                    bulkArchive.mutate({ ids, archived: allArchived }, { onError: (error) => notifyError(error.message) }),
                  );
                  onClear();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          {allArchived ? 'Restaurer' : 'Archiver'}
        </Button>
        <Menu position="top-end" withinPortal shadow="md">
          <Menu.Target>
            <Button size="xs" variant="default" color="red" leftSection={<TrashIcon aria-hidden />}>
              Supprimer
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<TrashIcon aria-hidden />}
              onClick={() =>
                confirmDestructive(
                  'Supprimer les routines',
                  `${label} seront supprimées définitivement avec l’historique de leurs coches. Leurs sous-routines remonteront d’un niveau ; le temps chronométré reste, sans routine. Cette action est irréversible ; pour les retirer sans perdre leurs données, archivez-les plutôt.`,
                  () =>
                    bulkRemove.mutate(ids, {
                      onSuccess: (count) => {
                        notifySuccess(`${routinesLabel(count)} supprimée${count > 1 ? 's' : ''}.`);
                        onClear();
                      },
                      onError: (error) => notifyError(error.message),
                    }),
                )
              }
            >
              Supprimer {label}…
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <CloseButton size="sm" aria-label="Vider la sélection" onClick={onClear} />
      </Group>
    </Paper>
  );
}
