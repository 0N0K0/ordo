import { describe, expect, it } from 'vitest';
import { readTableColumnDefaults } from '../../src/tables/table-layout';
import { newTableViewConfig, tableViewConfig, viewColumnLayout } from '../../src/tables/table-views';

describe('newTableViewConfig: what a new view of a table starts with', () => {
  it('without columns chosen for the workspace, the app ones (an empty layout)', () => {
    expect(viewColumnLayout(newTableViewConfig(undefined))).toEqual({ columnOrder: [], hiddenColumns: [], columnSizing: {} });
    expect(viewColumnLayout(newTableViewConfig(readTableColumnDefaults(null, 'tasks')))).toEqual({ columnOrder: [], hiddenColumns: [], columnSizing: {} });
  });

  it('the columns chosen for the workspace, their order and those hidden, no widths', () => {
    const columns = readTableColumnDefaults({ columnOrder: ['label', 'due', 'state'], hiddenColumns: ['state'] }, 'tasks');
    expect(viewColumnLayout(newTableViewConfig(columns))).toEqual({ columnOrder: ['label', 'due', 'state'], hiddenColumns: ['state'], columnSizing: {} });
  });

  it('the old id of the label column read as `label`', () => {
    const columns = readTableColumnDefaults({ columnOrder: ['title', 'due'], hiddenColumns: [] }, 'tasks');
    expect(newTableViewConfig(columns).columnOrder).toEqual(['label', 'due']);
  });

  it('the settings of its own over the columns, the rest as a blank view', () => {
    const columns = readTableColumnDefaults({ columnOrder: ['label', 'due'], hiddenColumns: ['due'] }, 'tasks');
    const config = newTableViewConfig(columns, { hiddenColumns: [], groupBy: 'due' });
    expect(config).toEqual({ ...tableViewConfig(), columnOrder: ['label', 'due'], hiddenColumns: [], groupBy: 'due' });
  });
});

describe('viewColumnLayout: layout of the columns of a view', () => {
  it('empty without a view', () => {
    expect(viewColumnLayout(null)).toEqual({ columnOrder: [], hiddenColumns: [], columnSizing: {} });
  });

  it('its order, hidden columns and widths', () => {
    const config = tableViewConfig({ columnOrder: ['a', 'b'], hiddenColumns: ['b'], columnSizing: { a: 120 } });
    expect(viewColumnLayout(config)).toEqual({ columnOrder: ['a', 'b'], hiddenColumns: ['b'], columnSizing: { a: 120 } });
  });
});
