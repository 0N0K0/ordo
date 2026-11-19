import { countOf, plural } from '../../../lib/text';
import { Anchor, Group, Text } from '@mantine/core';
import { listSelectProps, itemChoices } from '../../../components/items/item-look';
import { ClipboardTextIcon, CopyIcon, CookingPotIcon, EyeIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';

import { Link, useNavigate } from 'react-router';
import { ActionButton } from '../../../components/actions/ActionButton';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { EditableMultiSelect, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { openFormPanel } from '../../../components/panels/panels';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { localDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { ON_ERROR, toastCallbacks } from '../../../lib/notify';
import { useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { sheetsKey, useSheetCategories, useSheetMutations, useSheets, type Sheet, type SheetCategory } from '../api';
import { sheetInput } from '../lib/sheet-format';
import { archiveItemsAction, rowMenuEntry, duplicateRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { SheetUseForm } from './SheetUseForm';
import { archiveEntry, useSetArchived, useArchivedToggle, unarchived } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { deleteSheetsAction } from '../lib/delete-sheets';
import { sheetPath } from '../../../app/pages';

/**
 * Columns of the sheets.
 * @param {TaskContext | null} context Names of the projects.
 * @param {SheetCategory[]} categories Categories of the sheets.
 * @param {boolean} inProject Shown in the tab of a project (its column hidden by default).
 * @returns {DataColumn<Sheet>[]} Columns.
 */
function sheetColumns(context: TaskContext | null, categories: SheetCategory[], inProject: boolean): DataColumn<Sheet>[] {
  const projectLabelOf = (sheet: Sheet) => (sheet.projectId ? (context?.projectLabel(sheet.projectId) ?? '') : '');
  const categoryLabel = new Map(categories.map((category) => [category.id, category.label]));
  const categoryText = (sheet: Sheet) =>
    sheet.categoryIds
      .map((id) => categoryLabel.get(id) ?? '')
      .filter(Boolean)
      .join(', ');
  const itemText = (item: Sheet['items'][number]) => `${item.label}${fmt.quantity(item) ? ` · ${fmt.quantity(item)}` : ''}`;
  return [
    { id: 'label', required: true, label: 'Libellé', size: 240, locked: true, sortValue: (sheet) => sheet.label, text: (sheet) => sheet.label },
    {
      id: 'categories',
      label: 'Catégories',
      size: 180,
      bulk: true,
      sortValue: (sheet) => categoryText(sheet) || null,
      text: categoryText,
      filter: {
        kind: 'choices',
        value: (sheet) => sheet.categoryIds,
        options: itemChoices(categories),
      },
      groupable: true,
    },
    {
      id: 'project',
      label: 'Projet',
      size: 200,
      bulk: true,
      hiddenByDefault: inProject,
      sortValue: (sheet) => projectLabelOf(sheet) || null,
      text: projectLabelOf,
      filter: {
        kind: 'choice',
        value: (sheet) => sheet.projectId ?? null,
        options: context?.projectOptions(context.projects) ?? [],
      },
      groupable: true,
    },
    { id: 'items', label: 'Éléments', size: 320, text: (sheet) => sheet.items.map(itemText).join(', ') },
    {
      id: 'usedBy',
      required: true,
      label: 'Rattachée à',
      size: 130,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (sheet) => sheet.usedBy,
      text: (sheet) => fmt.count(sheet.usedBy),
      filter: { kind: 'number', value: (sheet) => sheet.usedBy },
    },
    {
      id: 'updatedAt',
      required: true,
      label: 'Modifiée le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (sheet) => sheet.updatedAt,
      text: (sheet) => fmt.day(sheet.updatedAt),
      filter: { kind: 'date', value: (sheet) => localDay(sheet.updatedAt) },
    },
  ];
}

/**
 * Sheets (of the workspace, or of a project) in a table like every other: each opens its page (its items there);
 * categories and project changed in place (and in bulk); used (taken from the stock), copied, archived (hidden until
 * « Afficher les archivées », read only), deleted.
 * @param {{ projectId?: string | null }} props Project of the tab (none: every sheet). Optional.
 * @returns {JSX.Element} Table.
 */
export function SheetsTable({ projectId = null }: { projectId?: string | null }) {
  const navigate = useNavigate();
  const { data: sheets } = useSheets(projectId);
  const { data: categories } = useSheetCategories();
  const { context } = useTaskContext();
  const { create, update, duplicate, remove } = useSheetMutations();
  const setArchived = useSetArchived('SHEET', [sheetsKey]);
  const { shown, toggle: archivedToggle } = useArchivedToggle(sheets ?? []);
  const view = useDataView({
    tableKey: 'sheets',
    projectId,
    getKey: (sheet) => sheet.id,
    columns: sheetColumns(context, categories ?? [], projectId !== null),
    rows: shown,
    title: 'Fiches',
  });
  // The archived sheets are left as they are.
  const cellLabelOf = bulkCellLabels(view, (sheet) => sheet.label);
  const bulk = bulkSaver<Sheet, { projectId?: string | null; categoryIds?: string[] }>(
    view,
    (sheet, change) => !sheet.archived && update.mutate({ id: sheet.id, input: sheetInput(sheet, change) }, ON_ERROR),
  );

  /**
   * Creates a sheet and opens its page.
   * @returns {void}
   */
  const createSheet = () => create.mutate({ label: 'Nouvelle fiche', note: null, projectId, categoryIds: [] }, { onSuccess: (id) => navigate(sheetPath(id)), ...ON_ERROR });

  return (
    <DataTable
      framed
      view={view}
      selectionLabel={(count) => selectedLabel(count, ['fiche', 'fiches'])}
      isArchived={(sheet) => sheet.archived}
      readOnly={(sheet) => sheet.archived}
      selectionActions={(rows, clear) => [
        // An archived sheet is not copied.
        ...(rows.some((sheet) => sheet.archived)
          ? []
          : [duplicateRowsAction(rows, { duplicate: (sheet) => duplicate.mutateAsync(sheet.id), done: `${countOf(rows.length, 'fiche')} ${plural(rows.length, 'dupliquée')}.` })]),
        archiveItemsAction(rows, setArchived, { noun: 'fiche', feminine: true, clear }),
        deleteSheetsAction(rows, (sheet) => remove.mutateAsync(sheet.id), clear),
      ]}
      verticalSpacing="xs"
      highlightOnHover
      bar={{
        searchLabel: 'Rechercher (libellé, élément)',
        actions: (
          <Group gap="md">
            <ShowArchivedSwitch {...archivedToggle} label="Afficher les archivées" />
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={createSheet} loading={create.isPending}>
              Nouvelle fiche
            </ActionButton>
          </Group>
        ),
      }}
      empty={
        <EmptyState
          icon={<ClipboardTextIcon aria-hidden />}
          message="Aucune fiche : une recette, le contenu d’une valise, une trousse… à ajouter aux listes d’achats ou à cocher pour une routine, un évènement, une tâche."
        />
      }
      getKey={(sheet) => sheet.id}
      rowProps={(sheet) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(sheetPath(sheet.id)) })}
      cells={(sheet) => ({
        label: (
          <Group gap="xs" wrap="nowrap">
            <Anchor component={Link} to={sheetPath(sheet.id)} fw={600} size="sm" onClick={(event: React.MouseEvent) => event.stopPropagation()}>
              {sheet.label}
            </Anchor>
            {sheet.archived && <ArchivedBadge feminine size="xs" />}
          </Group>
        ),
        categories: (
          <div onClick={(event) => event.stopPropagation()}>
            <EditableMultiSelect
              value={sheet.categoryIds}
              label={cellLabelOf('categories', sheet, 'Catégories')}
              readOnly={sheet.archived}
              {...listSelectProps(categories ?? [], undefined, sheet.categoryIds)}
              onSave={(next) => bulk('categories')(sheet, (target) => ({ categoryIds: applyDiff(target.categoryIds, sheet.categoryIds, next) }))}
            />
          </div>
        ),
        project: context && (
          <div onClick={(event) => event.stopPropagation()}>
            <EditableSelect
              value={sheet.projectId ?? null}
              label={cellLabelOf('project', sheet, 'Projet')}
              nullable
              readOnly={sheet.archived}
              {...treeSelectProps(context.projectOptions(unarchived(context.projects, sheet.projectId)))}
              onSave={(next) => bulk('project')(sheet, { projectId: next })}
            />
          </div>
        ),
        items: (
          <StackedValues>
            {sheet.items.map((item) => (
              <Text key={item.id} size="sm" truncate title={item.note ?? undefined}>
                {item.label}
                {fmt.quantity(item) && (
                  <Text span size="sm" c="dimmed">
                    {' '}
                    · {fmt.quantity(item)}
                  </Text>
                )}
              </Text>
            ))}
          </StackedValues>
        ),
      })}
      actions={(sheet) => (
        <div onClick={(event) => event.stopPropagation()}>
          <RowActions
            name={sheet.label}
            primary={
              sheet.archived
                ? { label: 'Voir', icon: <EyeIcon aria-hidden />, onClick: () => navigate(sheetPath(sheet.id)) }
                : { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => navigate(sheetPath(sheet.id)) }
            }
            items={[
              // Archived: read only, not used anymore.
              !sheet.archived && {
                label: 'Utiliser cette fiche…',
                icon: <CookingPotIcon aria-hidden />,
                onClick: () => openFormPanel(`Utiliser « ${sheet.label} »`, (close) => <SheetUseForm sheetId={sheet.id} label={sheet.label} onDone={close} />),
              },
              !sheet.archived && { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => duplicate.mutate(sheet.id, toastCallbacks('Fiche dupliquée.')) },
              archiveEntry({ archived: sheet.archived, type: 'Fiche', label: sheet.label, feminine: true }, setArchived, sheet.id),
              rowMenuEntry(deleteSheetsAction([sheet], (row) => remove.mutateAsync(row.id))),
            ]}
          />
        </div>
      )}
    />
  );
}
