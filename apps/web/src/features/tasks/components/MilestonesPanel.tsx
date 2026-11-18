import { SectionHeader } from '../../../components/page/SectionHeader';
import { PlanCard } from './PlanCard';
import { DragHandle } from '../../../components/actions/DragHandle';

import { ActionButton } from '../../../components/actions/ActionButton';
import { confirmPlanDelete } from '../lib/confirm-plan-delete';
import { TaskProgress } from './TaskProgress';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { openFormPanel } from '../../../components/panels/panels';
import { Group, Paper, SegmentedControl, Stack, TextInput } from '@mantine/core';
import { SortableArea } from '../../../components/actions/sortable';
import { useSortableItem } from '../../../components/actions/use-sortable-item';
import { DatePickerInput } from '@mantine/dates';
import type { ReactNode } from 'react';
import { milestoneFormSchema, type MilestoneFormValues } from '@ordo/shared';
import { FlagIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { archiveEntry, useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';

import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { ON_ERROR } from '../../../lib/notify';
import { useMilestoneMutations, type Milestone } from '../api';
import { MILESTONE_ORDER_OPTIONS, useMilestoneOrder, type MilestoneOrder } from '../lib/milestone-order';
import { useTaskContext, type TaskContext } from '../hooks/use-task-context';
import * as fmt from '../../../lib/format';

import { FormActions } from '../../../components/dialogs/FormActions';

interface MilestoneFormProps {
  projectId: string;
  milestone?: Milestone;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Milestone creation / edition form, in the side panel.
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
    const callbacks = formCallbacks(form, milestone ? 'Jalon modifié.' : 'Jalon créé.', onDone);
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
          suggestions={context.suggestionsFor(milestone?.projectId ?? projectId)}
          minRows={4}
          onSubmitShortcut={() => handleSubmit()}
        />
        <FormActions onCancel={onDone} submitLabel={milestone ? 'Enregistrer' : 'Créer le jalon'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}

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
  const { ref, style, dragging, handle } = useSortableItem(milestone.id, !sortable);
  return (
    <Paper ref={ref} withBorder radius="md" p="md" shadow={dragging ? 'md' : undefined} style={style}>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {sortable && (
          <DragHandle label={`Déplacer le jalon ${milestone.title}`} {...handle} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </Group>
    </Paper>
  );
}

/**
 * Milestones of a project, in the order chosen by the user (due date, title or manual): due date, progress of their
 * tasks, description; create, edit, reorder by drag and drop (manual order), archive (hidden until « Afficher les
 * archivés », read only), delete.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function MilestonesPanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const { remove, move, update } = useMilestoneMutations();
  const setArchived = useSetArchived('MILESTONE');
  const [order, setOrder] = useMilestoneOrder();
  const today = localToday();
  // Already in the chosen order.
  const all = (context?.milestones ?? []).filter((milestone) => milestone.projectId === projectId);
  const { shown: milestones, toggle: archivedToggle } = useArchivedToggle(all);
  if (!context) return null;
  const project = context.projectById.get(projectId);
  const sortable = order === 'manual' && !project?.archived;

  /**
   * Opens the milestone form.
   * @param {Milestone} [milestone] Milestone to edit. Optional.
   * @returns {void}
   */
  const openForm = (milestone?: Milestone) => {
    openFormPanel(milestone ? 'Modifier le jalon' : 'Nouveau jalon', (close) => <MilestoneForm projectId={projectId} milestone={milestone} context={context} onDone={close} />);
  };

  /**
   * Asks for confirmation before deleting a milestone.
   * @param {Milestone} milestone Milestone.
   * @param {number} count Number of tasks using it.
   * @returns {void}
   */
  const confirmDelete = (milestone: Milestone, count: number) => {
    confirmPlanDelete({
      title: 'Supprimer le jalon',
      what: `Le jalon « ${milestone.title} »`,
      count,
      link: 'qui l’utilisent',
      done: 'Jalon supprimé.',
      remove: () => remove.mutateAsync({ id: milestone.id }),
    });
  };

  return (
    <Stack gap="md">
      <SectionHeader
        description="Les jalons sont utilisables par les tâches du projet et de ses sous-projets."
        actions={
          <>
            <ShowArchivedSwitch {...archivedToggle} />
            <SegmentedControl size="xs" aria-label="Trier les jalons par" data={MILESTONE_ORDER_OPTIONS} value={order} onChange={(value) => setOrder(value as MilestoneOrder)} />
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>Nouveau jalon</ActionButton>
          </>
        }
      />
      {milestones.length === 0 ? (
        <EmptyState icon={<FlagIcon aria-hidden />} message="Aucun jalon pour ce projet." />
      ) : (
        // Manual order: the dropped milestone moves to its new place.
        <SortableArea ids={milestones.map((milestone) => milestone.id)} layout="list" onMove={(id, _, index) => move.mutate({ id, index }, ON_ERROR)}>
            {milestones.map((milestone) => {
              const tasks = context.tasks.filter((task) => task.milestoneId === milestone.id && !task.archived);
              const done = tasks.filter((task) => context.isClosed(task)).length;
              const late = milestone.dueDate !== null && milestone.dueDate < today && done < tasks.length;
              return (
                <SortableMilestone key={milestone.id} milestone={milestone} sortable={sortable && !milestone.archived}>
                  <PlanCard
                    icon={<FlagIcon aria-hidden />}
                    title={milestone.title}
                    badges={milestone.archived && <ArchivedBadge size="sm" />}
                    dates={`${milestone.dueDate ? `Échéance : ${fmt.day(milestone.dueDate)}` : 'Sans échéance'}${late ? ' — en retard' : ''}`}
                    datesColor={late ? 'red' : undefined}
                    actions={[
                      // Archived (or of an archived project): read only.
                      !milestone.archived && !project?.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(milestone) },
                      archiveEntry({ archived: milestone.archived, label: `Jalon « ${milestone.title} »` }, setArchived, milestone.id),
                      { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(milestone, tasks.length) },
                    ]}
                    progress={<TaskProgress done={done} total={tasks.length} label={`Avancement du jalon ${milestone.title}`} />}
                    description={milestone.description}
                    targets={context.targetsFor(milestone.projectId)}
                    onDescription={milestone.archived || project?.archived ? undefined : (description) => update.mutate({ id: milestone.id, input: { description } }, ON_ERROR)}
                  />
                </SortableMilestone>
              );
            })}
        </SortableArea>
      )}
    </Stack>
  );
}
