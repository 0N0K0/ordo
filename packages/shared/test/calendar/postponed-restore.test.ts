import { describe, expect, it } from 'vitest';
import { postponedRestoreRefusal } from '../../src/calendar/calendar';

describe('postponedRestoreRefusal', () => {
  it('names the first day of the postponement, one final dot', () => {
    expect(postponedRestoreRefusal('2026-11-06')).toBe('Supprimez d’abord le report du ven. 6 nov.');
  });
  it('adds the dot after a month without abbreviation', () => {
    expect(postponedRestoreRefusal('2026-05-08')).toBe('Supprimez d’abord le report du ven. 8 mai.');
  });
});
