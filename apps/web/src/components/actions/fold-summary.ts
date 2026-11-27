/** What a folded group holds, for its title: its values (a status, « 15 min avant »…), or the number of its people or items. */
export type FoldSummary =
  readonly (string | null | undefined | false)[] | number;

/** Values shown in a folded title before « +N ». */
const SHOWN_VALUES = 2;

/**
 * Summary of a folded group, the same everywhere: 2 values at most then « +N » (« 15 min avant, à 08:00 +2 »), or a
 * count alone (« 3 ») for a list of people or items; the full list for its tooltip. Nothing for an empty group.
 * @param {FoldSummary | undefined} summary Values (the empty ones dropped) or count.
 * @returns {{ text: string, full: string } | null} Short and full summaries; null: nothing to show.
 */
export function foldSummary(
  summary: FoldSummary | undefined,
): { text: string; full: string } | null {
  if (summary === undefined) return null;
  if (typeof summary === "number")
    return summary > 0
      ? { text: String(summary), full: String(summary) }
      : null;
  const values = summary.filter((value): value is string => Boolean(value));
  if (values.length === 0) return null;
  const shown = values.slice(0, SHOWN_VALUES).join(", ");
  const more = values.length - SHOWN_VALUES;
  return {
    text: more > 0 ? `${shown} +${more}` : shown,
    full: values.join(", "),
  };
}

/**
 * Labels of the chosen items, in the order chosen, for a summary (those not found dropped).
 * @param {readonly { id: string, label: string }[]} items Items offered.
 * @param {readonly (string | null | undefined)[]} ids Chosen ids.
 * @returns {string[]} Labels.
 */
export function summaryLabels(
  items: readonly { id: string; label: string }[],
  ids: readonly (string | null | undefined)[],
): string[] {
  return ids
    .map((id) => items.find((item) => item.id === id)?.label)
    .filter((label): label is string => Boolean(label));
}
