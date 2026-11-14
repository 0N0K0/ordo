import { Group, Skeleton, Stack } from '@mantine/core';
import classes from './Skeletons.module.css';

/**
 * A height or spacing of so many steps of the vertical rhythm (24px by default).
 * @param {number} count Steps.
 * @returns {string} CSS length.
 */
const steps = (count: number) => `calc(${count} * var(--onoko-vertical-step))`;

/** Widths of the bars of a row, varied so that the rows read as text. */
const WIDTHS = ['72%', '48%', '60%', '36%', '54%'];

/**
 * Bar of a line of text: half a step thick, centered on its line of one step.
 * @param {{ width?: string }} props Component props.
 * @returns {JSX.Element} Line.
 */
function Line({ width = '100%' }: { width?: string }) {
  return (
    <div className={classes.line}>
      <Skeleton height={steps(0.5)} width={width} radius="sm" />
    </div>
  );
}

/**
 * Lines of text loading (a title, a paragraph, a card): one step each.
 * @param {{ lines?: number, title?: boolean }} props Component props: lines of text, a title (a thicker first line) before them.
 * @returns {JSX.Element} Skeleton.
 */
export function TextSkeleton({ lines = 3, title = false }: { lines?: number; title?: boolean }) {
  return (
    <Stack gap={0} aria-label="Chargement">
      {title && (
        <div className={classes.title}>
          <Skeleton height={steps(1)} width="40%" radius="sm" />
        </div>
      )}
      {Array.from({ length: lines }, (_, index) => (
        <Line key={index} width={index === lines - 1 && lines > 1 ? '60%' : '100%'} />
      ))}
    </Stack>
  );
}

/**
 * Table loading: its header, then its rows of two steps, each with the bars of its first columns.
 * @param {{ rows?: number, columns?: number }} props Component props: rows, columns.
 * @returns {JSX.Element} Skeleton.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Stack gap={0} className={classes.frame} aria-label="Chargement">
      <Group className={classes.header} gap="md" wrap="nowrap">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} height={steps(0.5)} width={`${Math.round(100 / columns) - 8}%`} radius="sm" />
        ))}
      </Group>
      {Array.from({ length: rows }, (_, row) => (
        <Group key={row} className={classes.row} gap="md" wrap="nowrap">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              height={steps(0.5)}
              width={column === 0 ? WIDTHS[row % WIDTHS.length] : `${Math.round(100 / columns) - 12}%`}
              radius="sm"
              style={{ flex: column === 0 ? 1 : undefined }}
            />
          ))}
        </Group>
      ))}
    </Stack>
  );
}

interface ListSkeletonProps {
  /** Items. Optional. Default = 3. */
  items?: number;
  /** Lines of text of an item (its title, its details). Optional. Default = 1. */
  lines?: number;
  /** A round mark (icon, avatar) before each item. Optional. */
  avatar?: boolean;
  /** Items of one step (a menu, a tree), not of two. Optional. */
  dense?: boolean;
}

/**
 * List loading (cards, settings, folders…): its items, of one more step than their lines (one step for a dense one).
 * @param {ListSkeletonProps} props Component props.
 * @returns {JSX.Element} Skeleton.
 */
export function ListSkeleton({ items = 3, lines = 1, avatar = false, dense = false }: ListSkeletonProps) {
  return (
    <Stack gap={0} aria-label="Chargement">
      {Array.from({ length: items }, (_, item) => (
        <Group key={item} className={dense ? classes.denseItem : classes.item} gap="sm" wrap="nowrap" style={{ minHeight: steps(dense ? 1 : lines + 1) }}>
          {avatar && <Skeleton circle height={steps(dense ? 0.75 : 1)} style={{ flex: 'none' }} />}
          <Stack gap={0} style={{ flex: 1 }}>
            {Array.from({ length: lines }, (_, line) => (
              <Line key={line} width={line === 0 ? WIDTHS[item % WIDTHS.length] : '36%'} />
            ))}
          </Stack>
        </Group>
      ))}
    </Stack>
  );
}

/**
 * Form loading: its fields, each a label line and an input of two steps.
 * @param {{ fields?: number }} props Component props.
 * @returns {JSX.Element} Skeleton.
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Stack gap={0} aria-label="Chargement">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className={classes.field}>
          <Line width="24%" />
          <Skeleton height={steps(1.5)} radius="sm" />
        </div>
      ))}
    </Stack>
  );
}

/**
 * Detail loading (a panel, a page): its title, then its text and its fields.
 * @param {{ fields?: number }} props Component props.
 * @returns {JSX.Element} Skeleton.
 */
export function DetailSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Stack gap={steps(1)} aria-label="Chargement">
      <TextSkeleton title lines={2} />
      <FormSkeleton fields={fields} />
    </Stack>
  );
}

/**
 * Block loading of a known height (a chart, an agenda, an editor): so many steps.
 * @param {{ height: number }} props Component props: height, in steps.
 * @returns {JSX.Element} Skeleton.
 */
export function BlockSkeleton({ height }: { height: number }) {
  return <Skeleton height={steps(height)} radius="md" aria-label="Chargement" />;
}
