import { addDays } from '@ordo/shared';
import { prisma } from '../../src/db';
import type { Contributor } from '../../src/generated/prisma/client';
import { createCalendarEvent } from '../../src/services/calendar-events';
import { createEntry } from '../../src/services/treasury';
import { saveBudget } from '../../src/services/treasury-budgets';
import { addMember, saveContext, saveContextPeriod, saveRelation } from '../../src/services/treasury-team';

/** What the team fixtures made, for the shopping ones. */
export interface SeededTeam {
  /** Members of the team (contributors), "Moi" apart. */
  memberIds: string[];
  /** Relations out of the team. */
  relationIds: string[];
  /** Contexts of spending, by name. */
  contextIds: Map<string, string>;
}

/**
 * Team of the treasury and its spending: two members, two relations (one of them a contributor), contexts with their
 * planned periods, budgets (everyday, of a context, of a member, of a relation), and split movements: shared between
 * members, in a context, a loan to a relation and its repayment. After the accounting (its account and categories).
 * @param {object} input Data of the other fixtures.
 * @param {Contributor[]} input.contributors Contributors.
 * @param {string} input.today Today (YYYY-MM-DD).
 * @param {string} input.monday Monday of the current week (YYYY-MM-DD).
 * @returns {Promise<SeededTeam>} Members, relations and contexts.
 */
export async function seedTeam({ contributors, today, monday }: { contributors: Contributor[]; today: string; monday: string }): Promise<SeededTeam> {
  const day = (offset: number) => addDays(today, offset);
  const month = (offset: number) => {
    const date = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  };

  // --- Members and relations ------------------------------------------------------------------------
  const members = [];
  for (const contributor of contributors.slice(0, 2)) members.push(await addMember({ contributorId: contributor.id }));
  members.push(await addMember({ name: 'Camille (alternante)' }));
  const accountant = await saveRelation(null, { name: 'Cabinet comptable', note: 'Avances de frais remboursées à chaque bilan.', contributorId: contributors[2]?.id ?? null });
  const friend = await saveRelation(null, { name: 'Julien (associé d’un autre atelier)', note: 'Matériel prêté de temps en temps.' });

  // --- Contexts and their periods (the fair and the holidays of the calendar) -----------------------------
  const contextIds = new Map<string, string>();
  for (const [name, color] of [
    ['Déplacement', '#15aabf'],
    ['Salon', '#be4bdb'],
    ['Séminaire', '#fd7e14'],
  ] as const) {
    contextIds.set(name, (await saveContext(null, { name, color })).id);
  }
  await saveContextPeriod(null, { contextId: contextIds.get('Salon')!, startDate: addDays(monday, 10), endDate: addDays(monday, 12), note: 'Salon professionnel' });
  await saveContextPeriod(null, { contextId: contextIds.get('Séminaire')!, startDate: addDays(monday, -9), endDate: addDays(monday, -8), note: 'Séminaire d’équipe' });
  await saveContextPeriod(null, { contextId: contextIds.get('Déplacement')!, startDate: day(-96), endDate: day(-95), note: 'Rendez-vous client à Paris' });

  // --- Budgets ---------------------------------------------------------------------------------------
  const account = await prisma.treasuryAccount.findFirst({ where: { name: 'Compte courant pro' } });
  const categories = await prisma.treasuryCategory.findMany({ select: { id: true, name: true, direction: true } });
  const category = (name: string, direction: 'IN' | 'OUT' = 'OUT') => categories.find((item) => item.name === name && item.direction === direction)?.id ?? null;
  const budget = (
    categoryName: string,
    amount: number,
    changes: { memberId?: string | null; relationId?: string | null; contextId?: string | null; repeatEvery?: number | null; month?: string; repeatUntil?: string | null },
  ) => {
    const categoryId = category(categoryName);
    if (!categoryId) return null;
    return saveBudget(null, { month: month(-3), memberId: null, contextId: null, repeatEvery: 1, repeatUntil: null, ...changes, categoryId, amount });
  };
  await budget('Logiciels', 100, {});
  await budget('Repas', 150, {});
  await budget('Matériel', 300, { memberId: members[0]?.id ?? null, repeatEvery: 3 });
  await budget('Déplacements', 250, { contextId: contextIds.get('Déplacement') ?? null });
  await budget('Repas', 400, { contextId: contextIds.get('Salon') ?? null, repeatEvery: null, month: addDays(monday, 10).slice(0, 7) });
  await budget('Divers', 200, { relationId: friend.id, repeatEvery: 6, repeatUntil: month(9) });

  // Money in: the expected sales, every month.
  const sales = category('Prestations', 'IN');
  if (sales) await saveBudget(null, { month: month(-3), memberId: null, contextId: null, categoryId: sales, amount: 6000, repeatEvery: 1, repeatUntil: null });

  // --- An event with a relation (not a contributor), at an address with travel times ---------------------
  await createCalendarEvent({
    title: 'Déjeuner avec Julien',
    description: null,
    location: 'Les Halles Paul Bocuse, 102 cours Lafayette, 69003 Lyon',
    locationLat: 45.7629,
    locationLon: 4.8507,
    travelBefore: 15,
    travelAfter: 15,
    links: [],
    allDay: false,
    startDate: addDays(monday, 3),
    startTime: '12:30',
    endDate: addDays(monday, 3),
    endTime: '14:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrence: null,
    reminders: [30],
    projectId: null,
    contributorIds: [],
    relationIds: [friend.id],
    categoryIds: [],
    taskIds: [],
  });

  // --- Split movements --------------------------------------------------------------------------------
  if (account) {
    const base = {
      accountId: account.id,
      valueDate: null,
      clientId: null,
      counterpartyId: null,
      projectId: null,
      note: null,
      recurrence: null,
      allocations: [],
      linkedEntryIds: [],
      libraryDocumentIds: [],
      projectResourceIds: [],
      methodId: (await prisma.treasuryPaymentMethod.findFirst({ where: { name: 'Carte' } }))?.id ?? null,
    };
    const line = (
      value: number,
      changes: { label?: string; memberId?: string | null; relationId?: string | null; loan?: boolean; contextId?: string | null; categoryId?: string | null; mode?: 'AMOUNT' | 'PERCENT' },
    ) => ({
      label: null,
      mode: 'AMOUNT' as const,
      memberId: null,
      contextId: null,
      categoryId: null,
      ...changes,
      value,
    });
    // Team lunch: one share each, the rest (the app user's) not split.
    await createEntry({
      ...base,
      status: 'ACTUAL',
      date: addDays(monday, -9),
      label: 'Dîner du séminaire',
      amount: -186,
      categoryId: category('Repas'),
      lines: members.map((member) => line(-46.5, { memberId: member.id, contextId: contextIds.get('Séminaire') ?? null, categoryId: category('Repas') })),
    });
    // Trip to a client: train and hotel, part of it for a member, in percent.
    await createEntry({
      ...base,
      status: 'ACTUAL',
      date: day(-95),
      label: 'Hôtel — rendez-vous client à Paris',
      amount: -212,
      categoryId: category('Déplacements'),
      lines: [
        line(50, { mode: 'PERCENT', label: 'Chambre de Camille', memberId: members[2]?.id ?? null, contextId: contextIds.get('Déplacement') ?? null, categoryId: category('Déplacements') }),
        line(50, { mode: 'PERCENT', label: 'Ma chambre', contextId: contextIds.get('Déplacement') ?? null, categoryId: category('Déplacements') }),
      ],
    });
    // A purchase of a member, and another one only partly split.
    await createEntry({
      ...base,
      status: 'ACTUAL',
      date: day(-21),
      label: 'Clavier et souris',
      amount: -139,
      categoryId: category('Matériel'),
      lines: [line(-139, { memberId: members[0]?.id ?? null, categoryId: category('Matériel') })],
    });
    await createEntry({
      ...base,
      status: 'ACTUAL',
      date: day(-12),
      label: 'Courses pour la cuisine du bureau',
      amount: -64.3,
      categoryId: category('Divers'),
      lines: [line(-20, { label: 'Café', memberId: members[1]?.id ?? null, categoryId: category('Divers') })],
    });
    // A loan to a relation, half repaid; an advance of the accountant, repaid.
    await createEntry({
      ...base,
      status: 'ACTUAL',
      date: day(-60),
      label: 'Prêt d’un vidéoprojecteur à Julien',
      amount: -300,
      categoryId: category('Divers'),
      lines: [line(-300, { relationId: friend.id, loan: true, categoryId: category('Divers') })],
    });
    await createEntry({
      ...base,
      methodId: (await prisma.treasuryPaymentMethod.findFirst({ where: { name: 'Virement' } }))?.id ?? null,
      status: 'ACTUAL',
      date: day(-30),
      label: 'Julien rembourse la moitié du prêt',
      amount: 150,
      categoryId: category('Divers', 'IN'),
      lines: [line(150, { relationId: friend.id, loan: true, categoryId: category('Divers', 'IN') })],
    });
    await createEntry({
      ...base,
      status: 'ACTUAL',
      date: day(-45),
      label: 'Timbres avancés par le cabinet comptable',
      amount: -24,
      categoryId: category('Divers'),
      lines: [line(-24, { relationId: accountant.id, categoryId: category('Divers') })],
    });
    // Coming: the meals of the fair.
    await createEntry({
      ...base,
      status: 'FORECAST',
      date: addDays(monday, 11),
      label: 'Repas du salon',
      amount: -240,
      categoryId: category('Repas'),
      lines: [
        line(-80, { memberId: members[0]?.id ?? null, contextId: contextIds.get('Salon') ?? null, categoryId: category('Repas') }),
        line(-80, { contextId: contextIds.get('Salon') ?? null, categoryId: category('Repas') }),
      ],
    });
  }

  return { memberIds: members.map((member) => member.id), relationIds: [accountant.id, friend.id], contextIds };
}
