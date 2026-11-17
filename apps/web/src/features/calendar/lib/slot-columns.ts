/** Hours of a slot shown in the background of a day. */
interface DaySlot<L> {
  /** Slot (schedule and start), stable from a day to another. */
  key: string;
  /** Order it comes in (its column among those at the same time). */
  order: number;
  /** HH:MM. */
  start: string;
  end: string;
  /** How it looks. */
  look: L;
}

/** Part of a slot, with its column among the slots there are then. */
interface SlotPart<L> extends DaySlot<L> {
  column: number;
  columns: number;
}

/**
 * Parts of the slots of a day: each slot cut where the slots at the same time change, each part with its column (in
 * the order of the slots there) and the number of columns then. A slot alone takes the whole width.
 * @param {DaySlot<L>[]} slots Slots of the day.
 * @returns {SlotPart<L>[]} Parts.
 */
export function slotColumns<L>(slots: readonly DaySlot<L>[]): SlotPart<L>[] {
  const times = [...new Set(slots.flatMap((slot) => [slot.start, slot.end]))].sort();
  const parts: SlotPart<L>[] = [];
  for (let index = 0; index < times.length - 1; index += 1) {
    const from = times[index];
    const to = times[index + 1];
    const here = slots.filter((slot) => slot.start <= from && slot.end >= to).sort((a, b) => a.order - b.order);
    here.forEach((slot, column) => {
      // The same slot in the same column as just before: one part, longer.
      const last = parts.findLast((part) => part.key === slot.key && part.order === slot.order);
      if (last && last.end === from && last.column === column && last.columns === here.length) last.end = to;
      else parts.push({ ...slot, start: from, end: to, column, columns: here.length });
    });
  }
  return parts;
}
