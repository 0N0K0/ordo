import { EmptyState } from '../../components/feedback/EmptyState';
import { ActionIcon, Badge, Button, Collapse, Group, NumberInput, Paper, SegmentedControl, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { ACCOUNTING_UNITS, UNIT_LABELS, VAT_RATES, type AccountingLineInput, type LineKind, type LineTotal } from '@ordo/shared';
import { ArrowDownIcon, ArrowUpIcon, NotePencilIcon, PackageIcon, PlusIcon, TextAaIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../components/markdown/MarkdownView';
import { NO_TARGETS } from '../../components/markdown/remark-references';
import { useCatalogItems } from './catalog-api';
import classes from './LinesEditor.module.css';
import * as fmt from '../../lib/format';
import { AmountInput } from '../../components/AmountInput';

const KIND_LABELS: Record<LineKind, string> = { ITEM: 'Article', DISBURSEMENT: 'Débours', TEXT: 'Texte', DEDUCTION: 'Déjà facturé' };

const NO_SUGGESTIONS = { projectId: null, tasks: [], contributors: [] };

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
              <Tooltip label="Description">
                <ActionIcon variant={showDescription ? 'light' : 'subtle'} color="gray" aria-label={`Description de la ligne ${index + 1}`} onClick={() => setShowDescription((value) => !value)}>
                  <NotePencilIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Monter">
                <ActionIcon variant="subtle" color="gray" aria-label={`Monter la ligne ${index + 1}`} disabled={index === 0} onClick={() => onMove(-1)}>
                  <ArrowUpIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Descendre">
                <ActionIcon variant="subtle" color="gray" aria-label={`Descendre la ligne ${index + 1}`} disabled={index === count - 1} onClick={() => onMove(1)}>
                  <ArrowDownIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Supprimer la ligne">
                <ActionIcon variant="subtle" color="red" aria-label={`Supprimer la ligne ${index + 1}`} onClick={onRemove}>
                  <TrashIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
        {priced && (
          <Group gap="xs" wrap="wrap" align="flex-end">
            <NumberInput
              label="Quantité"
              size="xs"
              w={100}
              decimalScale={3}
              decimalSeparator=","
              readOnly={readOnly}
              value={line.quantity}
              onChange={(value) => update({ quantity: typeof value === 'number' ? value : 0 })}
            />
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
              suffix=" €"
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
              <Group gap={4} align="flex-end" wrap="nowrap">
                <AmountInput
                  label="Remise"
                  size="xs"
                  w={110}
                  min={0}
                  readOnly={readOnly}
                  error={errors.discountValue}
                  value={line.discountValue ?? ''}
                  onChange={(value) =>
                    update({ discountValue: typeof value === 'number' && value > 0 ? value : null, discountType: typeof value === 'number' && value > 0 ? (line.discountType ?? 'PERCENT') : null })
                  }
                />
                <SegmentedControl
                  size="xs"
                  aria-label={`Type de remise de la ligne ${index + 1}`}
                  readOnly={readOnly}
                  data={[
                    { value: 'PERCENT', label: '%' },
                    { value: 'AMOUNT', label: currency === 'EUR' ? '€' : currency },
                  ]}
                  value={line.discountType ?? 'PERCENT'}
                  onChange={(type) => update({ discountType: type as AccountingLineInput['discountType'] })}
                />
              </Group>
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
  return (
    <Stack gap="xs">
      {lines.length === 0 && <EmptyState compact message="Aucune ligne." />}
      {lines.map((line, index) => (
        <LineRow
          key={index}
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
            const next = [...lines];
            const [moved] = next.splice(index, 1);
            next.splice(index + offset, 0, moved);
            onChange(next);
          }}
          onRemove={() => onChange(lines.filter((_, position) => position !== index))}
        />
      ))}
      {!readOnly && (
        <Group gap="xs">
          <Button size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => onChange([...lines, newLine('ITEM', defaultRate)])}>
            Article
          </Button>
          <Button size="xs" variant="default" color="grape" leftSection={<PlusIcon aria-hidden />} onClick={() => onChange([...lines, newLine('DISBURSEMENT', 0)])}>
            Débours
          </Button>
          <Button size="xs" variant="default" color="gray" leftSection={<TextAaIcon aria-hidden />} onClick={() => onChange([...lines, newLine('TEXT', 0)])}>
            Texte
          </Button>
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
