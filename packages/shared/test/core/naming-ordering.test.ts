import { describe, expect, it } from 'vitest';
import { clipText, collator, copyName, countWith, fileName, fitName, nameKey, safeFilename, sameName, UNNAMED_FILE } from '../../src/core/text';
import { TEXT_MAX } from '../../src/core/rules';
import { movedTo } from '../../src/core/collections';
import { childrenByParent, isUnderOrSelf, pathOf, reaches, subtreeOf } from '../../src/core/tree';

describe('comparison of names', () => {
  it('same name: spaces around left out, inner spaces as one, case and accents aside', () => {
    expect(sameName('  Élève   modèle ', 'eleve modele')).toBe(true);
    expect(sameName('Élève', 'Elèves')).toBe(false);
    expect(nameKey(null)).toBe('');
  });

  it('names sort in French, case and accents aside, numbers by value', () => {
    expect(['b', 'Étage 10', 'étage 2', 'a'].sort(collator.compare)).toEqual(['a', 'b', 'étage 2', 'Étage 10']);
  });
});

describe('names built within 250 characters', () => {
  it('copyName: « Nom (copie) », the name cut to keep the suffix', () => {
    expect(copyName('Rapport')).toBe('Rapport (copie)');
    const long = copyName('x'.repeat(TEXT_MAX));
    expect(long).toHaveLength(TEXT_MAX);
    expect(long.endsWith(' (copie)')).toBe(true);
  });

  it('fitName: the fixed words stay whole, the name is cut', () => {
    const name = fitName('Report de « ', 'y'.repeat(300), ' »');
    expect(name).toHaveLength(TEXT_MAX);
    expect(name.startsWith('Report de « ') && name.endsWith(' »')).toBe(true);
  });

  it('clipText: trimmed, then cut', () => {
    expect(clipText('  abc  ', 2)).toBe('ab');
    expect(clipText('a'.repeat(300))).toHaveLength(TEXT_MAX);
  });
});

describe('file names', () => {
  it('characters file systems refuse become dashes; nothing left: « sans-nom »', () => {
    expect(safeFilename('a/b:c*?"<>|d')).toBe('a-b-c------d');
    expect(safeFilename('   ')).toBe(UNNAMED_FILE);
    expect(fileName('Facture 12/2026', 'pdf')).toBe('Facture 12-2026.pdf');
  });
});

describe('words of a count', () => {
  it('the count dropped for one: « sa tâche », « ses 3 tâches »', () => {
    expect(countWith(1, 'tâche', ['sa', 'ses'])).toBe('sa tâche');
    expect(countWith(3, 'tâche', ['sa', 'ses'])).toBe('ses 3 tâches');
    expect(countWith(0, 'tâche', ['sa', 'ses'])).toBe('ses 0 tâche');
  });
});

describe('manual order', () => {
  it('movedTo: an index bounded to the list', () => {
    expect(movedTo(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'x', 'b', 'c']);
    expect(movedTo(['a', 'b'], 'x', 9)).toEqual(['a', 'b', 'x']);
    expect(movedTo(['a', 'b'], 'x', -3)).toEqual(['x', 'a', 'b']);
  });
});

describe('trees', () => {
  const items = [
    { id: 'house', parentId: null, label: 'Maison' },
    { id: 'floor', parentId: 'house', label: 'Étage' },
    { id: 'room', parentId: 'floor', label: 'Chambre' },
    { id: 'orphan', parentId: 'gone', label: 'Seul' },
  ];
  const byId = new Map(items.map((item) => [item.id, item]));

  it('an item and everything under it, at any depth', () => {
    expect([...subtreeOf(items, 'house')]).toEqual(['house', 'floor', 'room']);
    expect([...subtreeOf(items, 'house', false)]).toEqual(['floor', 'room']);
  });

  it('path from the top: « Maison › Étage › Chambre »', () => {
    expect(pathOf(byId, 'room', (item) => item.label)).toBe('Maison › Étage › Chambre');
  });

  it('an item whose parent is missing comes at the top level', () => {
    expect(childrenByParent(items).get(null)?.map((item) => item.id)).toEqual(['house', 'orphan']);
  });

  it('no loop: an item cannot go under itself or one of its descendants', () => {
    const parentOf = new Map(items.map((item) => [item.id, item.parentId]));
    expect(isUnderOrSelf(parentOf, 'room', 'house')).toBe(true);
    expect(isUnderOrSelf(parentOf, 'house', 'house')).toBe(true);
    expect(isUnderOrSelf(parentOf, 'house', 'room')).toBe(false);
  });

  it('reaches follows links, cycles stopping', () => {
    const links: Record<string, string[]> = { a: ['b'], b: ['a', 'c'], c: [] };
    expect(reaches((id) => links[id] ?? [], ['a'], 'c')).toBe(true);
    expect(reaches((id) => links[id] ?? [], ['c'], 'a')).toBe(false);
  });
});
