import { describe, expect, it } from 'vitest';
import { effectiveRoutine, effectiveRoutineTiming, ROUTINE_INHERITABLE_FIELDS, type InheritingRoutine } from '../../src/routines/routine-inheritance';

/**
 * A routine as its inheritance reads it.
 * @param {Partial<InheritingRoutine>} values Values given.
 * @returns {InheritingRoutine} Routine.
 */
const routine = (values: Partial<InheritingRoutine>): InheritingRoutine => ({
  id: 'r',
  parentId: null,
  inheritedFields: [],
  projectId: null,
  assigneeIds: [],
  beneficiaryIds: [],
  beneficiaryRelationIds: [],
  categoryIds: [],
  priorityId: null,
  slotCondition: null,
  opensOn: null,
  location: null,
  locationLat: null,
  locationLon: null,
  startDate: '2026-11-01',
  recurrence: { frequency: 'DAILY', interval: 1 },
  cases: [],
  moments: [],
  fromTime: null,
  dueTime: null,
  moves: [],
  ...values,
});

describe('moments of a sub-routine', () => {
  const parent = routine({ id: 'p', startDate: '2026-10-01', moments: [{ fromTime: '08:00', dueTime: '09:00', optional: false }], fromTime: '08:00', dueTime: '09:00' });
  const child = routine({
    id: 'c',
    parentId: 'p',
    // Every inheritable field, and a former « MOMENTS » left in the list.
    inheritedFields: [...ROUTINE_INHERITABLE_FIELDS, 'MOMENTS'],
    moments: [{ fromTime: '18:00', dueTime: null, optional: false }],
    fromTime: '18:00',
  });
  const byId = new Map([parent, child].map((item) => [item.id, item]));

  it('are never inherited: moments are not an inheritable field', () => {
    expect(ROUTINE_INHERITABLE_FIELDS).not.toContain('MOMENTS');
  });

  it('stay its own, its « quand » inherited', () => {
    const { routine: effective } = effectiveRoutine(child, byId);
    expect(effective.startDate).toBe('2026-10-01');
    expect(effective.moments).toEqual([{ fromTime: '18:00', dueTime: null, optional: false }]);
    expect(effective.fromTime).toBe('18:00');
  });

  it('stay its own for its occurrences too', () => {
    const timed = effectiveRoutineTiming(child, byId);
    expect(timed.startDate).toBe('2026-10-01');
    expect(timed.moments).toEqual([{ fromTime: '18:00', dueTime: null, optional: false }]);
  });
});
