import type { CSSProperties } from 'react';
import { CheckCircleIcon, CheckSquareIcon, CircleIcon, SquareIcon, WarningIcon, XCircleIcon, XSquareIcon } from '@phosphor-icons/react';
import { FAVORITE_COLOR, FEEDBACK_COLORS } from '../../feedback/feedback-colors';
import classes from './YesNoIcon.module.css';
import { NO_LABEL, YES_LABEL, type YesNoIconKind, type YesNoIcons, type YesNoIconSpec, type YesNoLabels, type YesNoTone } from '../table/data-table';

/**
 * Shape of a yes / no icon: square for a data shown (a cell, a filter), round for a thing to check (a state button);
 * same colours and meanings, the warning triangle in both.
 */
export type YesNoShape = 'square' | 'round';

/** Icon and colour of each built-in kind in each shape (the check's colour is that of its column). */
const KINDS: Record<YesNoShape, Record<YesNoIconKind, YesNoIconSpec>> = {
  square: {
    check: { icon: CheckSquareIcon, tone: 'success' },
    cross: { icon: XSquareIcon, tone: 'error' },
    warning: { icon: WarningIcon, tone: 'warning' },
    empty: { icon: SquareIcon, tone: 'neutral', outline: true },
  },
  round: {
    check: { icon: CheckCircleIcon, tone: 'success' },
    cross: { icon: XCircleIcon, tone: 'error' },
    warning: { icon: WarningIcon, tone: 'warning' },
    empty: { icon: CircleIcon, tone: 'neutral', outline: true },
  },
};

/**
 * Mantine colour of a tone: a feedback colour, the favourite yellow, or gray.
 * @param {YesNoTone} tone Tone.
 * @returns {string} Mantine colour.
 */
const colorOf = (tone: YesNoTone): string => (tone === 'neutral' ? 'gray' : tone === 'favorite' ? FAVORITE_COLOR : FEEDBACK_COLORS[tone]);

/**
 * Icon of a value: that of its column (a built-in kind or an icon of its own), else a check for yes and a cross for no;
 * the check in the colour of its column.
 * @param {boolean} value Yes or no.
 * @param {YesNoShape} shape Shape.
 * @param {YesNoIcons} [icons] Icons of the values. Optional.
 * @returns {YesNoIconSpec} Icon and colour.
 */
const yesNoSpec = (value: boolean, shape: YesNoShape, icons?: YesNoIcons): YesNoIconSpec => {
  const kind = (value ? icons?.yes : icons?.no) ?? (value ? 'check' : 'cross');
  if (typeof kind !== 'string') return kind;
  return kind === 'check' ? { ...KINDS[shape].check, tone: icons?.check ?? 'success' } : KINDS[shape][kind];
};

/**
 * Icon of a yes / no value: by default a filled square, green with a check for yes, red with a cross for no; a column
 * may show other ones (`icons`: an orange warning triangle, a blue check, an empty gray square, or an icon of its own
 * such as a blue cart in a filled square or a yellow star). Round instead of square on a thing to check (`shape`: a
 * state button), with the same colours. Named after its value (« Oui » / « Non », or the names of its
 * column: « En retard »…) for screen readers and on hover, unless a word stands beside it or a button names it (`decorative`).
 * @param {object} props Component props.
 * @param {boolean} props.value Yes or no.
 * @param {YesNoLabels} [props.labels] Names of the values. Optional. Default = « Oui » / « Non ».
 * @param {YesNoIcons} [props.icons] Icons of the values. Optional. Default = check for yes, cross for no.
 * @param {YesNoShape} [props.shape='square'] Square for a data shown, round for a thing to check (a state button). Optional. Default = square.
 * @param {number} [props.size=18] Size (px). Optional. Default = 18.
 * @param {boolean} [props.decorative=false] Named by what stands beside it: hidden from screen readers. Optional. Default = false.
 * @returns {JSX.Element} Icon.
 */
export function YesNoIcon({
  value,
  labels,
  icons,
  shape = 'square',
  size = 18,
  decorative = false,
}: {
  value: boolean;
  labels?: YesNoLabels;
  icons?: YesNoIcons;
  shape?: YesNoShape;
  size?: number;
  decorative?: boolean;
}) {
  const { icon: Icon, tone, outline = false, badge = false } = yesNoSpec(value, shape, icons);
  const label = value ? (labels?.yes ?? YES_LABEL) : (labels?.no ?? NO_LABEL);
  const color = `var(--mantine-color-${colorOf(tone)}-6)`;
  const name = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label };
  if (badge)
    // An icon of its own drawn white in a filled square or round, as the check and the cross.
    return (
      <span className={classes.badge} data-shape={shape} style={{ '--yes-no-size': `${size}px`, '--yes-no-color': color } as CSSProperties} title={decorative ? undefined : label} {...name}>
        <span className={classes.disc}>
          <Icon weight="bold" size={Math.round(size * 0.45)} color="var(--mantine-color-white)" aria-hidden />
        </span>
      </span>
    );
  return (
    <Icon weight={outline ? 'regular' : 'fill'} size={size} color={color} style={{ flexShrink: 0, display: 'block' }} {...name}>
      {!decorative && <title>{label}</title>}
    </Icon>
  );
}
