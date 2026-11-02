import { Avatar, Button, CloseButton, ColorSwatch, Group, Menu, Paper, Radio, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  ArchiveIcon,
  CheckCircleIcon,
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CaretDownIcon,
  FlagIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess, notifyWithUndo } from '../../../lib/notify';
import { DestructiveActions } from '../../workspace/DeleteDialogs';
import { useBulkTaskMutations, useSetTasksClosed, type BulkChanges, type Task, type TaskLabel } from '../api';
import { ProjectSelect } from '../task-ui';
import type { TaskContext } from '../use-task-context';
import classes from './BulkBar.module.css';
import { useBulkUndo } from './bulk-undo';

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
                  // Removed links and milestones cannot come back: no undo then.
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
   * @returns {void}
   */
  const openDialog = (title: string, Dialog: typeof BulkTransferDialog) => {
    const modalId = `bulk-${++modalCount}`;
    modals.open({
      modalId,
      title,
      children: (
        <Dialog
          tasks={tasks}
          context={context}
          onDone={(success) => {
            modals.close(modalId);
            if (success) onClear();
          }}
        />
      ),
    });
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
   * Menu adding or removing an assignee.
   * @param {boolean} add Whether to add (or remove).
   * @returns {JSX.Element} Menu.
   */
  const assigneeMenu = (add: boolean) => {
    // Adding: contributors of the selected tasks' projects. Removing: current assignees.
    const assigned = new Set(tasks.flatMap((task) => task.assigneeIds));
    const choices = add
      ? context.assignableFor(tasks.map((task) => task.projectId))
      : context.contributors.filter((contributor) => assigned.has(contributor.id));
    return (
      <Menu position="top-start" withinPortal shadow="md">
        <Menu.Target>
          <Button
            size="xs"
            variant="default"
            leftSection={add ? <UserPlusIcon aria-hidden /> : <UserMinusIcon aria-hidden />}
            disabled={choices.length === 0}
          >
            {add ? 'Assigner' : 'Désassigner'}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {choices.map((contributor) => (
            <Menu.Item
              key={contributor.id}
              leftSection={<Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={20} />}
              onClick={() =>
                apply(
                  add ? { addAssigneeIds: [contributor.id] } : { removeAssigneeIds: [contributor.id] },
                  `${contributor.name} ${add ? 'assigné à' : 'retiré de'} ${tasksLabel(ids.length)}.`,
                )
              }
            >
              {context.contributorName(contributor)}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
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
        {assigneeMenu(true)}
        {assigneeMenu(false)}
        <Button size="xs" variant="default" leftSection={<ArrowsLeftRightIcon aria-hidden />} onClick={() => openDialog('Transférer les tâches', BulkTransferDialog)}>
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
