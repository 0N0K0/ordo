import { plural, countOf } from '../../../lib/text';
import { Anchor, Text } from '@mantine/core';
import { listSelectProps } from '../../../components/settings/item-look';
import { ClipboardTextIcon, CopyIcon, CookingPotIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { ActionButton } from '../../../components/actions/ActionButton';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { applyDiff, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { EditableMultiSelect, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { openFormPanel } from '../../../components/panels/panels';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { localDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { useSheetCategories, useSheetMutations, useSheets, type Sheet, type SheetCategory } from '../api';
import { quantityText, sheetInput } from '../lib/sheet-format';
import { deleteRowsAction, duplicateRowsAction } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { SheetUseForm } from './SheetUseForm';

/**
 * Columns of the sheets.
 * @param {TaskContext | null} context Names of the projects.
 * @param {SheetCategory[]} categories Categories of the sheets.
 * @param {boolean} inProject Shown in the tab of a project (its column hidden by default).
 * @returns {DataColumn<Sheet>[]} Columns.
 */
function sheetColumns(context: TaskContext | null, categories: SheetCategory[], inProject: boolean): DataColumn<Sheet>[] {
  const projectName = (sheet: Sheet) => (sheet.projectId ? (context?.projectLabel(sheet.projectId) ?? '') : '');
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const categoryText = (sheet: Sheet) =>
    sheet.categoryIds
      .map((id) => categoryName.get(id) ?? '')
      .filter(Boolean)
      .join(', ');
  const itemText = (item: Sheet['items'][number]) => `${item.label}${quantityText(item) ? ` · ${quantityText(item)}` : ''}`;
  return [
    { id: 'name', label: 'Nom', size: 240, locked: true, sortValue: (sheet) => sheet.name, text: (sheet) => sheet.name },
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
        options: categories.map((category) => ({ value: category.id, label: category.name, color: category.color ?? 'gray', iconUrl: category.iconUrl })),
      },
      groupable: true,
    },
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
 * Sheets (of the workspace, or of a project) in a table like every other: each opens its page (its items there);
 * categories and project changed in place (and in bulk); used (taken from the stock), copied, deleted.
 * @param {{ projectId?: string | null }} props Project of the tab (none: every sheet). Optional.
 * @returns {JSX.Element} Table.
 */
export function SheetsTable({ projectId = null }: { projectId?: string | null }) {
  const navigate = useNavigate();
  const { data: sheets } = useSheets(projectId);
  const { data: categories } = useSheetCategories();
  const { context } = useTaskContext();
  const { create, update, duplicate, remove } = useSheetMutations();
  const view = useDataView({
    tableKey: 'sheets',
    projectId,
    getKey: (sheet) => sheet.id,
    columns: sheetColumns(context, categories ?? [], projectId !== null),
    rows: sheets ?? [],
    title: 'Fiches',
  });
  const onError = { onError: onMutationError };
  const bulk = bulkSaver<Sheet, { projectId?: string | null; categoryIds?: string[] }>(view, (sheet, change) => update.mutate({ id: sheet.id, input: sheetInput(sheet, change) }, onError));

  /**
   * Creates a sheet and opens its page.
   * @returns {void}
   */
  const createSheet = () => create.mutate({ name: 'Nouvelle fiche', note: null, projectId, categoryIds: [] }, { onSuccess: (id) => navigate(`/sheets/${id}`), ...onError });

  return (
    <DataTable
      framed
      view={view}
      selectionLabel={(count) => selectedLabel(count, ['fiche', 'fiches'])}
      selectionActions={(rows, clear) => [
        duplicateRowsAction(rows, { duplicate: (sheet) => duplicate.mutateAsync(sheet.id), done: `${countOf(rows.length, 'fiche')} ${plural(rows.length, 'dupliquée')}.` }),
        deleteRowsAction(rows, {
          title: 'Supprimer les fiches',
          risks: `${countOf(rows.length, 'fiche')} et leurs éléments seront supprimées définitivement ; les listes et routines qui les utilisent ne les verront plus. Cette action est irréversible.`,
          remove: (sheet) => remove.mutateAsync(sheet.id),
          done: `${countOf(rows.length, 'fiche')} ${plural(rows.length, 'supprimée')}.`,
          clear,
        }),
      ]}
      verticalSpacing="xs"
      highlightOnHover
      bar={{
        searchLabel: 'Rechercher (nom, élément)',
        actions: (
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={createSheet} loading={create.isPending}>
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
      rowProps={(sheet) => ({ style: { cursor: 'pointer' }, onClick: () => navigate(`/sheets/${sheet.id}`) })}
      cells={(sheet) => ({
        name: (
          <Anchor component={Link} to={`/sheets/${sheet.id}`} fw={600} size="sm" onClick={(event: React.MouseEvent) => event.stopPropagation()}>
            {sheet.name}
          </Anchor>
        ),
        categories: (
          <div onClick={(event) => event.stopPropagation()}>
            <EditableMultiSelect
              value={sheet.categoryIds}
              label={`Catégories de ${sheet.name}`}
              {...listSelectProps(categories ?? [])}
              onSave={(next) => bulk('categories')(sheet, (target) => ({ categoryIds: applyDiff(target.categoryIds, sheet.categoryIds, next) }))}
            />
          </div>
        ),
        project: context && (
          <div onClick={(event) => event.stopPropagation()}>
            <EditableSelect
              value={sheet.projectId ?? null}
              label={`Projet de ${sheet.name}`}
              nullable
              {...treeSelectProps(context.projectOptions(context.projects.filter((project) => !project.archived || project.id === sheet.projectId)))}
              onSave={(next) => bulk('project')(sheet, { projectId: next })}
            />
          </div>
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
        <div onClick={(event) => event.stopPropagation()}>
          <RowActions
            name={sheet.name}
            primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => navigate(`/sheets/${sheet.id}`) }}
            items={[
              {
                label: 'Utiliser cette fiche…',
                icon: <CookingPotIcon aria-hidden />,
                onClick: () => openFormPanel(`Utiliser « ${sheet.name} »`, (close) => <SheetUseForm sheetId={sheet.id} name={sheet.name} onDone={close} />),
              },
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
        </div>
      )}
    />
  );
}
