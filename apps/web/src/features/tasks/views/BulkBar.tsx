import { closePanel, openPanel } from '../../../components/panels/panels';
import { Avatar, Button, CloseButton, ColorSwatch, Group, Menu, Paper, Radio, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  ArchiveIcon,
  CheckCircleIcon,
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CaretDownIcon,
  FlagIcon,
  TimerIcon,
  TagIcon,
  TrashIcon,
  UserPlusIcon,
} from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { notifyError, notifySuccess, notifyWithUndo } from '../../../lib/notify';
import { DestructiveActions } from '../../workspace/DeleteDialogs';
import { useBulkTaskMutations, useSetTasksClosed, type BulkChanges, type Task, type TaskLabel } from '../api';
import { ProjectSelect } from '../task-ui';
import type { TaskContext } from '../use-task-context';
import classes from './BulkBar.module.css';
import { useBulkUndo } from './bulk-undo';
import { BatchMultiSelect } from '../../../components/BatchMultiSelect';

/**
 * "3 tâches" / "1 tâche".
 * @param {number} count Count.
 * @returns {string} Label.
 */
function tasksLabel(count: number): string {
  return `${count} tâche${count > 1 ? 's' : ''}`;
}

interface DialogProps {
  tasks: Task[];
  context: TaskContext;
  onDone: (success: boolean) => void;
}

/**
 * Bulk transfer to another project.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
function BulkTransferDialog({ tasks, context, onDone }: DialogProps) {
  const { transfer } = useBulkTaskMutations();
  const undo = useBulkUndo();

  /**
   * Moved tasks (the topmost of the selection), then their sub-tasks level by level, as they are now.
   * @returns {Task[][]} Levels.
   */
  const movedLevels = () => {
    const selected = new Set(tasks.map((task) => task.id));
    const hasSelectedAncestor = (task: Task) => {
      for (let parentId = task.parentId; parentId; parentId = context.taskById.get(parentId)?.parentId ?? null) {
        if (selected.has(parentId)) return true;
      }
      return false;
    };
    const levels = [tasks.filter((task) => !hasSelectedAncestor(task))];
    while (levels[levels.length - 1].length > 0) {
      levels.push(levels[levels.length - 1].flatMap((task) => context.childrenOf(task.id)));
    }
    return levels.slice(0, -1);
  };
  const [projectId, setProjectId] = useState<string | null>(null);
  return (
    <Stack gap="md">
      <Text size="sm">{tasksLabel(tasks.length)} et leurs sous-tâches seront déplacées. Les liens qui sortent de l’arborescence du projet choisi seront retirés.</Text>
      <ProjectSelect context={context} label="Projet de destination" value={projectId} onChange={setProjectId} data-autofocus />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={() => onDone(false)}>
          Annuler
        </Button>
        <Button
          disabled={!projectId}
          loading={transfer.isPending}
          onClick={() => {
            if (!projectId) return;
            const levels = movedLevels();
            transfer.mutate(
              { ids: tasks.map((task) => task.id), projectId },
              {
                onSuccess: ({ removedLinks }) => {
                  const message = `${tasksLabel(tasks.length)} transférée${tasks.length > 1 ? 's' : ''}.`;
                  // Removed links, milestones and sprints cannot come back: no undo then.
                  if (removedLinks > 0) notifySuccess(`${message} ${removedLinks} lien(s) retiré(s).`);
                  else notifyWithUndo(message, undo.transfer(levels));
                  onDone(true);
                },
                onError: (error) => notifyError(error.message),
              },
            );
          }}
        >
          Transférer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Bulk deletion confirmation.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
function BulkDeleteDialog({ tasks, context, onDone }: DialogProps) {
  const { remove } = useBulkTaskMutations();
  const selected = new Set(tasks.map((task) => task.id));
  const hasOtherSubtasks = tasks.some((task) => context.childrenOf(task.id).some((child) => !selected.has(child.id)));
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  return (
    <Stack gap="md">
      <Text size="sm">
        {tasksLabel(tasks.length)} et leurs commentaires seront supprimées définitivement. Cette action est irréversible ;
        pour les retirer des listes sans perdre leurs données, archivez-les plutôt.
      </Text>
      {hasOtherSubtasks && (
        <Radio.Group label="Que faire de leurs sous-tâches non sélectionnées ?" value={mode} onChange={(value) => setMode(value as 'detach' | 'delete')}>
          <Stack gap="xs" mt="xs">
            <Radio value="detach" label="Les conserver (elles remontent d’un niveau)" />
            <Radio value="delete" label="Les supprimer aussi, définitivement" color="red" />
          </Stack>
        </Radio.Group>
      )}
      <DestructiveActions
        loading={remove.isPending}
        onCancel={() => onDone(false)}
        onConfirm={() =>
          remove.mutate(
            { ids: tasks.map((task) => task.id), deleteSubtasks: mode === 'delete' },
            {
              onSuccess: () => {
                notifySuccess(`${tasksLabel(tasks.length)} supprimée${tasks.length > 1 ? 's' : ''}.`);
                onDone(true);
              },
              onError: (error) => notifyError(error.message),
            },
          )
        }
      />
    </Stack>
  );
}

let modalCount = 0;

interface BulkBarProps {
  tasks: Task[];
  context: TaskContext;
  onClear: () => void;
}

/**
 * Actions on the selected tasks: status, priority, type, assignees, transfer, archive, delete.
 * @param {BulkBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function BulkBar({ tasks, context, onClear }: BulkBarProps) {
  const { update, archive } = useBulkTaskMutations();
  const setClosed = useSetTasksClosed();
  const undo = useBulkUndo();
  const allClosed = tasks.every((task) => task.closed);
  const ids = tasks.map((task) => task.id);
  const allArchived = tasks.every((task) => task.archived);
  // Milestones usable by every selected task (same project tree).
  const roots = new Set(tasks.map((task) => context.rootOf(task.projectId)));
  const commonMilestones = roots.size === 1 ? context.milestonesFor(tasks[0].projectId) : [];
  const commonSprints = roots.size === 1 ? context.sprintsFor(tasks[0].projectId) : [];
  // Sprints at least one selected task is in.
  const usedSprints = context.sprints.filter((sprint) => tasks.some((task) => task.sprintIds.includes(sprint.id)));

  /**
   * Applies field changes to the selection.
   * @param {BulkChanges} changes Changes.
   * @param {string} message Success message.
   * @returns {void}
   */
  const apply = (changes: BulkChanges, message: string) =>
    update.mutate(
      { ids, changes },
      { onSuccess: () => notifyWithUndo(message, undo.changes(tasks, changes)), onError: (error) => notifyError(error.message) },
    );

  /**
   * Opens a dialog on the selection; clears the selection when the action succeeds.
   * @param {string} title Modal title.
   * @param {typeof BulkTransferDialog} Dialog Dialog component.
   * @param {boolean} [asForm] A form (in the side panel), not a confirmation. Optional. Default = false.
   * @returns {void}
   */
  const openDialog = (title: string, Dialog: typeof BulkTransferDialog, asForm = false) => {
    const modalId = `bulk-${++modalCount}`;
    const close = () => (asForm ? closePanel(modalId) : modals.close(modalId));
    const children = (
      <Dialog
        tasks={tasks}
        context={context}
        onDone={(success) => {
          close();
          if (success) onClear();
        }}
      />
    );
    // A form in the side panel, a confirmation in a dialog.
    if (asForm) openPanel({ panelId: modalId, title, children });
    else modals.open({ modalId, title, children });
  };

  /**
   * Menu setting a status, priority or type.
   * @param {string} label Button label.
   * @param {TaskLabel[]} labels Options.
   * @param {'statusId' | 'priorityId' | 'typeId'} field Field.
   * @returns {JSX.Element} Menu.
   */
  const labelMenu = (label: string, labels: TaskLabel[], field: 'statusId' | 'priorityId' | 'typeId') => (
    <Menu position="top-start" withinPortal shadow="md">
      <Menu.Target>
        <Button size="xs" variant="default" rightSection={<CaretDownIcon aria-hidden />}>
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {labels.map((item) => (
          <Menu.Item
            key={item.id}
            leftSection={<ColorSwatch color={item.color} size={10} />}
            onClick={() => apply({ [field]: item.id }, `${label} « ${item.name} » appliqué à ${tasksLabel(ids.length)}.`)}
          >
            {item.name}
          </Menu.Item>
        ))}
        {labels.length > 0 && <Menu.Divider />}
        <Menu.Item onClick={() => apply({ [field]: null }, `${label} retiré de ${tasksLabel(ids.length)}.`)}>Aucun</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  /**
   * Multi-select of the selection: what at least one selected task has (« (2/5) » when not all of them), checked
   * or unchecked in one go; saved once its list closes: an option checked is added to every selected task, one
   * unchecked removed from all of them, the others left as they are.
   * @param {object} options Options.
   * @param {string} options.label Name of the field.
   * @param {ReactNode} options.icon Icon.
   * @param {(task: Task) => string[]} options.of Values of a task.
   * @param {{ value: string, label: string }[]} options.choices Options that may be added.
   * @param {(id: string) => ReactNode} options.renderIcon Icon of an option.
   * @param {(added: string[], removed: string[]) => BulkChanges} options.changes Changes of the selection.
   * @returns {JSX.Element} Multi-select.
   */
  const selectionSelect = ({
    label,
    icon,
    of,
    choices,
    renderIcon,
    changes,
  }: {
    label: string;
    icon: ReactNode;
    of: (task: Task) => string[];
    choices: { value: string; label: string }[];
    renderIcon: (id: string) => ReactNode;
    changes: (added: string[], removed: string[]) => BulkChanges;
  }) => {
    const counts = new Map<string, number>();
    for (const task of tasks) for (const id of of(task)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const present = [...counts.keys()];
    const data = choices.map((choice) => {
      const count = counts.get(choice.value) ?? 0;
      return { value: choice.value, label: count > 0 && count < tasks.length ? `${choice.label} (${count}/${tasks.length})` : choice.label };
    });
    return (
      <BatchMultiSelect
        size="xs"
        w={240}
        aria-label={`${label} des tâches sélectionnées`}
        placeholder={present.length ? undefined : label}
        leftSection={icon}
        data={data}
        value={present}
        renderOption={({ option }) => (
          <Group gap="xs" wrap="nowrap">
            {renderIcon(option.value)}
            {option.label}
          </Group>
        )}
        onChange={(next) => {
          const added = next.filter((id) => !present.includes(id));
          const removed = present.filter((id) => !next.includes(id));
          if (added.length || removed.length) apply(changes(added, removed), `${label} modifiés sur ${tasksLabel(ids.length)}.`);
        }}
        comboboxProps={{ position: 'top-start', withinPortal: true }}
        searchable
      />
    );
  };

  return (
    <Paper shadow="md" withBorder radius="md" className={classes.bar} role="region" aria-label="Actions sur la sélection">
      <Group gap="xs" wrap="wrap">
        <Text size="sm" fw={600}>
          {tasksLabel(ids.length)} sélectionnée{ids.length > 1 ? 's' : ''}
        </Text>
        {labelMenu('Statut', context.statuses, 'statusId')}
        {labelMenu('Priorité', context.priorities, 'priorityId')}
        {labelMenu('Type', context.types, 'typeId')}
        <Menu position="top-start" withinPortal shadow="md">
          <Menu.Target>
            <Button size="xs" variant="default" leftSection={<FlagIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
              Jalon
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {commonMilestones.length === 0 && <Menu.Label>Aucun jalon commun aux tâches sélectionnées</Menu.Label>}
            {commonMilestones.map((milestone) => (
              <Menu.Item
                key={milestone.id}
                onClick={() => apply({ milestoneId: milestone.id }, `Jalon « ${milestone.title} » appliqué à ${tasksLabel(ids.length)}.`)}
              >
                {milestone.title}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item onClick={() => apply({ milestoneId: null }, `Jalon retiré de ${tasksLabel(ids.length)}.`)}>Aucun</Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Menu position="top-start" withinPortal shadow="md">
          <Menu.Target>
            <Button size="xs" variant="default" leftSection={<TimerIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
              Sprint
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {commonSprints.length === 0 && <Menu.Label>Aucun sprint commun aux tâches sélectionnées</Menu.Label>}
            {commonSprints.length > 0 && <Menu.Label>Ajouter au sprint</Menu.Label>}
            {commonSprints.map((sprint) => (
              <Menu.Item key={sprint.id} onClick={() => apply({ addSprintIds: [sprint.id] }, `Sprint « ${sprint.name} » ajouté à ${tasksLabel(ids.length)}.`)}>
                {sprint.name}
              </Menu.Item>
            ))}
            {usedSprints.length > 0 && (
              <>
                <Menu.Divider />
                <Menu.Label>Retirer du sprint</Menu.Label>
                {usedSprints.map((sprint) => (
                  <Menu.Item key={sprint.id} onClick={() => apply({ removeSprintIds: [sprint.id] }, `Sprint « ${sprint.name} » retiré de ${tasksLabel(ids.length)}.`)}>
                    {sprint.name}
                  </Menu.Item>
                ))}
                <Menu.Item onClick={() => apply({ removeSprintIds: usedSprints.map((sprint) => sprint.id) }, `Sprints retirés de ${tasksLabel(ids.length)}.`)}>Tous</Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
        {selectionSelect({
          label: 'Assignés',
          icon: <UserPlusIcon aria-hidden />,
          of: (task) => task.assigneeIds,
          // Contributors of the selected tasks' projects, and those already assigned.
          choices: context
            .assignableFor(
              tasks.map((task) => task.projectId),
              tasks.flatMap((task) => task.assigneeIds),
            )
            .map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) })),
          renderIcon: (id) => {
            const contributor = context.contributorById.get(id);
            return <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />;
          },
          changes: (added, removed) => ({ addAssigneeIds: added, removeAssigneeIds: removed }),
        })}
        {selectionSelect({
          label: 'Étiquettes',
          icon: <TagIcon aria-hidden />,
          of: (task) => task.tagIds,
          choices: context.tags.map((tag) => ({ value: tag.id, label: tag.name })),
          renderIcon: (id) => <ColorSwatch color={context.tagById.get(id)?.color ?? 'gray'} size={10} />,
          changes: (added, removed) => ({ addTagIds: added, removeTagIds: removed }),
        })}
        <Button size="xs" variant="default" leftSection={<ArrowsLeftRightIcon aria-hidden />} onClick={() => openDialog('Transférer les tâches', BulkTransferDialog, true)}>
          Transférer
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={allClosed ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckCircleIcon aria-hidden />}
          loading={setClosed.isPending}
          onClick={() =>
            setClosed.mutate(
              { ids, closed: !allClosed },
              {
                onSuccess: () =>
                  notifyWithUndo(
                    `${tasksLabel(ids.length)} ${allClosed ? 'rouverte' : 'fermée'}${ids.length > 1 ? 's' : ''}.`,
                    undo.closed(tasks, !allClosed),
                  ),
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          {allClosed ? 'Rouvrir' : 'Fermer'}
        </Button>
        <Button
          size="xs"
          variant="default"
          leftSection={allArchived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
          loading={archive.isPending}
          onClick={() =>
            archive.mutate(
              { ids, archived: !allArchived },
              {
                onSuccess: () => {
                  notifyWithUndo(
                    `${tasksLabel(ids.length)} ${allArchived ? 'désarchivée' : 'archivée'}${ids.length > 1 ? 's' : ''}.`,
                    undo.archived(tasks, !allArchived),
                  );
                  onClear();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          {allArchived ? 'Désarchiver' : 'Archiver'}
        </Button>
        <Button size="xs" variant="default" color="red" leftSection={<TrashIcon aria-hidden />} onClick={() => openDialog('Supprimer les tâches', BulkDeleteDialog)}>
          Supprimer
        </Button>
        <CloseButton aria-label="Désélectionner" onClick={onClear} />
      </Group>
    </Paper>
  );
}
