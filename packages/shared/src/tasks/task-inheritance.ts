import { inheritsField, resolveInheritance, inheritState, type FieldOrigin, type InheritSource, type InheritedColumns } from '../core/inheritance';

/**
 * Fields a sub-task inherits from its parent (decision D11): project, assignees, beneficiaries (people and relations),
 * slot condition, « Ouverture », « Échéance », place (not the travel times: a task has none), priority, milestone.
 */
export const TASK_INHERITABLE_FIELDS = ['PROJECT', 'ASSIGNEES', 'BENEFICIARIES', 'SLOT_CONDITION', 'MIN_DATE', 'DEADLINE', 'LOCATION', 'PRIORITY', 'MILESTONE'] as const;
export type TaskInheritableField = (typeof TASK_INHERITABLE_FIELDS)[number];

/** Task as its inheritance reads it (days YYYY-MM-DD). */
export interface InheritingTask {
  id: string;
  parentId: string | null;
  /** Fields it takes from its parent (stored list). */
  inheritedFields: readonly string[];
  projectId: string | null;
  priorityId: string | null;
  milestoneId: string | null;
  minDate: string | null;
  deadline: string | null;
  slotCondition: unknown;
  location: string | null;
  locationLat: number | null;
  locationLon: number | null;
  assigneeIds: readonly string[];
  beneficiaryIds: readonly string[];
  beneficiaryRelationIds: readonly string[];
  /** Its own sprints (never inherited). */
  sprintIds: readonly string[];
}

/** Days of a sprint a task may take its dates from. */
export interface SprintDays {
  startDate: string;
  endDate: string;
}

/** Milestone a task may take its dates from: its project, its due day, archived or not. */
export interface MilestoneDays {
  projectId: string;
  dueDate: string | null;
  archived: boolean;
}

/** What the inheritance of tasks is computed from: every task of the workspace, its milestones, projects and sprints. */
export interface TaskInheritanceContext {
  tasks: ReadonlyMap<string, InheritingTask>;
  milestones: ReadonlyMap<string, MilestoneDays>;
  /** « Ouverture » of each project (its start). */
  projects: ReadonlyMap<string, { startDate: string | null }>;
  sprints: ReadonlyMap<string, SprintDays>;
}

/** Task as it goes: its effective values, and the state and source of each inherited field. */
export interface EffectiveTask extends InheritingTask {
  origins: FieldOrigin<TaskInheritableField>[];
}

/** Columns of each inherited field of a task, its dates aside (`effectiveTaskDate`). */
const TASK_COLUMNS: InheritedColumns<InheritingTask, Exclude<TaskInheritableField, 'MIN_DATE' | 'DEADLINE'>> = {
  PROJECT: ['projectId'],
  ASSIGNEES: ['assigneeIds'],
  BENEFICIARIES: ['beneficiaryIds', 'beneficiaryRelationIds'],
  SLOT_CONDITION: ['slotCondition'],
  LOCATION: ['location', 'locationLat', 'locationLon'],
  PRIORITY: ['priorityId'],
  MILESTONE: ['milestoneId'],
};

/** A date a task goes by, and where it comes from. */
interface DatedValue {
  value: string | null;
  source: InheritSource | null;
  sourceId: string | null;
}

const NO_DATE: DatedValue = { value: null, source: null, sourceId: null };

/**
 * First sprint of a task: the one starting first (then ending first).
 * @param {InheritingTask} task Task.
 * @param {TaskInheritanceContext} context Sprints.
 * @returns {{ id: string, days: SprintDays } | null} Sprint.
 */
function firstSprint(task: InheritingTask, context: TaskInheritanceContext): { id: string; days: SprintDays } | null {
  const sprints = task.sprintIds.flatMap((id) => {
    const days = context.sprints.get(id);
    return days ? [{ id, days }] : [];
  });
  sprints.sort((a, b) => a.days.startDate.localeCompare(b.days.startDate) || a.days.endDate.localeCompare(b.days.endDate) || a.id.localeCompare(b.id));
  return sprints[0] ?? null;
}

/**
 * Milestone before another one in its project: the active one of the same project due last strictly before it.
 * @param {string} milestoneId Milestone.
 * @param {TaskInheritanceContext} context Milestones.
 * @returns {{ id: string, dueDate: string } | null} Previous milestone.
 */
function previousMilestone(milestoneId: string, context: TaskInheritanceContext): { id: string; dueDate: string } | null {
  const milestone = context.milestones.get(milestoneId);
  if (!milestone?.dueDate) return null;
  let previous: { id: string; dueDate: string } | null = null;
  for (const [id, other] of context.milestones) {
    if (id === milestoneId || other.archived || other.projectId !== milestone.projectId || !other.dueDate || other.dueDate >= milestone.dueDate) continue;
    if (!previous || other.dueDate > previous.dueDate) previous = { id, dueDate: other.dueDate };
  }
  return previous;
}

/**
 * Date a task without one of its own (nor from its parent) goes by (decision D11): « Ouverture », the first that
 * exists of the « Échéance » of the milestone before its own, the « Ouverture » of its project, the start of its first
 * sprint; « Échéance », that of its milestone, else the end of its first sprint.
 * @param {'MIN_DATE' | 'DEADLINE'} field Date.
 * @param {InheritingTask} task Task, its milestone and project effective.
 * @param {TaskInheritanceContext} context Milestones, projects, sprints.
 * @returns {DatedValue} Date.
 */
function fallbackDate(field: 'MIN_DATE' | 'DEADLINE', task: InheritingTask, context: TaskInheritanceContext): DatedValue {
  const sprint = firstSprint(task, context);
  if (field === 'DEADLINE') {
    const due = task.milestoneId ? context.milestones.get(task.milestoneId)?.dueDate : null;
    if (due) return { value: due, source: 'MILESTONE', sourceId: task.milestoneId };
    return sprint ? { value: sprint.days.endDate, source: 'SPRINT', sourceId: sprint.id } : NO_DATE;
  }
  const previous = task.milestoneId ? previousMilestone(task.milestoneId, context) : null;
  if (previous) return { value: previous.dueDate, source: 'MILESTONE', sourceId: previous.id };
  const opening = task.projectId ? context.projects.get(task.projectId)?.startDate : null;
  if (opening) return { value: opening, source: 'PROJECT', sourceId: task.projectId };
  return sprint ? { value: sprint.days.startDate, source: 'SPRINT', sourceId: sprint.id } : NO_DATE;
}

/**
 * « Ouverture » or « Échéance » a task goes by (decision D11): its own; else, while it inherits it, its parent's (which
 * may itself come from the parent's milestone, project or sprint); else its own milestone, project or sprint
 * (`fallbackDate`). Emptied on purpose, it skips its parent only.
 * @param {'MIN_DATE' | 'DEADLINE'} field Date.
 * @param {InheritingTask} task Task.
 * @param {TaskInheritanceContext} context Tasks, milestones, projects, sprints.
 * @param {Set<string>} [seen] Tasks already on the way (cycles stop). Optional.
 * @returns {DatedValue} Date.
 */
function effectiveTaskDate(field: 'MIN_DATE' | 'DEADLINE', task: InheritingTask, context: TaskInheritanceContext, seen = new Set<string>()): DatedValue {
  const own = field === 'MIN_DATE' ? task.minDate : task.deadline;
  const inherits = inheritsField(task, field, context.tasks);
  if (!inherits && own) return { value: own, source: 'OWN', sourceId: null };
  seen.add(task.id);
  const parent = inherits ? context.tasks.get(task.parentId!)! : null;
  if (parent && !seen.has(parent.id)) {
    const inherited = effectiveTaskDate(field, parent, context, seen);
    if (inherited.value) return { value: inherited.value, source: 'PARENT', sourceId: parent.id };
  }
  return fallbackDate(field, resolveInheritance(task, context.tasks, TASK_COLUMNS).effective, context);
}

/**
 * Task as it goes (decision D11): each inherited field from its parent, live, up the chain; its dates also from its
 * milestone, project or first sprint (`effectiveTaskDate`). The only computation of the inheritance of a task: the API
 * reads it for every behaviour (filters, reminders, push, feasibility, overdue, conversions) and gives it to the app.
 * @param {InheritingTask} task Task.
 * @param {TaskInheritanceContext} context Tasks of the workspace (its ancestors among them), milestones, projects, sprints.
 * @returns {EffectiveTask} Effective task.
 */
export function effectiveTask(task: InheritingTask, context: TaskInheritanceContext): EffectiveTask {
  const { effective, origins } = resolveInheritance(task, context.tasks, TASK_COLUMNS);
  const dates = (['MIN_DATE', 'DEADLINE'] as const).map((field) => {
    const dated = effectiveTaskDate(field, task, context);
    const own = field === 'MIN_DATE' ? task.minDate : task.deadline;
    const origin: FieldOrigin<TaskInheritableField> = { field, state: inheritState(task, field, !own, context.tasks), source: dated.source, sourceId: dated.sourceId };
    return { dated, origin };
  });
  return { ...effective, minDate: dates[0].dated.value, deadline: dates[1].dated.value, origins: [...origins, ...dates.map((date) => date.origin)] };
}

/**
 * Origin of one field of an effective task.
 * @param {EffectiveTask} task Effective task.
 * @param {TaskInheritableField} field Field.
 * @returns {FieldOrigin<TaskInheritableField>} Origin.
 */
export const taskFieldOrigin = (task: EffectiveTask, field: TaskInheritableField): FieldOrigin<TaskInheritableField> => task.origins.find((origin) => origin.field === field)!;

