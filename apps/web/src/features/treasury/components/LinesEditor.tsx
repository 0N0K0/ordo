import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { createInPanel } from '../../../components/settings/create-settings-item';
import { useCategoryCreators } from '../hooks/use-settings-items';
import { ContextForm, RelationForm } from './TeamPanel';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { useActiveWorkspace } from '../../workspaces/api';
import { memberOrRelation, memberOrRelationKey, memberRelationOptions, parsePersonKey } from '../../../components/people/people-keys';
import { unarchived } from '../../../lib/archive';
import { SidePanel } from '../../../components/panels/SidePanel';
import { listSelectProps } from '../../../components/items/item-look';
import { ActionIcon, Button, Group, Indicator, ScrollArea, SegmentedControl, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { EVERYDAY_CONTEXT, plannedContext, round2, splitAmounts, type TreasuryLineMode } from '@ordo/shared';
import { PaperclipIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { TreasurySettings } from '../api';
import { categoryOptions } from '../lib/categories';
import { LineAttachments } from './LineAttachments';
import { attachmentCount, categoryForDirection, newLine, valueInMode, type LineValues } from '../lib/lines';
import { treeSelectProps, type TreeOption } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { SignedAmount } from '../../../components/money/SignedAmount';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { meName } from '../../../components/people/people-options';

interface LinesEditorProps {
  lines: LineValues[];
  onChange: (lines: LineValues[]) => void;
  /** Amount of the entry, positive, and its direction. */
  amount: number;
  direction: 'IN' | 'OUT';
  /** Day of the entry: the context planned then is proposed. */
  date: string;
  settings: TreasurySettings | undefined;
  errors: Record<string, unknown>;
  /** Entry edited, null for a new one. */
  entryId: string | null;
  projects: TreeOption[];
  /** Supporting documents, grouped by place. */
  documentGroups: { group: string; items: { value: string; label: string }[] }[];
}

/**
 * Split of an entry into lines: amount (€) or percentage, positive (in the direction of the entry) or negative,
 * for a member, in a category of its direction and a context (none: everyday spending, the planned one proposed).
 * Each line has its project, supporting documents and links (lines of other entries, whole entries without lines).
 * What the lines leave is "not split" (no category). A table, one line per row; splits equally between the members
 * in one click; a context can be created from a line.
 * @param {LinesEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function LinesEditor({ lines, onChange, amount, direction, date, settings, errors, entryId, projects, documentGroups }: LinesEditorProps) {
  // Line whose attachments are edited.
  const [attaching, setAttaching] = useState<number | null>(null);
  const sign = direction === 'IN' ? 1 : -1;
  const { perso } = useActiveWorkspace();
  const members = settings?.treasuryMembers ?? [];
  const contexts = settings?.treasuryContexts ?? [];
  const categories = settings?.treasuryCategories ?? [];
  // A relation or a context created from a line, with its own form (the name typed filled in).
  const createRelation = async (name: string) => {
    const id = await createInPanel('Nouvelle relation', (done) => <RelationForm name={name} onDone={done} />);
    return id && memberOrRelationKey({ relationId: id });
  };
  const createCategory = useCategoryCreators(categories);
  const createContext = (name: string) => createInPanel('Nouveau contexte', (done) => <ContextForm name={name} onDone={done} />);
  // An archived context is not proposed any more.
  const archivedContexts = new Set(contexts.filter((context) => context.archived).map((context) => context.id));
  const periods = (settings?.treasuryContextPeriods ?? [])
    .filter((period) => !archivedContexts.has(period.contextId))
    .map((period) => ({ contextId: period.contextId, startDate: period.startDate, endDate: period.endDate }));
  const planned = plannedContext(periods, date);
  // Amounts relative to the entry (positive: its direction), in cents.
  const { amounts, remainder } = splitAmounts(amount, lines);
  const me = members.find((member) => member.isMe);

  /**
   * Changes one line.
   * @param {number} index Line.
   * @param {Partial<LineValues>} changes Changes.
   * @returns {void}
   */
  const change = (index: number, changes: Partial<LineValues>) => onChange(lines.map((line, position) => (position === index ? { ...line, ...changes } : line)));

  /**
   * Category of a line, kept only when it is of the direction the line now goes.
   * @param {string | null} id Category.
   * @param {number} relative Relative amount of the line.
   * @returns {string | null} Category.
   */
  const keepCategory = (id: string | null, relative: number) => categoryForDirection(categories, id, relative * sign > 0 ? 'IN' : 'OUT');

  /**
   * New line: what is not split yet, for me, in the category of the entry and the planned context.
   * @returns {void}
   */
  const add = () => onChange([...lines, newLine({ value: Math.max(remainder, 0) / 100 || 0, memberId: me?.id ?? null, contextId: planned })]);

  /**
   * Replaces the lines by an equal share for every member.
   * @returns {void}
   */
  const splitEqually = () => {
    const share = Math.round(10_000 / members.length) / 100;
    onChange(
      members.map((member, index) =>
        newLine({
          mode: 'PERCENT',
          // The last one takes what rounding leaves.
          value: index === members.length - 1 ? round2(100 - share * (members.length - 1)) : share,
          memberId: member.id,
          contextId: planned,
        }),
      ),
    );
  };

  // Archived contexts and relations are offered only where a line has them already.
  const contextSelect = listSelectProps(
    contexts,
    undefined,
    lines.map((line) => line.contextId),
  );
  // For whom: a member (none: me), or a relation (loan, gift…).
  const whomOptions = memberRelationOptions(
    members,
    unarchived(
      settings?.treasuryRelations ?? [],
      lines.map((line) => line.relationId),
    ),
    { perso },
  );

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        Répartissez le mouvement par membre, catégorie et contexte, en euros ou en pourcentage. Une valeur positive va dans le sens du mouvement, une négative en sens inverse (remboursement inclus
        dans un achat…). Ce qui reste est « non réparti ».
      </Text>
      {lines.length > 0 && (
        <ScrollArea type="auto" offsetScrollbars>
          <Table verticalSpacing={4} horizontalSpacing={6} miw={1020} layout="fixed">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="16%">Libellé</Table.Th>
                <Table.Th w="17%">Bénéficiaire</Table.Th>
                <Table.Th w="20%">Catégorie</Table.Th>
                <Table.Th w="18%">Contexte</Table.Th>
                <Table.Th w={84}>Unité</Table.Th>
                <Table.Th w={124}>Valeur</Table.Th>
                <Table.Th w={56}>
                  <Tooltip label="Projet, pièces justificatives, liens">
                    <PaperclipIcon aria-label="Rattachements" />
                  </Tooltip>
                </Table.Th>
                <Table.Th w={110} ta="right">
                  Montant
                </Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((line, index) => {
                const relative = amounts[index] / 100;
                const error = (field: string) => errors[`lines.${index}.${field}`] as string | undefined;
                return (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        aria-label={`Libellé de la ligne ${index + 1}`}
                        placeholder="Facultatif"
                        value={line.label ?? ''}
                        onChange={(event) => change(index, { label: event.currentTarget.value || null })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <CreatableSelect
                        size="xs"
                        aria-label={`Bénéficiaire de la ligne ${index + 1}`}
                        onCreate={createRelation}
                        placeholder={meName(me)}
                        clearable
                        searchable
                        data={whomOptions}
                        value={memberOrRelationKey(line)}
                        onChange={(key) =>
                          // A loan is with a relation only.
                          change(index, {
                            ...memberOrRelation(key),
                            loan: parsePersonKey(key)?.kind === 'relation' ? line.loan : false,
                          })
                        }
                        error={error('memberId') ?? error('relationId')}
                      />
                    </Table.Td>
                    <Table.Td>
                      <CreatableSelect
                        size="xs"
                        aria-label={`Catégorie de la ligne ${index + 1}`}
                        onCreate={createCategory[relative * sign >= 0 ? 'IN' : 'OUT']}
                        placeholder="Sans catégorie"
                        clearable
                        searchable
                        {...treeSelectProps(categoryOptions(categories, relative * sign >= 0 ? 'IN' : 'OUT', undefined, line.categoryId))}
                        value={line.categoryId}
                        onChange={(id) => change(index, { categoryId: id })}
                        error={error('categoryId')}
                      />
                    </Table.Td>
                    <Table.Td>
                      <CreatableSelect
                        size="xs"
                        aria-label={`Contexte de la ligne ${index + 1}`}
                        onCreate={createContext}
                        placeholder={EVERYDAY_CONTEXT}
                        clearable
                        searchable
                        {...contextSelect}
                        value={line.contextId}
                        onChange={(contextId) => change(index, { contextId })}
                        error={error('contextId')}
                      />
                    </Table.Td>
                    <Table.Td>
                      <SegmentedControl
                        size="xs"
                        fullWidth
                        aria-label={`Unité de la ligne ${index + 1}`}
                        data={[
                          { value: 'AMOUNT', label: '€' },
                          { value: 'PERCENT', label: '%' },
                        ]}
                        value={line.mode}
                        // The share stays the same when the unit changes.
                        onChange={(mode) => change(index, { mode: mode as TreasuryLineMode, value: valueInMode(mode as TreasuryLineMode, relative, amount) })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <AmountInput
                        size="xs"
                        aria-label={`Valeur de la ligne ${index + 1}`}
                        suffix={line.mode === 'PERCENT' ? ' %' : undefined}
                        value={line.value}
                        onChange={(value) => {
                          const next = typeof value === 'number' ? value : 0;
                          change(index, { value: next, categoryId: keepCategory(line.categoryId, next || 1) });
                        }}
                        error={error('value')}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Projet, pièces justificatives, liens">
                        <Indicator label={attachmentCount(line)} size={16} disabled={!attachmentCount(line)} offset={4}>
                          <ActionIcon variant={attachmentCount(line) ? 'light' : 'subtle'} color="gray" aria-label={`Rattachements de la ligne ${index + 1}`} onClick={() => setAttaching(index)}>
                            <PaperclipIcon aria-hidden />
                          </ActionIcon>
                        </Indicator>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="right">
                      <SignedAmount value={relative * sign} aria-label={`Montant de la ligne ${index + 1}`} />
                    </Table.Td>
                    <Table.Td>
                      <RemoveButton label="Retirer la ligne" aria-label={`Retirer la ligne ${index + 1}`} onClick={() => onChange(lines.filter((_, position) => position !== index))} />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text size="sm" c="dimmed">
                    Non réparti
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" fw={remainder === 0 ? undefined : 600}>
                    {fmt.moneyCents(remainder * sign)}
                  </Text>
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </ScrollArea>
      )}
      <Group gap="xs">
        <AddItemButton onClick={add}>Ajouter une ligne</AddItemButton>
        {members.length > 1 && (
          <Button size="xs" variant="subtle" leftSection={<UsersThreeIcon aria-hidden />} onClick={splitEqually}>
            Parts égales entre les membres
          </Button>
        )}
      </Group>
      {typeof errors.lines === 'string' && (
        <Text size="xs" c="red">
          {errors.lines}
        </Text>
      )}
      <SidePanel opened={attaching !== null && lines[attaching] !== undefined} onClose={() => setAttaching(null)} title={`Rattachements de la ligne ${(attaching ?? 0) + 1}`}>
        {attaching !== null && lines[attaching] && (
          <LineAttachments
            line={lines[attaching]}
            onChange={(changes) => change(attaching, changes)}
            entryId={entryId}
            projects={projects}
            documentGroups={documentGroups}
            onClose={() => setAttaching(null)}
          />
        )}
      </SidePanel>
    </Stack>
  );
}
