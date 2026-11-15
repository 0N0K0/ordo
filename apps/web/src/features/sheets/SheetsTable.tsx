import { Text } from '@mantine/core';
import { ClipboardTextIcon, CopyIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../components/actions/ActionButton';
import { DataTable } from '../../components/data-table/DataTable';
import { bulkSaver } from '../../components/data-table/bulk-edit';
import type { DataColumn } from '../../components/data-table/data-table';
import { EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import { RowActions } from '../../components/data-table/RowActions';
import { StackedValues } from '../../components/data-table/StackedValues';
import { useDataView } from '../../components/data-table/use-data-view';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../components/feedback/EmptyState';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { localDay } from '../../lib/dates';
import * as fmt from '../../lib/format';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { useSheetMutations, useSheets, type Sheet } from './api';
import { openSheetForm } from './open-sheet-form';
import { quantityText, sheetInput } from './sheet-format';

/**
 * Columns of the sheets.
 * @param {TaskContext | null} context Names of the projects.
 * @param {boolean} inProject Shown in the tab of a project (its column left out by default).
 * @returns {DataColumn<Sheet>[]} Columns.
 */
function sheetColumns(context: TaskContext | null, inProject: boolean): DataColumn<Sheet>[] {
  const projectName = (sheet: Sheet) => (sheet.projectId ? (context?.projectLabel(sheet.projectId) ?? '') : '');
  const itemText = (item: Sheet['items'][number]) => `${item.label}${quantityText(item) ? ` · ${quantityText(item)}` : ''}`;
  return [
    { id: 'name', label: 'Nom', size: 240, locked: true, bulk: true, sortValue: (sheet) => sheet.name, text: (sheet) => sheet.name },
    {
      id: 'project',
      label: 'Projet',
      size: 200,
      bulk: true,
      hiddenByDefault: inProject,
      sortValue: (sheet) => projectName(sheet) || null,
      text: projectName,
      filter: {
        kind: 'choice',
        value: (sheet) => sheet.projectId ?? null,
        options: (context?.projects ?? []).map((project) => ({ value: project.id, label: context?.projectLabel(project.id) ?? project.title })),
      },
      groupable: true,
    },
    { id: 'items', label: 'Éléments', size: 320, text: (sheet) => sheet.items.map(itemText).join(', ') },
    {
      id: 'count',
      label: 'Nombre d’éléments',
      size: 140,
      numeric: true,
      sortValue: (sheet) => sheet.items.length,
      text: (sheet) => String(sheet.items.length),
      filter: { kind: 'number', value: (sheet) => sheet.items.length },
    },
    {
      id: 'usedBy',
      label: 'Rattachée à',
      size: 130,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (sheet) => sheet.usedBy,
      text: (sheet) => (sheet.usedBy ? String(sheet.usedBy) : ''),
      filter: { kind: 'number', value: (sheet) => sheet.usedBy },
    },
    {
      id: 'updatedAt',
      label: 'Modifiée le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (sheet) => String(sheet.updatedAt),
      text: (sheet) => fmt.day(new Date(sheet.updatedAt)),
      filter: { kind: 'date', value: (sheet) => localDay(new Date(sheet.updatedAt)) },
    },
  ];
}

/**
 * Sheets (of the workspace, or of a project) in a table like every other: their items, one under the other, edited in
 * their form (side panel); named and moved to a project in place (and in bulk); copied, deleted.
 * @param {{ projectId?: string | null }} props Project of the tab (none: every sheet). Optional.
 * @returns {JSX.Element} Table.
 */
export function SheetsTable({ projectId = null }: { projectId?: string | null }) {
  const { data: sheets } = useSheets(projectId);
  const { context } = useTaskContext();
  const { update, duplicate, remove } = useSheetMutations();
  const view = useDataView({
    tableKey: 'sheets',
    projectId,
    getKey: (sheet) => sheet.id,
    columns: sheetColumns(context, projectId !== null),
    rows: sheets ?? [],
    title: 'Fiches',
  });
  const onError = { onError: (error: Error) => notifyError(error.message) };
  const bulk = bulkSaver<Sheet, { name?: string; projectId?: string | null }>(view, (sheet, change) => update.mutate({ id: sheet.id, input: sheetInput(sheet, change) }, onError));

  return (
    <DataTable
      framed
      view={view}
      verticalSpacing="xs"
      highlightOnHover
      bar={{
        searchLabel: 'Rechercher (nom, élément)',
        actions: (
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openSheetForm(undefined, projectId)}>
            Nouvelle fiche
          </ActionButton>
        ),
      }}
      empty={
        <EmptyState
          icon={<ClipboardTextIcon aria-hidden />}
          message="Aucune fiche : une recette, le contenu d’une valise, une trousse… à ajouter aux listes d’achats ou à cocher pour une routine, un évènement, une tâche."
        />
      }
      getKey={(sheet) => sheet.id}
      cells={(sheet) => ({
        name: <EditableText value={sheet.name} label={`Nom de ${sheet.name}`} strong onSave={(name) => name && bulk('name')(sheet, { name })} />,
        project: context && (
          <EditableSelect
            value={sheet.projectId ?? null}
            label={`Projet de ${sheet.name}`}
            nullable
            {...treeSelectProps(context.projectOptions(context.projects.filter((project) => !project.archived || project.id === sheet.projectId)))}
            onSave={(next) => bulk('project')(sheet, { projectId: next })}
          />
        ),
        items: (
          <StackedValues>
            {sheet.items.map((item) => (
              <Text key={item.id} size="sm" truncate title={item.note ?? undefined}>
                {item.label}
                {quantityText(item) && (
                  <Text span size="sm" c="dimmed">
                    {' '}
                    · {quantityText(item)}
                  </Text>
                )}
              </Text>
            ))}
          </StackedValues>
        ),
      })}
      actions={(sheet) => (
        <RowActions
          name={sheet.name}
          primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openSheetForm(sheet) }}
          items={[
            { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => duplicate.mutate(sheet.id, { onSuccess: () => notifySuccess('Fiche dupliquée.'), ...onError }) },
            {
              label: 'Supprimer',
              icon: <TrashIcon aria-hidden />,
              danger: true,
              onClick: () =>
                confirmDestructive({
                  title: 'Supprimer la fiche',
                  risks: `« ${sheet.name} » et ses ${sheet.items.length} élément(s) seront supprimés définitivement${sheet.usedBy ? `, et retirés des ${sheet.usedBy} routine(s), évènement(s) ou tâche(s) qui l’ont` : ''}. Les listes d’achats et les listes à cocher déjà faites la gardent.`,
                  onConfirm: () => remove.mutate(sheet.id, { onSuccess: () => notifySuccess('Fiche supprimée.'), ...onError }),
                }),
            },
          ]}
        />
      )}
    />
  );
}
