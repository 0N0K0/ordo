import type { TableFilterGroup } from '@ordo/shared';
import { tableFilterFields } from '../../../components/data-table/table/table-engine';
import { parisToday } from '../../../lib/dates';
import { filterUses } from '../lib/task-columns';
import { useTaskColumns } from '../hooks/use-task-columns';
import type { TaskContext } from '../hooks/use-task-context';
import { FieldsFilterBuilder } from '../../../components/filters/FilterBuilder';

/**
 * Filter of tasks out of their table (a chart of a dashboard…), in the words of the task table: its columns, the same
 * filter builder.
 * @param {{ filter: TableFilterGroup, context: TaskContext, onChange: (filter: TableFilterGroup) => void }} props Filter, task context, change.
 * @returns {JSX.Element} Builder.
 */
export function TaskFilterBuilder({ filter, context, onChange }: { filter: TableFilterGroup; context: TaskContext; onChange: (filter: TableFilterGroup) => void }) {
  const columns = useTaskColumns(context, parisToday(), { doable: filterUses(filter, 'doableNow') });
  return <FieldsFilterBuilder filter={filter} fields={tableFilterFields(columns)} onChange={onChange} />;
}
