/**
 * What a task turned into a routine, or a routine into a task, loses: the API counts each kind in the
 * extension `lost` of its CONFIRMATION_REQUIRED, the web lists them in the confirmation.
 */
export const CONVERSION_LOSSES = [
  // Task → routine.
  'number',
  'status',
  'priority',
  'type',
  'tags',
  'milestone',
  'sprints',
  'github',
  'effort',
  'dates',
  'taskLinks',
  'shoppingLists',
  'alarms',
  'events',
  'hours',
  // Both ways.
  'parent',
  // Routine → task.
  'repetition',
  'checks',
  'beforeReminders',
  'routineLinks',
  'categories',
  'estimate',
  'travel',
  'comments',
  'checklists',
] as const;

/** Kind of thing a conversion loses. */
export type ConversionLossKind = (typeof CONVERSION_LOSSES)[number];

/** What a conversion loses, by kind (a count; 1 for a single value); a kind left out loses nothing. */
export type ConversionLoss = Partial<Record<ConversionLossKind, number>>;

/**
 * Loss without its empty kinds.
 * @param {Record<ConversionLossKind, number>} counts Counts of some kinds (zero: nothing lost).
 * @returns {ConversionLoss} Loss.
 */
export function conversionLoss(counts: Partial<Record<ConversionLossKind, number>>): ConversionLoss {
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => (count ?? 0) > 0)) as ConversionLoss;
}
