import { describe, expect, it } from 'vitest';
import { hoursAllowDay, taskDueDay } from '../../src/tasks/task-hours';
import { effectiveTask } from '../../src/tasks/task-inheritance';
import { isTaskOverdue } from '../../src/tasks/task-day';
import { scheduleCase } from '../calendar/schedules';

// Doable Monday to Friday; Sunday 29 November 2026.
const WEEKDAYS = [scheduleCase({ weekdays: [1, 2, 3, 4, 5] })];
const SUNDAY = '2026-11-29';

describe('taskDueDay', () => {
  it('due on a day its hours exclude: the last day allowed before it', () => {
    expect(hoursAllowDay(WEEKDAYS, SUNDAY)).toBe(false);
    expect(taskDueDay(SUNDAY, WEEKDAYS)).toBe('2026-11-27');
    expect(taskDueDay('2026-11-30', WEEKDAYS)).toBe('2026-11-30');
  });

  it('without hours: its « Échéance »; without « Échéance »: none', () => {
    expect(taskDueDay(SUNDAY, [])).toBe(SUNDAY);
    expect(taskDueDay(SUNDAY, null)).toBe(SUNDAY);
    expect(taskDueDay(null, WEEKDAYS)).toBeNull();
  });

  it('no day allowed within a year before it: none (its « Échéance » is not taken)', () => {
    const past = [scheduleCase({ weekdays: [1] }, { until: '2024-01-01' })];
    expect(taskDueDay(SUNDAY, past)).toBeNull();
  });

  it('late from the day after its real « Échéance »', () => {
    expect(isTaskOverdue({ dueDay: taskDueDay(SUNDAY, WEEKDAYS) }, '2026-11-28')).toBe(true);
    expect(isTaskOverdue({ dueDay: taskDueDay(SUNDAY, []) }, '2026-11-28')).toBe(false);
  });
});

describe('effectiveTask: its real « Échéance »', () => {
  /**
   * A task of a test.
   * @param {string} id Id.
   * @param {object} fields Fields.
   * @returns {object} Task.
   */
  const task = (id: string, fields: Record<string, unknown>) =>
    ({ id, parentId: null, projectId: 'p', inheritedFields: [], assigneeIds: [], beneficiaryIds: [], beneficiaryRelationIds: [], slotCondition: null, hours: [], location: null, locationLat: null, locationLon: null, priorityId: null, milestoneId: null, sprintIds: [], minDate: null, deadline: null, ...fields }) as never;

  it('a sub-task inheriting its « Échéance » but not the hours: its own hours on its parent’s stored « Échéance »', () => {
    const parent = task('parent', { deadline: SUNDAY });
    const child = task('child', { parentId: 'parent', inheritedFields: ['DEADLINE'], hours: WEEKDAYS });
    const context = { tasks: new Map([['parent', parent], ['child', child]]), milestones: new Map(), projects: new Map(), sprints: new Map() } as never;
    expect(effectiveTask(parent, context)).toMatchObject({ deadline: SUNDAY, dueDay: SUNDAY });
    expect(effectiveTask(child, context)).toMatchObject({ deadline: SUNDAY, dueDay: '2026-11-27' });
  });
});
