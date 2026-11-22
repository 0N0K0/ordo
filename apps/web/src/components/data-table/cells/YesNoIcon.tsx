import { CheckSquareIcon, SquareIcon, WarningIcon, XSquareIcon } from '@phosphor-icons/react';
import { FEEDBACK_COLORS } from '../../feedback/feedback-colors';
import { NO_LABEL, YES_LABEL, type YesNoIconKind, type YesNoIcons, type YesNoLabels } from '../table/data-table';

/** Phosphor icon of each kind. */
const ICONS = { check: CheckSquareIcon, cross: XSquareIcon, warning: WarningIcon, empty: SquareIcon } as const;

/**
 * Colour of an icon kind: the check success (or information), the cross error, the triangle warning, the empty square
 * gray.
 * @param {YesNoIconKind} kind Icon kind.
 * @param {YesNoIcons['check']} check Colour of the check.
 * @returns {string} Mantine colour.
 */
const colorOf = (kind: YesNoIconKind, check: YesNoIcons['check'] = 'success') =>
  kind === 'empty' ? 'gray' : FEEDBACK_COLORS[kind === 'check' ? check : kind === 'cross' ? 'error' : 'warning'];

/**
 * Icon kind of a value: that of its column, else a check for yes and a cross (or, on a state button, an empty square)
 * for no.
 * @param {boolean} value Yes or no.
 * @param {YesNoIcons} [icons] Icons of the values. Optional.
 * @param {YesNoIconKind} [no='cross'] Default kind of no. Optional. Default = cross.
 * @returns {YesNoIconKind} Kind.
 */
const yesNoKind = (value: boolean, icons?: YesNoIcons, no: YesNoIconKind = 'cross'): YesNoIconKind => (value ? (icons?.yes ?? 'check') : (icons?.no ?? no));

/**
 * Icon of a yes / no value: by default a filled square, green with a check for yes, red with a cross for no; a column
 * may show other ones (`icons`: an orange warning triangle, a blue check, an empty gray square). Named after its value
 * (« Oui » / « Non », or the names of its column: « En retard »…) for screen readers and on hover, unless a word stands
 * beside it or a button names it (`decorative`).
 * @param {object} props Component props.
 * @param {boolean} props.value Yes or no.
 * @param {YesNoLabels} [props.labels] Names of the values. Optional. Default = « Oui » / « Non ».
 * @param {YesNoIcons} [props.icons] Icons of the values. Optional. Default = check for yes, cross for no.
 * @param {YesNoIconKind} [props.no='cross'] Kind of no when `icons` sets none. Optional. Default = cross.
 * @param {number} [props.size=18] Size (px). Optional. Default = 18.
 * @param {boolean} [props.decorative=false] Named by what stands beside it: hidden from screen readers. Optional. Default = false.
 * @returns {JSX.Element} Icon.
 */
export function YesNoIcon({
  value,
  labels,
  icons,
  no,
  size = 18,
  decorative = false,
}: {
  value: boolean;
  labels?: YesNoLabels;
  icons?: YesNoIcons;
  no?: YesNoIconKind;
  size?: number;
  decorative?: boolean;
}) {
  const kind = yesNoKind(value, icons, no);
  const Icon = ICONS[kind];
  const label = value ? (labels?.yes ?? YES_LABEL) : (labels?.no ?? NO_LABEL);
  return (
    <Icon
      weight={kind === 'empty' ? 'regular' : 'fill'}
      size={size}
      color={`var(--mantine-color-${colorOf(kind, icons?.check)}-6)`}
      style={{ flexShrink: 0, display: 'block' }}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {!decorative && <title>{label}</title>}
    </Icon>
  );
}
