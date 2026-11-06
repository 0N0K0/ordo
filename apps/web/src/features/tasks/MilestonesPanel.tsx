import { ActionIcon, Button, Group, Menu, Paper, Progress, SegmentedControl, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DatePickerInput } from '@mantine/dates';
import type { ReactNode } from 'react';
import { modals } from '@mantine/modals';
import { milestoneFormSchema, type MilestoneFormValues } from '@ordo/shared';
import { DotsSixVerticalIcon, DotsThreeIcon, FlagIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../components/markdown/MarkdownView';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useMilestoneMutations, type Milestone } from './api';
import { MILESTONE_ORDER_OPTIONS, useMilestoneOrder, type MilestoneOrder } from './milestone-order';
import { useTaskContext, type TaskContext } from './use-task-context';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

interface MilestoneFormProps {
  projectId: string;
  milestone?: Milestone;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Milestone creation / edition form, in a modal.
 * @param {MilestoneFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function MilestoneForm({ projectId, milestone, context, onDone }: MilestoneFormProps) {
  const { create, update } = useMilestoneMutations();
  const form = useAppForm<MilestoneFormValues>({
    initialValues: {
      title: milestone?.title ?? '',
      dueDate: milestone?.dueDate ?? null,
      description: milestone?.description ?? '',
    },
    schema: milestoneFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const input = { title: values.title, dueDate: values.dueDate, description: values.description || null };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(milestone ? 'Jalon modifié.' : 'Jalon créé.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (milestone) update.mutate({ id: milestone.id, input }, callbacks);
    else create.mutate({ ...input, projectId }, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        <DatePickerInput label="Échéance" clearable placeholder="—" {...form.getInputProps('dueDate')} />
        <MarkdownEditor
          label="Description"
          value={form.values.description}
          onChange={(description) => form.setFieldValue('description', description)}
          suggestions={context.suggestions}
          minRows={4}
          onSubmitShortcut={() => handleSubmit()}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {milestone ? 'Enregistrer' : 'Créer le jalon'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

let modalCount = 0;

interface SortableMilestoneProps {
  milestone: Milestone;
  /** Whether it can be dragged (manual order only). */
  sortable: boolean;
  children: ReactNode;
}

/**
 * Card of a milestone, dragged by its handle to reorder the milestones in manual order (pointer or keyboard).
 * @param {SortableMilestoneProps} props Component props.
 * @returns {JSX.Element} Card.
 */
function SortableMilestone({ milestone, sortable, children }: SortableMilestoneProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: milestone.id, disabled: !sortable });
  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p="md"
      shadow={isDragging ? 'md' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative', zIndex: isDragging ? 1 : undefined }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {sortable && (
          <ActionIcon
            ref={setActivatorNodeRef}
            variant="subtle"
            color="gray"
            aria-label={`Déplacer le jalon ${milestone.title}`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            {...attributes}
            {...listeners}
          >
            <DotsSixVerticalIcon weight="bold" aria-hidden />
          </ActionIcon>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </Group>
    </Paper>
  );
}

/**
 * Milestones of a project, in the order chosen by the user (due date, title or manual): due date, progress of their
 * tasks, description; create, edit, reorder by drag and drop (manual order), delete.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function MilestonesPanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const { remove, move } = useMilestoneMutations();
  const [order, setOrder] = useMilestoneOrder();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const today = localToday();
  if (!context) return null;
  const project = context.projectById.get(projectId);
  // Already in the chosen order.
  const milestones = context.milestones.filter((milestone) => milestone.projectId === projectId);
  const sortable = order === 'manual' && !project?.archived;

  /**
   * Moves the dropped milestone to its new place (manual order).
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = milestones.findIndex((milestone) => milestone.id === over.id);
    if (index >= 0) move.mutate({ id: String(active.id), index }, { onError: (error) => notifyError(error.message) });
  };

  /**
   * Opens the milestone form.
   * @param {Milestone} [milestone] Milestone to edit. Optional.
   * @returns {void}
   */
  const openForm = (milestone?: Milestone) => {
    const modalId = `milestone-${++modalCount}`;
    modals.open({
      modalId,
      title: milestone ? 'Modifier le jalon' : 'Nouveau jalon',
      size: 'lg',
      children: <MilestoneForm projectId={projectId} milestone={milestone} context={context} onDone={() => modals.close(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a milestone.
   * @param {Milestone} milestone Milestone.
   * @param {number} count Number of tasks using it.
   * @returns {void}
   */
  const confirmDelete = (milestone: Milestone, count: number) => {
    const modalId = `delete-milestone-${milestone.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le jalon',
      children: (
        <Stack gap="md">
          <Text size="sm">
            Le jalon « {milestone.title} » sera supprimé définitivement
            {count > 0 ? ` et retiré des ${count} tâche${count > 1 ? 's' : ''} qui l’utilisent` : ''}. Les tâches ne sont pas supprimées. Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate({ id: milestone.id }, { onSuccess: () => notifySuccess('Jalon supprimé.'), onError: (error) => notifyError(error.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Les jalons sont utilisables par les tâches du projet et de ses sous-projets.
        </Text>
        <Group gap="sm">
          <SegmentedControl size="xs" aria-label="Trier les jalons par" data={MILESTONE_ORDER_OPTIONS} value={order} onChange={(value) => setOrder(value as MilestoneOrder)} />
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>
            Nouveau jalon
          </Button>
        </Group>
      </Group>
      {milestones.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <FlagIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun jalon pour ce projet.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={milestones.map((milestone) => milestone.id)} strategy={verticalListSortingStrategy}>
            {milestones.map((milestone) => {
              const tasks = context.tasks.filter((task) => task.milestoneId === milestone.id && !task.archived);
              const done = tasks.filter((task) => context.isClosed(task)).length;
              const late = milestone.dueDate !== null && milestone.dueDate < today && done < tasks.length;
              return (
                <SortableMilestone key={milestone.id} milestone={milestone} sortable={sortable}>
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <Stack gap={2}>
                        <Group gap="xs">
                          <FlagIcon aria-hidden />
                          <Title order={3} size="h5">
                            {milestone.title}
                          </Title>
                        </Group>
                        <Text size="sm" c={late ? 'red' : 'dimmed'} fw={late ? 600 : undefined}>
                          {milestone.dueDate ? `Échéance : ${dateFormat.format(new Date(`${milestone.dueDate}T00:00:00Z`))}` : 'Sans échéance'}
                          {late && ' — en retard'}
                        </Text>
                      </Stack>
                      <Menu position="bottom-end" withinPortal shadow="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label={`Actions sur le jalon ${milestone.title}`}>
                            <DotsThreeIcon weight="bold" aria-hidden />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openForm(milestone)}>
                            Modifier
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={() => confirmDelete(milestone, tasks.length)}>
                            Supprimer
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                    <Group gap="sm" wrap="nowrap">
                      <Progress value={tasks.length ? (done / tasks.length) * 100 : 0} style={{ flex: 1 }} aria-label={`Avancement du jalon ${milestone.title}`} />
                      <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
                        {done}/{tasks.length} tâche{tasks.length > 1 ? 's' : ''}
                      </Text>
                    </Group>
                    {milestone.description && <MarkdownView targets={context.targets}>{milestone.description}</MarkdownView>}
                  </Stack>
                </SortableMilestone>
              );
            })}
          </SortableContext>
        </DndContext>
      )}
    </Stack>
  );
}
