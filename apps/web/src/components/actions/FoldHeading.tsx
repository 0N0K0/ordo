import { getRadius, Tooltip, UnstyledButton, VisuallyHidden, type MantineRadius, type UnstyledButtonProps } from '@mantine/core';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { CountBadge } from '../feedback/CountBadge';
import { FoldChevron } from './FoldChevron';
import { foldLabel } from './fold-label';
import { foldSummary, type FoldSummary } from './fold-summary';
import classes from './FoldHeading.module.css';

interface FoldHeadingProps extends Omit<UnstyledButtonProps, 'children'>, Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onToggle' | 'style' | 'color'> {
  /** Unfolded. */
  expanded: boolean;
  /** Folds or unfolds. */
  onToggle: () => void;
  /** Title of what folds. */
  children: ReactNode;
  /** How many elements it folds: a small grey count after the title (size xs). Optional. Default = none. */
  count?: number;
  /** Before the title (an avatar, a colour, an icon). Optional. */
  icon?: ReactNode;
  /** At the right end of the row (a total…). Optional. */
  aside?: ReactNode;
  /** A small toggle inside a cell (« détails (3) »), as wide as its text, instead of a whole row. Optional. Default = false. */
  inline?: boolean;
  /** What it folds when its title does not say it, with its determiner: hidden label « Réduire les lots de « X » ». Optional. */
  about?: string;
  /** Corner radius of the row (its hover). Optional. Default = sm. */
  radius?: MantineRadius;
  /** What it folds, after the title (« Alarmes · 15 min avant, à 08:00 +2 »), cut by « … », in full in its tooltip (`foldSummary`). Optional. Default = none. */
  summary?: FoldSummary;
}

/**
 * Heading of a section, a group or a list that folds, the same everywhere: the whole row is clickable,
 * a chevron turning down when unfolded, its title, its summary (folded), its count. Other props (a class, `data-depth`…)
 * go to the button.
 * @param {FoldHeadingProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function FoldHeading({ expanded, onToggle, children, count, icon, aside, inline = false, about, radius, summary, className, style, ...others }: FoldHeadingProps) {
  const summed = foldSummary(summary);
  const button = (
    // eslint-disable-next-line no-restricted-syntax -- FoldHeading itself.
    <UnstyledButton
      {...others}
      className={className ? `${classes.heading} ${className}` : classes.heading}
      style={radius === undefined ? style : [{ '--fold-heading-radius': getRadius(radius) }, style]}
      aria-label={about ? foldLabel(expanded, about) : others['aria-label']}
      data-inline={inline || undefined}
      data-summary={summed ? true : undefined}
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {/* eslint-disable-next-line no-restricted-syntax -- FoldHeading itself. */}
      <FoldChevron expanded={expanded} />
      {icon}
      <span className={classes.title}>{children}</span>
      {summed && (
        <>
          <span className={classes.summary} aria-hidden>
            · {summed.text}
          </span>
          <VisuallyHidden> : {summed.full}</VisuallyHidden>
        </>
      )}
      {count !== undefined && <CountBadge count={count} variant="light" color="gray" size="xs" />}
      {aside}
    </UnstyledButton>
  );
  // The full summary in a tooltip, also on keyboard focus; always there, so that the button keeps its focus when folded.
  return (
    <Tooltip label={summed?.full ?? ''} disabled={!summed} events={{ hover: true, focus: true, touch: false }} multiline maw="20rem">
      {/* eslint-disable-next-line no-restricted-syntax -- FoldHeading itself, never disabled. */}
      {button}
    </Tooltip>
  );
}
