import { ActionIcon, Button, Group, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';
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
}

/**
 * Split of an entry into lines: amount (€) or percentage, positive (in the direction of the entry) or negative,
 * for a member, in a category of its direction and a context (none: everyday spending, the planned one proposed).
 * What the lines leave is "not split" (category of the entry). Splits equally between the members in one click.
 * @param {LinesEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function LinesEditor({ lines, onChange, amount, direction, date, categoryId, settings, errors }: LinesEditorProps) {
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
      {lines.map((line, index) => {
        const relative = amounts[index] / 100;
        const error = (field: string) => errors[`lines.${index}.${field}`] as string | undefined;
        return (
          <Paper key={index} withBorder radius="sm" p="xs">
            <Stack gap={6}>
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <SegmentedControl
                  size="xs"
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
                <NumberInput
                  aria-label={`Valeur de la ligne ${index + 1}`}
                  style={{ flex: 1 }}
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
                <Text size="sm" w={110} ta="right" c={relative * sign < 0 ? 'red' : 'green'} aria-label={`Montant de la ligne ${index + 1}`}>
                  {formatMoney(Math.round(relative * sign * 100))}
                </Text>
                <Tooltip label="Retirer la ligne">
                  <ActionIcon variant="subtle" color="gray" size="lg" aria-label={`Retirer la ligne ${index + 1}`} onClick={() => onChange(lines.filter((_, position) => position !== index))}>
                    <XIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
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
                <Select
                  size="xs"
                  aria-label={`Contexte de la ligne ${index + 1}`}
                  placeholder={EVERYDAY_CONTEXT}
                  clearable
                  data={contextOptions}
                  value={line.contextId}
                  onChange={(contextId) => change(index, { contextId })}
                  error={error('contextId')}
                />
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
                <TextInput
                  size="xs"
                  aria-label={`Libellé de la ligne ${index + 1}`}
                  placeholder="Libellé (facultatif)"
                  value={line.label ?? ''}
                  onChange={(event) => change(index, { label: event.currentTarget.value || null })}
                />
              </SimpleGrid>
            </Stack>
          </Paper>
        );
      })}
      <Group justify="space-between" gap="xs">
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
        {lines.length > 0 && (
          <Text size="xs" c={remainder === 0 ? 'dimmed' : undefined}>
            Non réparti : {formatMoney(remainder * sign)}
            {remainder !== 0 && categoryId ? ` · ${paths.get(categoryId) ?? ''}` : ''}
          </Text>
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
