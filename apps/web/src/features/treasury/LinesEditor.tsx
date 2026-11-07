import { ActionIcon, Button, Group, NumberInput, ScrollArea, SegmentedControl, Select, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { EVERYDAY_CONTEXT, formatMoney, plannedContext, splitAmounts, type TreasuryLineMode } from '@ordo/shared';
import { PlusIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react';
import type { TreasurySettings } from './api';
import { categoryOptions, categoryPaths } from './categories';

/**
 * Line of a split entry as edited: its value is relative to the entry (positive: in the direction of the entry,
 * negative: the other way), signed when saved.
 */
export interface LineValues {
  label: string | null;
  mode: TreasuryLineMode;
  value: number;
  memberId: string | null;
  categoryId: string | null;
  contextId: string | null;
}

interface LinesEditorProps {
  lines: LineValues[];
  onChange: (lines: LineValues[]) => void;
  /** Amount of the entry, positive, and its direction. */
  amount: number;
  direction: 'IN' | 'OUT';
  /** Day of the entry: the context planned then is proposed. */
  date: string;
  categoryId: string | null;
  settings: TreasurySettings | undefined;
  errors: Record<string, unknown>;
  /** Opens the creation of a context for a line (it takes the context created). */
  onCreateContext: (index: number) => void;
}

/**
 * Split of an entry into lines: amount (€) or percentage, positive (in the direction of the entry) or negative,
 * for a member, in a category of its direction and a context (none: everyday spending, the planned one proposed).
 * What the lines leave is "not split" (category of the entry). A table, one line per row; splits equally between
 * the members in one click; a context can be created from a line.
 * @param {LinesEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function LinesEditor({ lines, onChange, amount, direction, date, categoryId, settings, errors, onCreateContext }: LinesEditorProps) {
  const sign = direction === 'IN' ? 1 : -1;
  const members = settings?.treasuryMembers ?? [];
  const contexts = settings?.treasuryContexts ?? [];
  const categories = settings?.treasuryCategories ?? [];
  const periods = (settings?.treasuryContextPeriods ?? []).map((period) => ({ contextId: period.contextId, startDate: String(period.startDate), endDate: String(period.endDate) }));
  const planned = plannedContext(periods, date);
  const paths = categoryPaths(categories);
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
  const keepCategory = (id: string | null, relative: number) => {
    const category = categories.find((item) => item.id === id);
    return category && (category.direction === 'IN') === relative * sign > 0 ? category.id : null;
  };

  /**
   * New line: what is not split yet, for me, in the category of the entry and the planned context.
   * @returns {void}
   */
  const add = () =>
    onChange([...lines, { label: null, mode: 'AMOUNT', value: Math.max(remainder, 0) / 100 || 0, memberId: me?.id ?? null, categoryId: keepCategory(categoryId, 1), contextId: planned }]);

  /**
   * Replaces the lines by an equal share for every member.
   * @returns {void}
   */
  const splitEqually = () => {
    const share = Math.round(10_000 / members.length) / 100;
    onChange(
      members.map((member, index) => ({
        label: null,
        mode: 'PERCENT',
        // The last one takes what rounding leaves.
        value: index === members.length - 1 ? Math.round((100 - share * (members.length - 1)) * 100) / 100 : share,
        memberId: member.id,
        categoryId: keepCategory(categoryId, 1),
        contextId: planned,
      })),
    );
  };

  const contextOptions = contexts.map((item) => ({ value: item.id, label: item.name }));
  const memberOptions = members.map((member) => ({ value: member.id, label: member.isMe ? `${member.name} (moi)` : member.name }));

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed">
        Répartissez le mouvement par membre, catégorie et contexte, en euros ou en pourcentage. Une valeur positive va dans le sens du mouvement, une négative en sens inverse (remboursement inclus
        dans un achat…). Ce qui reste est « non réparti ».
      </Text>
      {lines.length > 0 && (
        <ScrollArea type="auto" offsetScrollbars>
          <Table verticalSpacing={4} horizontalSpacing={6} miw={960} layout="fixed">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="16%">Libellé</Table.Th>
                <Table.Th w="15%">Membre</Table.Th>
                <Table.Th w="20%">Catégorie</Table.Th>
                <Table.Th w="18%">Contexte</Table.Th>
                <Table.Th w={84}>Unité</Table.Th>
                <Table.Th w={124}>Valeur</Table.Th>
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
                      <Select
                        size="xs"
                        aria-label={`Membre de la ligne ${index + 1}`}
                        placeholder="Sans membre"
                        clearable
                        data={memberOptions}
                        value={line.memberId}
                        onChange={(memberId) => change(index, { memberId })}
                        error={error('memberId')}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        aria-label={`Catégorie de la ligne ${index + 1}`}
                        placeholder="Sans catégorie"
                        clearable
                        searchable
                        data={categoryOptions(categories, relative * sign >= 0 ? 'IN' : 'OUT')}
                        value={line.categoryId}
                        onChange={(id) => change(index, { categoryId: id })}
                        error={error('categoryId')}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Select
                          size="xs"
                          style={{ flex: 1, minWidth: 0 }}
                          aria-label={`Contexte de la ligne ${index + 1}`}
                          placeholder={EVERYDAY_CONTEXT}
                          clearable
                          searchable
                          data={contextOptions}
                          value={line.contextId}
                          onChange={(contextId) => change(index, { contextId })}
                          error={error('contextId')}
                        />
                        <Tooltip label="Nouveau contexte">
                          <ActionIcon variant="default" size="input-xs" aria-label={`Nouveau contexte pour la ligne ${index + 1}`} onClick={() => onCreateContext(index)}>
                            <PlusIcon aria-hidden />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
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
                        onChange={(mode) =>
                          change(index, {
                            mode: mode as TreasuryLineMode,
                            value: mode === 'PERCENT' ? (amount ? Math.round(((relative * 100) / amount) * 100) / 100 : 0) : relative,
                          })
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        size="xs"
                        aria-label={`Valeur de la ligne ${index + 1}`}
                        decimalScale={2}
                        decimalSeparator=","
                        thousandSeparator=" "
                        suffix={line.mode === 'PERCENT' ? ' %' : ' €'}
                        value={line.value}
                        onChange={(value) => {
                          const next = typeof value === 'number' ? value : 0;
                          change(index, { value: next, categoryId: keepCategory(line.categoryId, next || 1) });
                        }}
                        error={error('value')}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c={relative * sign < 0 ? 'red' : 'green'} aria-label={`Montant de la ligne ${index + 1}`}>
                        {formatMoney(Math.round(relative * sign * 100))}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Retirer la ligne">
                        <ActionIcon variant="subtle" color="gray" aria-label={`Retirer la ligne ${index + 1}`} onClick={() => onChange(lines.filter((_, position) => position !== index))}>
                          <XIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    Non réparti{remainder !== 0 && categoryId ? ` · ${paths.get(categoryId) ?? ''}` : ''}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" fw={remainder === 0 ? undefined : 600}>
                    {formatMoney(remainder * sign)}
                  </Text>
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </ScrollArea>
      )}
      <Group gap="xs">
        <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={add}>
          Ajouter une ligne
        </Button>
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
    </Stack>
  );
}
