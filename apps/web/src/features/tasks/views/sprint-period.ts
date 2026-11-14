import type { FilterCondition, FilterGroup } from '@ordo/shared';
import type { TaskContext } from '../use-task-context';

/**
 * Sprints a filter of a view targets: those it names (in, all of), and those of its relative conditions (current,
 * previous, next, past, future sprint) on a day; the excluding conditions (not in, without sprint) none.
 * @param {FilterGroup} filter Filter of the view.
 * @param {TaskContext} context Task context (sprints and project trees).
 * @param {string} today Today, YYYY-MM-DD.
 * @returns {TaskContext['sprints']} Sprints.
 */
function targetedSprints(filter: FilterGroup, context: TaskContext, today: string): TaskContext['sprints'] {
  const conditions: FilterCondition[] = [];
  const walk = (group: FilterGroup) => {
    for (const child of group.children) {
      if (child.type === 'group') walk(child);
      else if (child.field === 'sprint') conditions.push(child);
    }
  };
  walk(filter);
  const sprints = context.sprints;
  const day = (value: unknown) => String(value).slice(0, 10);
  const past = sprints.filter((sprint) => day(sprint.endDate) < today);
  const future = sprints.filter((sprint) => day(sprint.startDate) > today);
  /**
   * The best sprint of each project tree.
   * @param {TaskContext['sprints']} candidates Sprints.
   * @param {(a: TaskContext['sprints'][number], b: TaskContext['sprints'][number]) => boolean} better Whether a beats b.
   * @returns {TaskContext['sprints']} Sprints.
   */
  const bestPerTree = (candidates: TaskContext['sprints'], better: (a: TaskContext['sprints'][number], b: TaskContext['sprints'][number]) => boolean) => {
    const best = new Map<string, TaskContext['sprints'][number]>();
    for (const sprint of candidates) {
      const root = context.rootOf(sprint.projectId)!;
      const current = best.get(root);
      if (!current || better(sprint, current)) best.set(root, sprint);
    }
    return [...best.values()];
  };
  const found = new Map<string, TaskContext['sprints'][number]>();
  for (const condition of conditions) {
    const add = (items: TaskContext['sprints']) => items.forEach((sprint) => found.set(sprint.id, sprint));
    switch (condition.operator) {
      case 'in':
      case 'allOf':
        add(sprints.filter((sprint) => (condition.value as string[]).includes(sprint.id)));
        break;
      case 'current':
        add(sprints.filter((sprint) => day(sprint.startDate) <= today && day(sprint.endDate) >= today));
        break;
      case 'past':
        add(past);
        break;
      case 'future':
        add(future);
        break;
      case 'previous':
        add(bestPerTree(past, (a, b) => day(a.endDate) > day(b.endDate)));
        break;
      case 'next':
        add(bestPerTree(future, (a, b) => day(a.startDate) < day(b.startDate)));
        break;
    }
  }
  return [...found.values()];
}

/**
 * Period of the events listed with the tasks of a view filtering sprints: from the start of the first sprint it
 * targets to the end of the last one; none when it targets no sprint.
 * @param {FilterGroup} filter Filter of the view.
 * @param {TaskContext} context Task context.
 * @param {string} today Today, YYYY-MM-DD.
 * @returns {{ from: string, to: string } | null} Days, included.
 */
export function sprintPeriod(filter: FilterGroup, context: TaskContext, today: string): { from: string; to: string } | null {
  const sprints = targetedSprints(filter, context, today);
  if (!sprints.length) return null;
  const starts = sprints.map((sprint) => String(sprint.startDate).slice(0, 10)).sort();
  const ends = sprints.map((sprint) => String(sprint.endDate).slice(0, 10)).sort();
  return { from: starts[0], to: ends[ends.length - 1] };
}
