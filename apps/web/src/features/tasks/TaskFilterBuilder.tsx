import type { TableFilterGroup } from '@ordo/shared';
import { tableFilterFields } from '../../components/data-table/table-engine';
import { localToday } from '../../lib/dates';
import { filterUses } from './task-columns';
import { useTaskColumns } from './use-task-columns';
import type { TaskContext } from './use-task-context';
import { FieldsFilterBuilder } from './views/FilterBuilder';

/**
 * Filter of tasks out of their table (a chart of a dashboard…), in the words of the task table: its columns, the same
 * filter builder.
 * @param {{ filter: TableFilterGroup, context: TaskContext, onChange: (filter: TableFilterGroup) => void }} props Filter, task context, change.
 * @returns {JSX.Element} Builder.
 */
export function TaskFilterBuilder({ filter, context, onChange }: { filter: TableFilterGroup; context: TaskContext; onChange: (filter: TableFilterGroup) => void }) {
  const columns = useTaskColumns(context, localToday(), { doable: filterUses(filter, 'doableNow') });
  return <FieldsFilterBuilder filter={filter} fields={tableFilterFields(columns)} onChange={onChange} />;
}
