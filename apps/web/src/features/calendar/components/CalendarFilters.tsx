import { Stack } from '@mantine/core';
import type { CalendarFilterKind, TableFilterGroup } from '@ordo/shared';
import { sumOf } from '@ordo/shared';
import { ToolbarFilter } from '../../../components/data-table/toolbar/TableToolbar';
import { FieldsFilterBuilder } from '../../../components/filters/FilterBuilder';
import { countConditions } from '../../../components/filters/filter-meta';
import { LabeledField } from '../../../components/inputs/LabeledField';
import type { CalendarFilterSection } from '../hooks/use-calendar-filters';

/**
 * « Filtrer » of the calendar: one editor, with a section per kind of items the view shows (events, tasks, routines,
 * chronos, créneaux, éphémérides), each with the fields of its table; its conditions apply to the items of its kind only.
 * @param {{ sections: CalendarFilterSection[], onChange: (kind: CalendarFilterKind, filter: TableFilterGroup) => void }} props Component props: sections, change of the filter of a kind.
 * @returns {JSX.Element} Button and its editor.
 */
export function CalendarFilters({ sections, onChange }: { sections: CalendarFilterSection[]; onChange: (kind: CalendarFilterKind, filter: TableFilterGroup) => void }) {
  return (
    <ToolbarFilter count={sumOf(sections, (section) => countConditions(section.filter))}>
      <Stack gap="md">
        {sections.map((section) => (
          <LabeledField key={section.kind} label={section.title} gap="xs">
            <FieldsFilterBuilder filter={section.filter} fields={section.fields} onChange={(filter) => onChange(section.kind, filter)} />
          </LabeledField>
        ))}
      </Stack>
    </ToolbarFilter>
  );
}
