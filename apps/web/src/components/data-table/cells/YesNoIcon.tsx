import { CheckSquareIcon, XSquareIcon } from '@phosphor-icons/react';
import { FEEDBACK_COLORS } from '../../feedback/feedback-colors';
import { NO_LABEL, YES_LABEL } from '../table/data-table';

/**
 * Icon of a yes / no value: a filled square, green with a check for yes, red with a cross for no; named « Oui » /
 * « Non » for screen readers and on hover, unless a word stands beside it (`decorative`).
 * @param {object} props Component props.
 * @param {boolean} props.value Yes or no.
 * @param {boolean} [props.decorative=false] Shown beside its word: hidden from screen readers. Optional. Default = false.
 * @returns {JSX.Element} Icon.
 */
export function YesNoIcon({ value, decorative = false }: { value: boolean; decorative?: boolean }) {
  const Icon = value ? CheckSquareIcon : XSquareIcon;
  const label = value ? YES_LABEL : NO_LABEL;
  return (
    <Icon
      weight="fill"
      size={18}
      color={`var(--mantine-color-${value ? FEEDBACK_COLORS.success : FEEDBACK_COLORS.error}-6)`}
      style={{ flexShrink: 0, display: 'block' }}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {!decorative && <title>{label}</title>}
    </Icon>
  );
}
