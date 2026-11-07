import { formatDay } from '@ordo/shared';
import { prisma } from '../db';

/** A loan line: money lent or borrowed, or repaid, with a relation. */
export interface LoanItem {
  lineId: string;
  entryId: string;
  date: string;
  /** Label of the entry, and of the line if any. */
  label: string;
  /** Signed amount of the line: negative when money went out (lent, or a debt repaid). */
  amount: number;
}

/** Loans with a relation, both ways. */
export interface RelationLoans {
  relationId: string;
  /** What the relation owes (positive) or is owed (negative). */
  balance: number;
  /** Money that went out to them (lent, or debts repaid) and came in from them (borrowed, or loans repaid back). */
  out: number;
  in: number;
  items: LoanItem[];
}

/**
 * Loans with the relations, both ways, from the actual lines marked as loans: money out to a relation lends to
 * it (or repays it), money in from it borrows (or is repaid). The balance says who owes whom.
 * @returns {Promise<RelationLoans[]>} Loans by relation, largest balance first.
 */
export async function relationLoans(): Promise<RelationLoans[]> {
  const lines = await prisma.treasuryEntryLine.findMany({
    where: { loan: true, relationId: { not: null }, entry: { status: 'ACTUAL' } },
    select: { id: true, label: true, mode: true, value: true, date: true, relationId: true, entry: { select: { id: true, label: true, date: true, amount: true } } },
  });
  const byRelation = new Map<string, RelationLoans>();
  for (const line of lines) {
    const value = Number(line.value);
    // A percentage is of the entry amount.
    const cents = line.mode === 'PERCENT' ? Math.round(Number(line.entry.amount) * value) : Math.round(value * 100);
    const loans = byRelation.get(line.relationId!) ?? { relationId: line.relationId!, balance: 0, out: 0, in: 0, items: [] };
    loans.balance -= cents;
    if (cents < 0) loans.out -= cents;
    else loans.in += cents;
    loans.items.push({
      lineId: line.id,
      entryId: line.entry.id,
      date: formatDay(line.date ?? line.entry.date),
      label: [line.entry.label, line.label].filter(Boolean).join(' › '),
      amount: cents / 100,
    });
    byRelation.set(line.relationId!, loans);
  }
  return [...byRelation.values()]
    .map((loans) => ({ ...loans, balance: loans.balance / 100, out: loans.out / 100, in: loans.in / 100, items: loans.items.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}
