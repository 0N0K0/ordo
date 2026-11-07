import { parseDay, statementImportSchema, type StatementImportInput } from '@ordo/shared';
import { prisma } from '../db';
import { Prisma } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';
import { realizeForecast } from './treasury';

/**
 * Imports the operations of a bank statement into an account (chosen and checked in the preview): each one
 * realizes its forecast, or becomes a new actual entry, to categorize or split afterwards. The column mapping is
 * kept on the account for its next statements.
 * @param {StatementImportInput} input Account, mapping and operations.
 * @returns {Promise<{ created: number, realized: number }>} Entries created and forecasts realized.
 */
export async function importStatement(input: StatementImportInput): Promise<{ created: number; realized: number }> {
  const data = parseInput(statementImportSchema, input);
  if (!(await prisma.treasuryAccount.findUnique({ where: { id: data.accountId }, select: { id: true } }))) throw notFound('Compte');
  if (data.mapping) await prisma.treasuryAccount.update({ where: { id: data.accountId }, data: { csvMapping: data.mapping as Prisma.InputJsonValue } });
  let created = 0;
  let realized = 0;
  for (const row of data.rows) {
    if (row.forecastId) {
      const entry = await realizeForecast(row.forecastId, row.occurrence ?? row.date, { date: row.date, amount: row.amount });
      // The bank label is kept with the realized forecast's own.
      await prisma.treasuryEntry.update({ where: { id: entry.id }, data: { accountId: data.accountId, note: [entry.note, `Relevé : ${row.label}`].filter(Boolean).join('\n') } });
      realized += 1;
      continue;
    }
    await prisma.treasuryEntry.create({
      data: { accountId: data.accountId, status: 'ACTUAL', date: parseDay(row.date), valueDate: parseDay(row.date), label: row.label, amount: new Prisma.Decimal(row.amount) },
    });
    created += 1;
  }
  return { created, realized };
}
