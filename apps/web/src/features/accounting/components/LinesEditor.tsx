import { arrayMove } from '@dnd-kit/sortable';
import { moveEntries } from '../../../components/actions/move-entries';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Collapse, Group, Paper, Select, Stack, Text, TextInput } from '@mantine/core';
import { ACCOUNTING_UNITS, UNIT_LABELS, VAT_RATES, type AccountingLineInput, type LineKind, type LineTotal } from '@ordo/shared';
import { NotePencilIcon, PackageIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { NO_SUGGESTIONS, NO_TARGETS } from '../../../components/markdown/remark-references';
import { useCatalogItems } from '../api/catalog';
import classes from './LinesEditor.module.css';
import * as fmt from '../../../lib/format';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { DiscountInput } from './DiscountInput';
import { QuantityInput } from '../../../components/inputs/QuantityInput';

const KIND_LABELS: Record<LineKind, string> = { ITEM: 'Article', DISBURSEMENT: 'Débours', TEXT: 'Texte', DEDUCTION: 'Déjà facturé' };

/**
 * New line of a kind.
 * @param {LineKind} kind Kind.
 * @param {number} vatRate Default VAT rate.
 * @returns {AccountingLineInput} Line.
 */
function newLine(kind: LineKind, vatRate: number): AccountingLineInput {
  return {
    kind,
    title: '',
    description: null,
    quantity: 1,
    unit: kind === 'DISBURSEMENT' ? 'FLAT' : 'UNIT',
    unitPrice: 0,
    vatRate: kind === 'DISBURSEMENT' ? 0 : vatRate,
    discountType: null,
    discountValue: null,
  };
}

interface LineRowProps {
  line: AccountingLineInput;
  total: LineTotal;
  index: number;
  count: number;
  readOnly: boolean;
  vatApplicable: boolean;
  currency: string;
  errors: Record<string, string | undefined>;
  onChange: (line: AccountingLineInput) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}

/**
 * One line: title, quantity, unit, price, VAT and discount, total, and a markdown description.
 * @param {LineRowProps} props Component props.
 * @returns {JSX.Element} Line.
 */
function LineRow({ line, total, index, count, readOnly, vatApplicable, currency, errors, onChange, onMove, onRemove }: LineRowProps) {
  const [showDescription, setShowDescription] = useState(Boolean(line.description));
  const priced = line.kind !== 'TEXT';
  const update = (changes: Partial<AccountingLineInput>) => onChange({ ...line, ...changes });
  return (
    <Paper withBorder radius="sm" p="xs" className={classes.line} data-kind={line.kind}>
      <Stack gap={6}>
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <Badge
            size="sm"
            variant="light"
            color={line.kind === 'DEDUCTION' ? 'orange' : line.kind === 'DISBURSEMENT' ? 'grape' : 'gray'}
            mt={6}
            className={classes.kind}
            title={line.deductedDocumentId ? 'Déduction liée à une facture d’acompte' : undefined}
          >
            {line.deductedDocumentId ? 'Acompte' : KIND_LABELS[line.kind]}
          </Badge>
          <TextInput
            aria-label={`Libellé de la ligne ${index + 1}`}
            placeholder={line.kind === 'TEXT' ? 'Titre de section, note…' : 'Libellé'}
            value={line.title}
            readOnly={readOnly}
            error={errors.title}
            onChange={(event) => update({ title: event.currentTarget.value })}
            style={{ flex: 1 }}
          />
          {!readOnly && (
            <Group gap={0} wrap="nowrap">
              <InlineActions
                name={`la ligne ${index + 1}`}
                items={[
                  { label: 'Description', icon: <NotePencilIcon aria-hidden />, onClick: () => setShowDescription((value) => !value) },
                  ...moveEntries(index, count, (to) => onMove(to - index)),
                  { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: onRemove },
                ]}
              />
            </Group>
          )}
        </Group>
        {priced && (
          <Group gap="xs" wrap="wrap" align="flex-end">
            <QuantityInput label="Quantité" size="xs" w={100} readOnly={readOnly} value={line.quantity} onChange={(value) => update({ quantity: typeof value === 'number' ? value : 0 })} />
            <Select
              label="Unité"
              size="xs"
              w={120}
              data={ACCOUNTING_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit].label }))}
              value={line.unit}
              readOnly={readOnly}
              allowDeselect={false}
              onChange={(unit) => unit && update({ unit: unit as AccountingLineInput['unit'] })}
            />
            <AmountInput
              label={line.kind === 'DEDUCTION' ? 'Montant HT déduit' : 'Prix unitaire HT'}
              size="xs"
              w={150}
              currency={currency}
              readOnly={readOnly}
              value={line.unitPrice}
              onChange={(value) => update({ unitPrice: typeof value === 'number' ? value : 0 })}
            />
            {vatApplicable && line.kind !== 'DISBURSEMENT' && (
              <Select
                label="TVA"
                size="xs"
                w={95}
                data={[...new Set([...VAT_RATES, line.vatRate])].map((rate) => ({ value: String(rate), label: `${fmt.percent(rate)}` }))}
                value={String(line.vatRate)}
                readOnly={readOnly}
                allowDeselect={false}
                onChange={(rate) => rate !== null && update({ vatRate: Number(rate) })}
              />
            )}
            {line.kind === 'ITEM' && (
              <DiscountInput
                label="Remise"
                size="xs"
                w={110}
                readOnly={readOnly}
                error={errors.discountValue}
                value={line.discountValue ?? null}
                type={line.discountType ?? null}
                currency={currency}
                typeLabel={`Type de remise de la ligne ${index + 1}`}
                onChange={({ value, type }) => update({ discountValue: value, discountType: type })}
              />
            )}
            <Stack gap={0} ml="auto" align="flex-end">
              <Text size="xs" c="dimmed">
                Total HT
              </Text>
              <Text fw={600} ff="monospace">
                {fmt.moneyCents(total.net, currency)}
              </Text>
            </Stack>
          </Group>
        )}
        <Collapse expanded={showDescription}>
          {readOnly ? (
            line.description && <MarkdownView targets={NO_TARGETS}>{line.description}</MarkdownView>
          ) : (
            <MarkdownEditor
              value={line.description ?? ''}
              onChange={(description) => update({ description })}
              suggestions={NO_SUGGESTIONS}
              minRows={2}
              placeholder="Description détaillée (markdown)…"
            />
          )}
        </Collapse>
        {readOnly && !showDescription && line.description && <MarkdownView targets={NO_TARGETS}>{line.description}</MarkdownView>}
      </Stack>
    </Paper>
  );
}

/**
 * Stable keys of the lines (they have no id): kept through moves and removals, so that each row keeps its own state
 * (open description); lines added or dropped elsewhere get new keys, or lose theirs, at the end.
 * @param {number} count Number of lines.
 * @returns {{ keys: number[], setKeys: (keys: number[]) => void }} Keys, by line position, and their setter.
 */
function useLineKeys(count: number): { keys: number[]; setKeys: (keys: number[]) => void } {
  const [keys, setKeys] = useState<number[]>(() => Array.from({ length: count }, (_, index) => index));
  if (keys.length === count) return { keys, setKeys };
  const next = Math.max(-1, ...keys) + 1;
  const synced = count < keys.length ? keys.slice(0, count) : [...keys, ...Array.from({ length: count - keys.length }, (_, index) => next + index)];
  setKeys(synced);
  return { keys: synced, setKeys };
}

interface LinesEditorProps {
  lines: AccountingLineInput[];
  totals: LineTotal[];
  onChange: (lines: AccountingLineInput[]) => void;
  readOnly: boolean;
  vatApplicable: boolean;
  currency: string;
  /** Errors by path ("lines.2.title"). */
  errors: Record<string, unknown>;
  /** Other ways to add lines (tracked time…). Optional. */
  extraActions?: ReactNode;
}

/**
 * Lines of a document: items, disbursements (outside VAT), text lines and deductions of what was already
 * invoiced; added (blank or from the catalogue), reordered and removed.
 * @param {LinesEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function LinesEditor({ lines, totals, onChange, readOnly, vatApplicable, currency, errors, extraActions }: LinesEditorProps) {
  const defaultRate = vatApplicable ? 20 : 0;
  const { data: catalog } = useCatalogItems();
  const offered = (catalog ?? []).filter((item) => !item.archived);
  const { keys, setKeys } = useLineKeys(lines.length);
  return (
    <Stack gap="xs">
      {lines.length === 0 && <EmptyState compact message="Aucune ligne." />}
      {lines.map((line, index) => (
        <LineRow
          key={keys[index]}
          line={line}
          total={totals[index] ?? { gross: 0, discount: 0, net: 0 }}
          index={index}
          count={lines.length}
          readOnly={readOnly}
          vatApplicable={vatApplicable}
          currency={currency}
          errors={{ title: errors[`lines.${index}.title`] as string | undefined, discountValue: errors[`lines.${index}.discountValue`] as string | undefined }}
          onChange={(next) => onChange(lines.map((item, position) => (position === index ? next : item)))}
          onMove={(offset) => {
            setKeys(arrayMove(keys, index, index + offset));
            onChange(arrayMove(lines, index, index + offset));
          }}
          onRemove={() => {
            setKeys(keys.filter((_, position) => position !== index));
            onChange(lines.filter((_, position) => position !== index));
          }}
        />
      ))}
      {!readOnly && (
        <Group gap="xs">
          <AddItemButton onClick={() => onChange([...lines, newLine('ITEM', defaultRate)])}>Ajouter un article</AddItemButton>
          <AddItemButton onClick={() => onChange([...lines, newLine('DISBURSEMENT', 0)])}>Ajouter un débours</AddItemButton>
          <AddItemButton onClick={() => onChange([...lines, newLine('TEXT', 0)])}>Ajouter un texte</AddItemButton>
          {offered.length > 0 && (
            <Select
              size="xs"
              w={220}
              aria-label="Ajouter un article du catalogue"
              placeholder="Depuis le catalogue…"
              searchable
              leftSection={<PackageIcon aria-hidden />}
              data={offered.map((item) => ({ value: item.id, label: item.title }))}
              value={null}
              onChange={(id) => {
                const item = offered.find((entry) => entry.id === id);
                if (!item) return;
                const kind = item.kind === 'DISBURSEMENT' ? 'DISBURSEMENT' : 'ITEM';
                onChange([...lines, { ...newLine(kind, item.vatRate), title: item.title, description: item.description ?? null, unit: item.unit, unitPrice: item.unitPrice }]);
              }}
            />
          )}
          {extraActions}
        </Group>
      )}
    </Stack>
  );
}
