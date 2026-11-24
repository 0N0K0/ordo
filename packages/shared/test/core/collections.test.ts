import { describe, expect, it } from 'vitest';
import { placedWithoutClash } from '../../src/core/collections';

describe('placedWithoutClash: items held under one key at most', () => {
  it('one whose new key is held by an item staying stays where it is', () => {
    expect(placedWithoutClash([{ before: 'a', after: 'b' }], ['b'])).toEqual([false]);
    expect(placedWithoutClash([{ before: 'a', after: 'b' }], ['c'])).toEqual([true]);
  });

  it('one moved there before holds it; one that goes frees its former key', () => {
    expect(placedWithoutClash([{ before: 'a', after: 'c' }, { before: 'b', after: 'c' }], [])).toEqual([true, false]);
    expect(placedWithoutClash([{ before: 'b', after: 'c' }, { before: 'a', after: 'b' }], ['b'])).toEqual([true, true]);
  });

  it('nothing to move: nothing placed', () => {
    expect(placedWithoutClash([], ['a'])).toEqual([]);
  });
});
