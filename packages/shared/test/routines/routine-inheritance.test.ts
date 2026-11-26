import { describe, expect, it } from 'vitest';
import { effectiveRoutine, effectiveRoutineTiming, ROUTINE_INHERITABLE_FIELDS, ROUTINE_WHEN_FIELDS, type InheritingRoutine } from '../../src/routines/routine-inheritance';

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
  const own = [{ fromTime: '18:00', dueTime: null, optional: false }];
  const heir = routine({ id: 'c', parentId: 'p', inheritedFields: [...ROUTINE_INHERITABLE_FIELDS], moments: own, fromTime: '18:00' });
  const apart = routine({ id: 'd', parentId: 'p', inheritedFields: ROUTINE_INHERITABLE_FIELDS.filter((field) => field !== 'MOMENTS'), moments: own, fromTime: '18:00' });
  const byId = new Map([parent, heir, apart].map((item) => [item.id, item]));

  it('are an inheritable field of its « quand »', () => {
    expect(ROUTINE_INHERITABLE_FIELDS).toContain('MOMENTS');
    expect(ROUTINE_WHEN_FIELDS).toContain('MOMENTS');
  });

  it('inherited, are those of its parent, with its window', () => {
    const { routine: effective } = effectiveRoutine(heir, byId);
    expect(effective.startDate).toBe('2026-10-01');
    expect(effective.moments).toEqual(parent.moments);
    expect(effective.fromTime).toBe('08:00');
    expect(effective.dueTime).toBe('09:00');
  });

  it('inherited, are those of its parent for its occurrences too', () => {
    expect(effectiveRoutineTiming(heir, byId).moments).toEqual(parent.moments);
  });

  it('own, stay its own, the rest of its « quand » inherited', () => {
    const timed = effectiveRoutineTiming(apart, byId);
    expect(timed.startDate).toBe('2026-10-01');
    expect(timed.moments).toEqual(own);
  });
});
