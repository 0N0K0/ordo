import { SectionHeader } from '../../../components/page/SectionHeader';
import { PlanCard } from './PlanCard';
import { planCardActions } from '../lib/plan-card-actions';
import { DragHandle } from '../../../components/dnd/DragHandle';

import { ActionButton } from '../../../components/actions/ActionButton';
import { confirmPlanDelete } from '../lib/confirm-plan-delete';
import { TaskProgress } from './TaskProgress';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { openFormPanel } from '../../../components/panels/panels';
import { Fieldset, Group, Paper, SegmentedControl, Stack, TextInput } from '@mantine/core';
import { SortableArea } from '../../../components/dnd/sortable';
import { useSortableItem } from '../../../components/dnd/use-sortable-item';
import { DatePickerInput } from '@mantine/dates';
import type { ReactNode } from 'react';
import { milestoneFormSchema, type MilestoneFormValues } from '@ordo/shared';
import { FlagIcon, PlusIcon } from '@phosphor-icons/react';

import { useSetArchived, useArchivedToggle, unarchived } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';

import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';

import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { ON_ERROR } from '../../../lib/notify';
import { useMilestoneMutations, type Milestone } from '../api';
import { MILESTONE_ORDER_OPTIONS, useMilestoneOrder, type MilestoneOrder } from '../lib/milestone-order';
import { useTaskContext } from '../hooks/use-task-context';
import * as fmt from '../../../lib/format';

import { FormActions } from '../../../components/dialogs/FormActions';

interface MilestoneFormProps {
  projectId: string;
  milestone?: Milestone;
  onDone: () => void;
}

/**
 * Values of the form of a milestone (or of a new one).
 * @param {Milestone} [milestone] Milestone. Optional.
 * @returns {MilestoneFormValues} Values.
 */
const milestoneValues = (milestone?: Milestone): MilestoneFormValues => ({
  label: milestone?.label ?? '',
  dueDate: milestone?.dueDate ?? null,
  description: milestone?.description ?? '',
});

/**
 * Milestone form, in the side panel: a new milestone, created by its button; an existing one, saved field by field
 * (decision D22), read only once archived or in an archived project.
 * @param {MilestoneFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function MilestoneForm({ projectId, milestone, onDone }: MilestoneFormProps) {
  const { context } = useTaskContext();
  const { create, update } = useMilestoneMutations();
  const current = milestone && (context?.milestones.find((item) => item.id === milestone.id) ?? milestone);
  const readOnly = Boolean(current?.archived || context?.projectById.get(projectId)?.archived);
  const base = useAppForm<MilestoneFormValues>({ initialValues: milestoneValues(milestone), schema: milestoneFormSchema });
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
    save: milestone ? (changes) => update.mutateAsync({ id: milestone.id, input: { ...changes, ...(changes.description !== undefined && { description: changes.description || null }) } }) : null,
    schema: milestoneFormSchema,
    saved: current && milestoneValues(current),
    onBlur: ['label', 'description'],
    readOnly,
  });

  // A new milestone only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => {
    create.mutate({ label: values.label, dueDate: values.dueDate, description: values.description || null, projectId }, formCallbacks(form, 'Jalon créé.', onDone));
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {milestone && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
          <DatePickerInput label="Échéance" clearable placeholder="—" {...form.getInputProps('dueDate')} />
          <MarkdownEditor
            label="Description"
            {...fieldProps('description')}
            error={form.errors.description as string | undefined}
            suggestions={context?.suggestionsFor(milestone?.projectId ?? projectId) ?? NO_SUGGESTIONS}
            minRows={4}
            onSubmitShortcut={() => (milestone ? commit(['description']) : handleSubmit())}
          />
          {!milestone && <FormActions onCancel={onDone} submitLabel="Créer le jalon" loading={create.isPending} />}
        </Stack>
      </Fieldset>
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
        {sortable && <DragHandle item={milestone.label} {...handle} />}
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
    openFormPanel(milestone ? 'Modifier le jalon' : 'Nouveau jalon', (close) => <MilestoneForm projectId={projectId} milestone={milestone} onDone={close} />);
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
      what: `Le jalon « ${milestone.label} »`,
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
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>
              Nouveau jalon
            </ActionButton>
          </>
        }
      />
      {milestones.length === 0 ? (
        <EmptyState icon={<FlagIcon aria-hidden />} message="Aucun jalon pour ce projet." />
      ) : (
        // Manual order: the dropped milestone moves to its new place.
        <SortableArea ids={milestones.map((milestone) => milestone.id)} layout="list" onMove={(id, _, index) => move.mutate({ id, index }, ON_ERROR)}>
          {milestones.map((milestone) => {
            const tasks = unarchived(context.tasks).filter((task) => task.milestoneId === milestone.id);
            const done = tasks.filter((task) => context.isClosed(task)).length;
            const late = milestone.dueDate !== null && milestone.dueDate < today && done < tasks.length;
            return (
              <SortableMilestone key={milestone.id} milestone={milestone} sortable={sortable && !milestone.archived}>
                <PlanCard
                  icon={<FlagIcon aria-hidden />}
                  title={milestone.label}
                  archived={milestone.archived}
                  late={late ? tasks.length - done : 0}
                  dates={milestone.dueDate ? `Échéance : ${fmt.day(milestone.dueDate)}` : 'Sans échéance'}
                  actions={planCardActions(milestone, {
                    type: 'Jalon',
                    locked: Boolean(project?.archived),
                    setArchived,
                    onEdit: () => openForm(milestone),
                    onDelete: () => confirmDelete(milestone, tasks.length),
                  })}
                  progress={<TaskProgress done={done} total={tasks.length} label={`Avancement du jalon ${milestone.label}`} />}
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
