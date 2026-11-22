import { CheckSquareIcon, WarningIcon, XSquareIcon } from '@phosphor-icons/react';
import { FEEDBACK_COLORS } from '../../feedback/feedback-colors';
import { NO_LABEL, YES_LABEL, type YesNoIconKind, type YesNoIcons, type YesNoLabels } from '../table/data-table';

/** Phosphor icon of each kind. */
const ICONS = { check: CheckSquareIcon, cross: XSquareIcon, warning: WarningIcon } as const;

/**
 * Feedback colour of an icon kind: the check success (or information), the cross error, the triangle warning.
 * @param {YesNoIconKind} kind Icon kind.
 * @param {YesNoIcons['check']} check Colour of the check.
 * @returns {string} Mantine colour.
 */
const colorOf = (kind: YesNoIconKind, check: YesNoIcons['check'] = 'success') =>
  FEEDBACK_COLORS[kind === 'check' ? check : kind === 'cross' ? 'error' : 'warning'];

/**
 * Icon of a yes / no value: by default a filled square, green with a check for yes, red with a cross for no; a column
 * may show other ones (`icons`: an orange warning triangle, a blue check). Named after its value (« Oui » / « Non », or
 * the names of its column: « En retard »…) for screen readers and on hover, unless a word stands beside it
 * (`decorative`).
 * @param {object} props Component props.
 * @param {boolean} props.value Yes or no.
 * @param {YesNoLabels} [props.labels] Names of the values. Optional. Default = « Oui » / « Non ».
 * @param {YesNoIcons} [props.icons] Icons of the values. Optional. Default = check for yes, cross for no.
 * @param {boolean} [props.decorative=false] Shown beside its word: hidden from screen readers. Optional. Default = false.
 * @returns {JSX.Element} Icon.
 */
export function YesNoIcon({ value, labels, icons, decorative = false }: { value: boolean; labels?: YesNoLabels; icons?: YesNoIcons; decorative?: boolean }) {
  const kind = value ? (icons?.yes ?? 'check') : (icons?.no ?? 'cross');
  const Icon = ICONS[kind];
  const label = value ? (labels?.yes ?? YES_LABEL) : (labels?.no ?? NO_LABEL);
  return (
    <Icon
      weight="fill"
      size={18}
      color={`var(--mantine-color-${colorOf(kind, icons?.check)}-6)`}
      style={{ flexShrink: 0, display: 'block' }}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {!decorative && <title>{label}</title>}
    </Icon>
  );
}
