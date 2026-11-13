import { fakerFR as faker } from '@faker-js/faker';
import { addDays, chartConfigSchema, DEFAULT_RECURRENCE, emptyFilter, occurrenceDates, type Recurrence } from '@ordo/shared';
import type { z } from 'zod';
import { prisma } from '../../src/db';
import type { Prisma } from '../../src/generated/prisma/client';
import { createAlarm } from '../../src/services/alarms';
import { createCalendarEvent } from '../../src/services/calendar-events';
import { subscribe } from '../../src/services/calendars';
import { addFiles, addLink, createFolder } from '../../src/services/library';
import { savePlace } from '../../src/services/geo';
import { createCategory as createRoutineCategory, createRoutine } from '../../src/services/routines';
import {
  addItem,
  attachListEntry,
  createBaseList,
  createCategory as createShoppingCategory,
  createList,
  createProduct,
  createStorage,
  createStore,
  setItemPurchased,
  setListClosed,
} from '../../src/services/shopping';
import { materializeTaskOccurrences, setTaskRecurrence } from '../../src/services/task-recurrence';
import { createView } from '../../src/services/task-views';
import { createTimeEntry } from '../../src/services/time-entries';
import { createAccount, createEntry as saveEntry, realizeForecast } from '../../src/services/treasury';
import { saveBudget } from '../../src/services/treasury-budgets';
import { createCategory, createCounterparty, createPaymentMethod } from '../../src/services/treasury-settings';
import { addMember, saveContext, saveContextPeriod, saveRelation } from '../../src/services/treasury-team';
import { saveDefaultScheduleKind, saveScheduleType, subscribeScheduleKind } from '../../src/services/work-schedules';
import { ensureMeContributor, meContributorId, setWorkspaceNotifications } from '../../src/services/workspaces';
import { enterWorkspace, type WorkspaceScope } from '../../src/workspace-context';
import { projectFactory, taskFactory, TIME_ZONE } from './factories';
import { initialsIcon } from './images';
import { tinyPdf } from './mail';
import { rebuildStatusHistory } from './history';
import { purgeWorkspace } from './purge';
import { tickRoutines } from './routines';

/**
 * Creates a movement; a split one has its categories on its lines only.
 * @param {Parameters<typeof saveEntry>[0]} input Movement.
 * @returns {ReturnType<typeof saveEntry>} Movement.
 */
const createEntry = (input: Parameters<typeof saveEntry>[0]) => saveEntry(input.lines?.length ? { ...input, categoryId: null } : input);

/**
 * Rule from the default one.
 * @param {Partial<Recurrence>} changes Changes.
 * @returns {Recurrence} Rule.
 */
const rule = (changes: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...changes });

/**
 * Chart configuration from the defaults.
 * @param {Partial<z.input<typeof chartConfigSchema>>} config Changes.
 * @returns {Prisma.InputJsonValue} Stored configuration.
 */
const chart = (config: Partial<z.input<typeof chartConfigSchema>>) => chartConfigSchema.parse({ filter: emptyFilter(), ...config }) as unknown as Prisma.InputJsonValue;

/**
 * PDF of the fixtures.
 * @param {string} name File name.
 * @param {string} text Text (ASCII).
 * @returns {File} File.
 */
const pdf = (name: string, text: string) => new File([tinyPdf(text)], name, { type: 'application/pdf' });

/** What the personal workspace offers to the professional one. */
export interface SeededPersonal {
  /** Kind of the childcare schedules (the professional workspace subscribes to it). */
  childcareTypeId: string;
  /** Family calendar (the professional workspace subscribes to it). */
  familyCalendarId: string;
}

/**
 * Personal workspace (household): purged, then filled with what a personal workspace shows: projects without clients,
 * tasks (recurring ones too), a family calendar with its events (yearly, with a relation, an address and travel
 * times), the professional calendar and working hours subscribed to, schedules of its own (default kind renamed,
 * childcare kind), the household's treasury (members, relation, context, budgets, split movements, salary and rent
 * realized), shopping, routines (cases, following the childcare schedule, history), library, places, a dashboard,
 * alarms, tracked time, a task view and its notifications.
 * @param {object} input Data.
 * @param {WorkspaceScope} input.workspace Personal workspace.
 * @param {string} input.proWorkspaceId Professional workspace (its calendar and working hours are subscribed to).
 * @param {string} input.proCalendarId Work calendar of the professional workspace.
 * @param {{ id: string, username: string } | null} input.user App user.
 * @param {string} input.today Today (YYYY-MM-DD).
 * @param {string} input.monday Monday of the current week (YYYY-MM-DD).
 * @returns {Promise<SeededPersonal>} Kind and calendar offered to the professional workspace.
 */
export async function seedPersonal({
  workspace,
  proWorkspaceId,
  proCalendarId,
  user,
  today,
  monday,
}: {
  workspace: WorkspaceScope;
  proWorkspaceId: string;
  proCalendarId: string;
  user: { id: string; username: string } | null;
  today: string;
  monday: string;
}): Promise<SeededPersonal> {
  enterWorkspace(workspace);
  await purgeWorkspace();
  if (user) await ensureMeContributor(user);
  const meId = user ? await meContributorId(user.id) : null;
  const day = (offset: number) => addDays(today, offset);
  const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

  // --- Household: members (contributors) and a relation ---------------------------------------------------
  const alex = await addMember({ name: 'Alex' });
  const lea = await addMember({ name: 'Léa' });
  const tom = await addMember({ name: 'Tom' });
  for (const [index, member] of [alex, lea, tom].entries()) {
    await prisma.contributor.update({ where: { id: member.id }, data: { iconId: await initialsIcon(member.name, ['#e64980', '#7950f2', '#15aabf'][index]) } });
  }
  const granny = await saveRelation(null, { name: 'Mamie', note: 'Garde les enfants le mercredi.' });

  // --- Labels ---------------------------------------------------------------------------------------
  const todo = await prisma.taskStatus.create({ data: { name: 'À faire', color: '#868e96', category: 'TODO', position: 0 } });
  const doing = await prisma.taskStatus.create({ data: { name: 'En cours', color: '#228be6', category: 'IN_PROGRESS', position: 1 } });
  const done = await prisma.taskStatus.create({ data: { name: 'Fait', color: '#40c057', category: 'DONE', position: 2 } });
  const dropped = await prisma.taskStatus.create({ data: { name: 'Abandonné', color: '#fa5252', category: 'CANCELLED', position: 3 } });
  const urgent = await prisma.taskPriority.create({ data: { name: 'Urgent', color: '#fa5252', position: 0 } });
  const tags = await Promise.all(
    [
      ['maison', '#fd7e14'],
      ['enfants', '#7950f2'],
      ['papiers', '#fab005'],
    ].map(([name, color], position) => prisma.taskTag.create({ data: { name, color, position } })),
  );

  // --- Projects (no clients in a personal workspace) and tasks ---------------------------------------------
  const project = (title: string, color: string, parentId: string | null = null) => projectFactory.create({ title, color, parentId, clientId: null });
  const bathroom = await project('Rénovation de la salle de bain', '#15aabf');
  const quotes = await project('Devis des artisans', '#15aabf', bathroom.id);
  const holidays = await project('Vacances d’été', '#fab005');
  const garden = await project('Jardin', '#40c057');
  const papers = await project('Administratif', '#868e96');
  await prisma.project.update({ where: { id: bathroom.id }, data: { iconId: await initialsIcon('Salle de bain', '#15aabf') } });
  const task = (projectId: string, title: string, status = todo, changes: Partial<Prisma.TaskUncheckedCreateInput> = {}) =>
    taskFactory.create({
      projectId,
      title,
      statusId: status.id,
      closedAt: status === done || status === dropped ? faker.date.recent({ days: 20 }) : null,
      assignees: {
        connect: faker.helpers
          .arrayElements(
            [meId, alex.id, lea.id].filter((id): id is string => Boolean(id)),
            { min: 0, max: 2 },
          )
          .map((id) => ({ id })),
      },
      tags: { connect: faker.helpers.arrayElements(tags, { min: 0, max: 1 }).map(({ id }) => ({ id })) },
      ...changes,
    });
  await task(quotes.id, 'Demander un devis au plombier', done);
  await task(quotes.id, 'Comparer les devis', doing, { priorityId: urgent.id });
  await task(bathroom.id, 'Choisir le carrelage', todo, { deadline: date(day(14)) });
  await task(bathroom.id, 'Poser la nouvelle vasque', todo);
  const packing = await task(holidays.id, 'Préparer les valises', todo, { startDate: date(day(30)), endDate: date(day(31)) });
  await task(holidays.id, 'Réserver le gîte', done);
  await task(holidays.id, 'Renouveler les passeports', dropped);
  await task(garden.id, 'Tailler la haie', todo, { startDate: date(day(3)) });
  const birthday = await task(papers.id, 'Préparer l’anniversaire de Tom', doing, { deadline: date(day(9)), priorityId: urgent.id });
  // Recurring: the bins every week, the canteen every month.
  const bins = await task(garden.id, 'Sortir les poubelles', todo, { startDate: date(addDays(monday, 1)), endDate: null, deadline: null });
  const canteen = await task(papers.id, 'Payer la cantine', todo, { startDate: date(addDays(monday, 3)), endDate: null, deadline: null });
  await setTaskRecurrence(bins.id, rule({ weekdays: [2] }));
  await setTaskRecurrence(canteen.id, rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }));
  await materializeTaskOccurrences(day(-21), day(30));
  for (const occurrence of await prisma.task.findMany({ where: { seriesId: { not: null }, occurrenceDate: { lt: date(today) } } })) {
    await prisma.task.update({ where: { id: occurrence.id }, data: { statusId: done.id, closedAt: new Date(`${occurrence.occurrenceDate!.toISOString().slice(0, 10)}T19:00:00`) } });
  }
  await rebuildStatusHistory(todo.id, doing.id);
  if (meId)
    await createView({
      name: 'Mes tâches',
      config: { filter: { ...emptyFilter(), children: [{ type: 'condition', id: 'mine', field: 'assignees', operator: 'anyOf', value: [meId] }] }, groupBy: 'project' },
    });
  await createView({ name: 'Par étiquette', config: { filter: emptyFilter(), groupBy: 'tags' } });

  // --- Places --------------------------------------------------------------------------------------------
  const home = await savePlace(null, { name: 'Maison', address: '8 rue Paul Bert, 69003 Lyon', lat: 45.7578, lon: 4.8511 });
  const school = await savePlace(null, { name: 'École', address: '15 rue Rachais, 69007 Lyon', lat: 45.7492, lon: 4.8478 });
  const conservatory = await savePlace(null, { name: 'Conservatoire', address: '4 montée Cardinal Decourtray, 69005 Lyon', lat: 45.7615, lon: 4.8215 });

  // --- Calendar: family calendar, its events, the professional one subscribed to ------------------------------
  const family = await prisma.calendar.create({ data: { name: 'Famille', color: '#e64980', position: 0 } });
  const kids = (await prisma.calendarCategory.create({ data: { name: 'Enfants', color: '#7950f2', position: 0 } })).id;
  const health = (await prisma.calendarCategory.create({ data: { name: 'Santé', color: '#fa5252', position: 1 } })).id;
  const leisure = (await prisma.calendarCategory.create({ data: { name: 'Loisirs', color: '#40c057', position: 2 } })).id;
  const event = {
    description: null,
    location: null,
    links: [],
    allDay: false,
    timeZone: TIME_ZONE,
    recurrence: null,
    reminders: [30],
    projectId: null,
    calendarId: family.id,
    contributorIds: [],
    relationIds: [],
    categoryIds: [],
    taskIds: [],
  };
  await createCalendarEvent({
    ...event,
    title: 'Piano de Léa',
    location: conservatory.address,
    locationLat: conservatory.lat,
    locationLon: conservatory.lon,
    travelBefore: 20,
    travelAfter: 20,
    startDate: addDays(monday, -26),
    startTime: '14:00',
    endDate: addDays(monday, -26),
    endTime: '15:00',
    recurrence: rule({ weekdays: [3], pauses: [{ from: addDays(monday, 38), to: addDays(monday, 45) }] }),
    contributorIds: [lea.id],
    categoryIds: [kids],
  });
  await createCalendarEvent({
    ...event,
    title: 'Anniversaire de Tom',
    allDay: true,
    startDate: day(9),
    startTime: null,
    endDate: day(9),
    endTime: null,
    recurrence: rule({ frequency: 'YEARLY' }),
    reminders: [1440 * 7],
    categoryIds: [kids],
    taskIds: [birthday.id],
  });
  await createCalendarEvent({
    ...event,
    title: 'Repas chez Mamie',
    location: '3 place Bellecour, 69002 Lyon',
    locationLat: 45.7578,
    locationLon: 4.832,
    travelBefore: 25,
    travelAfter: 25,
    startDate: addDays(monday, 6),
    startTime: '12:00',
    endDate: addDays(monday, 6),
    endTime: '15:00',
    relationIds: [granny.id],
    categoryIds: [leisure],
  });
  await createCalendarEvent({
    ...event,
    title: 'Dentiste — Tom',
    location: 'Cabinet dentaire',
    startDate: day(4),
    startTime: '17:30',
    endDate: day(4),
    endTime: '18:00',
    contributorIds: [tom.id],
    categoryIds: [health],
    reminders: [60, 1440],
  });
  await createCalendarEvent({
    ...event,
    title: 'Vacances d’été',
    allDay: true,
    startDate: day(30),
    startTime: null,
    endDate: day(44),
    endTime: null,
    projectId: holidays.id,
    taskIds: [packing.id],
    categoryIds: [leisure],
  });
  await subscribe(proCalendarId);

  // --- Schedules: default kind renamed, a childcare kind every other week, working hours subscribed to -----------
  await saveDefaultScheduleKind({ name: 'Disponibilités', color: '#40c057', dayDisplay: 'SLOT_BACKGROUND', dayBar: true, monthDisplay: 'BACKGROUND' });
  const range = (start: string, end: string) => ({ start, end });
  const weekly = (weekdays: number[], ranges: { start: string; end: string }[], every = 1) => ({ pattern: 'WEEKLY', weekdays, every, from: null, allDay: false, ranges });
  await prisma.workSchedule.create({
    data: { name: 'Soirs et week-ends', startDate: date(addDays(monday, -56)), cases: [weekly([1, 2, 3, 4, 5], [range('19:00', '22:00')]), weekly([6, 7], [range('09:00', '22:00')])], exceptions: [] },
  });
  const childcare = await saveScheduleType(null, { name: 'Garde des enfants', color: '#7950f2', dayDisplay: 'DAY_BACKGROUND', dayBar: true, monthDisplay: 'BORDER' });
  const childcareSchedule = await prisma.workSchedule.create({
    data: {
      name: 'Semaines de garde',
      typeId: childcare.id,
      startDate: date(addDays(monday, -28)),
      cases: [weekly([1, 2, 4, 5], [range('16:30', '19:30')], 2), weekly([3], [range('12:00', '19:30')], 2)],
      exceptions: [{ from: addDays(monday, 38), to: addDays(monday, 45), label: 'Chez l’autre parent', cases: [] }],
    },
  });
  await subscribeScheduleKind(proWorkspaceId, null);

  // --- Treasury of the household ---------------------------------------------------------------------------
  const account = await createAccount({ name: 'Compte joint', openingBalance: 2400, openingDate: day(-120) });
  await createAccount({ name: 'Livret A', openingBalance: 8000, openingDate: day(-120) });
  const categoryIds = new Map<string, string>();
  const category = async (name: string, direction: 'IN' | 'OUT', parent?: string) => {
    categoryIds.set(`${direction}:${name}`, (await createCategory({ name, direction, parentId: parent ? (categoryIds.get(`${direction}:${parent}`) ?? null) : null })).id);
  };
  for (const name of ['Salaires', 'Allocations', 'Cadeaux reçus']) await category(name, 'IN');
  for (const name of ['Logement', 'Alimentation', 'Enfants', 'Loisirs', 'Santé', 'Cadeaux']) await category(name, 'OUT');
  for (const name of ['Loyer', 'Énergie']) await category(name, 'OUT', 'Logement');
  for (const name of ['Cantine', 'Activités']) await category(name, 'OUT', 'Enfants');
  const out = (name: string) => categoryIds.get(`OUT:${name}`) ?? null;
  const card = (await createPaymentMethod({ name: 'Carte', incoming: false, outgoing: true })).id;
  const transfer = (await createPaymentMethod({ name: 'Virement', incoming: true, outgoing: true })).id;
  const landlord = (await createCounterparty({ name: 'Régie Lyon Centre', note: null, archived: false })).id;
  const holidaysContext = (await saveContext(null, { name: 'Vacances', color: '#fab005' })).id;
  await saveContextPeriod(null, { contextId: holidaysContext, startDate: day(30), endDate: day(44), note: 'Gîte en Ardèche' });
  const entry = {
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
    methodId: card,
  };
  // Salary and rent: repeated forecasts realized every month.
  for (const forecast of [
    { label: 'Salaire', amount: 2650, categoryId: categoryIds.get('IN:Salaires') ?? null, methodId: transfer, counterpartyId: null },
    { label: 'Loyer', amount: -980, categoryId: out('Loyer'), methodId: transfer, counterpartyId: landlord },
    { label: 'Électricité', amount: -86, categoryId: out('Énergie'), methodId: transfer, counterpartyId: null },
  ]) {
    const start = day(-115);
    const recurrence = rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' });
    const created = await createEntry({ ...entry, ...forecast, status: 'FORECAST', date: start, recurrence });
    for (const occurrence of occurrenceDates(recurrence, start, start, day(-1))) await realizeForecast(created.id, occurrence, { date: occurrence, amount: forecast.amount });
  }
  // Groceries shared between the members, activities of the children, a gift to the relation.
  for (let week = 1; week <= 8; week += 1) {
    const amount = -faker.number.float({ min: 70, max: 160, fractionDigits: 2 });
    await createEntry({ ...entry, status: 'ACTUAL', date: day(-week * 7), label: 'Courses de la semaine', amount, categoryId: out('Alimentation') });
  }
  await createEntry({
    ...entry,
    status: 'ACTUAL',
    date: day(-40),
    label: 'Inscriptions de la rentrée',
    amount: -420,
    categoryId: out('Activités'),
    lines: [
      { label: 'Piano', mode: 'AMOUNT', value: -300, memberId: lea.id, contextId: null, categoryId: out('Activités') },
      { label: 'Judo', mode: 'AMOUNT', value: -120, memberId: tom.id, contextId: null, categoryId: out('Activités') },
    ],
  });
  await createEntry({
    ...entry,
    status: 'ACTUAL',
    date: day(-15),
    label: 'Fleurs pour Mamie',
    amount: -35,
    categoryId: out('Cadeaux'),
    lines: [{ label: null, mode: 'AMOUNT', value: -35, memberId: null, relationId: granny.id, contextId: null, categoryId: out('Cadeaux') }],
  });
  await createEntry({
    ...entry,
    status: 'FORECAST',
    date: day(32),
    label: 'Gîte — solde',
    amount: -650,
    categoryId: out('Loisirs'),
    lines: [{ label: null, mode: 'PERCENT', value: 100, memberId: null, contextId: holidaysContext, categoryId: out('Loisirs') }],
  });
  const month = today.slice(0, 7);
  for (const [name, amount, changes] of [
    ['Alimentation', 600, {}],
    ['Loisirs', 80, { memberId: lea.id }],
    ['Loisirs', 80, { memberId: tom.id }],
    ['Loisirs', 900, { contextId: holidaysContext, repeatEvery: null }],
  ] as const) {
    await saveBudget(null, { month, memberId: null, contextId: null, repeatEvery: 1, repeatUntil: null, ...changes, categoryId: out(name)!, amount });
  }
  await saveBudget(null, { month, memberId: null, contextId: null, repeatEvery: 1, repeatUntil: null, categoryId: categoryIds.get('IN:Salaires')!, amount: 2650 });

  // --- Shopping --------------------------------------------------------------------------------------------
  const market = (await createStore({ name: 'Marché', color: '#40c057' })).id;
  const supermarket = (await createStore({ name: 'Supermarché', color: '#228be6' })).id;
  const pharmacy = (await createStore({ name: 'Pharmacie', color: '#fa5252' })).id;
  const fridge = (await createStorage({ name: 'Réfrigérateur', color: '#15aabf' })).id;
  const freezer = (await createStorage({ name: 'Congélateur', color: '#4c6ef5' })).id;
  const usual = await createBaseList('Courses habituelles');
  const medicine = await createBaseList('Pharmacie');
  const shopCategory = async (name: string, color: string, baseListIds: string[]) => (await createShoppingCategory({ name, color, parentId: null, baseListIds })).id;
  const fresh = await shopCategory('Frais', '#82c91e', [usual.id]);
  const grocery = await shopCategory('Épicerie', '#fab005', [usual.id]);
  const care = await shopCategory('Soins', '#fa5252', [medicine.id]);
  const article = (name: string, categoryId: string, storeId: string, changes: Record<string, unknown> = {}) => ({
    name,
    categoryId,
    storeId,
    url: null,
    note: null,
    quantity: null,
    unit: null,
    unitPrice: null,
    ...changes,
  });
  for (const [baseListId, item, missing] of [
    [usual.id, article('Fruits de saison', fresh, market, { quantity: 2, unit: 'kg', unitPrice: 3.5 }), true],
    [usual.id, article('Lait', fresh, supermarket, { quantity: 6, unit: 'L', unitPrice: 1.1, perishable: true, storageId: fridge, expiresAt: day(6) }), true],
    [usual.id, article('Poisson pané', fresh, supermarket, { quantity: 1, unitPrice: 4.2, perishable: true, storageId: freezer, expiresAt: day(90), memberIds: [tom.id] }), false],
    [usual.id, article('Pâtes', grocery, supermarket, { quantity: 3, unit: 'paquets', unitPrice: 1.3 }), true],
    [usual.id, article('Céréales', grocery, supermarket, { quantity: 2, unitPrice: 3.9, memberIds: [lea.id, tom.id] }), false],
    [medicine.id, article('Paracétamol', care, pharmacy, { quantity: 1, unit: 'boîte', unitPrice: 2.2 }), true],
    [medicine.id, article('Pansements', care, pharmacy, { quantity: 1, unitPrice: 3.5 }), false],
  ] as const) {
    await createProduct({ ...item, baseListId, missing });
  }
  const weekly_list = await createList({ name: 'Courses du samedi', taskIds: [], baseListIds: [usual.id, medicine.id] });
  for (const item of (await prisma.shoppingItem.findMany({ where: { listId: weekly_list.id }, orderBy: { position: 'asc' } })).slice(0, 2)) await setItemPurchased(item.id, true);
  const party = await createList({ name: 'Anniversaire de Tom', taskIds: [birthday.id], baseListIds: [] });
  await addItem(party.id, article('Gâteau', grocery, supermarket, { quantity: 1, unitPrice: 18, note: 'Au chocolat, sans noix.' }));
  await addItem(party.id, article('Bougies', grocery, supermarket, { quantity: 1, unitPrice: 2.5 }));
  const lastWeek = await createList({ name: 'Courses de la semaine dernière', taskIds: [], baseListIds: [] });
  await addItem(lastWeek.id, article('Légumes', fresh, market, { quantity: 3, unit: 'kg', unitPrice: 2.8 }));
  for (const item of await prisma.shoppingItem.findMany({ where: { listId: lastWeek.id } })) await setItemPurchased(item.id, true);
  await setListClosed(lastWeek.id, true);
  const paid = await prisma.treasuryEntry.findFirst({ where: { label: 'Courses de la semaine', status: 'ACTUAL' }, orderBy: { date: 'desc' } });
  if (paid) await attachListEntry(lastWeek.id, paid.id);

  // --- Routines ------------------------------------------------------------------------------------------
  const homeCategory = (await createRoutineCategory({ name: 'Maison', color: '#fd7e14', parentId: null })).id;
  const kidsCategory = (await createRoutineCategory({ name: 'Enfants', color: '#7950f2', parentId: null })).id;
  const healthCategory = (await createRoutineCategory({ name: 'Santé', color: '#fa5252', parentId: null })).id;
  const routine = (title: string, recurrence: Recurrence, changes: Partial<Parameters<typeof createRoutine>[0]>) =>
    createRoutine({ title, description: null, categoryIds: [], parentId: null, startDate: day(-35), recurrence, estimate: null, projectId: null, assigneeIds: [], requiredIds: [], ...changes });
  await routine('Se brosser les dents', rule({}), {
    categoryIds: [healthCategory],
    estimate: 3,
    assigneeIds: [lea.id, tom.id],
    cases: [
      {
        recurrence: rule({ weekdays: [1, 2, 3, 4, 5] }),
        slots: [
          { fromTime: '07:00', dueTime: '08:00' },
          { fromTime: '20:00', dueTime: '21:00' },
        ],
      },
      {
        recurrence: rule({ weekdays: [6, 7] }),
        slots: [
          { fromTime: '08:30', dueTime: '10:00' },
          { fromTime: '20:30', dueTime: '21:30' },
        ],
      },
    ],
  });
  await routine('Aller chercher les enfants à l’école', rule({}), {
    categoryIds: [kidsCategory],
    scheduleId: childcareSchedule.id,
    scheduleAnchor: 'START',
    location: school.name,
    locationLat: school.lat,
    locationLon: school.lon,
    travelBefore: 15,
    reminders: [20],
  });
  const homework = await routine('Devoirs', rule({ weekdays: [1, 2, 4] }), { categoryIds: [kidsCategory], fromTime: '17:30', dueTime: '19:00', estimate: 45, assigneeIds: [lea.id, tom.id] });
  await routine('Préparer les cartables', rule({ weekdays: [1, 2, 3, 4, 7] }), { categoryIds: [kidsCategory], fromTime: '20:00', dueTime: '21:00', estimate: 10, requiredIds: [homework.id] });
  const chores = await routine('Ménage', rule({ weekdays: [6] }), { categoryIds: [homeCategory], estimate: 90, assigneeIds: meId ? [meId, alex.id] : [alex.id] });
  await routine('Aspirateur', rule({ weekdays: [6] }), { parentId: chores.id, categoryIds: [homeCategory], estimate: 30 });
  await routine('Changer les draps', rule({ interval: 2, weekdays: [6] }), { parentId: chores.id, categoryIds: [homeCategory], estimate: 20 });
  await routine('Arroser le jardin', rule({ frequency: 'DAILY', pauses: [{ from: day(30), to: day(44) }] }), {
    categoryIds: [homeCategory],
    fromTime: '19:00',
    dueTime: '21:00',
    estimate: 10,
    location: home.name,
    locationLat: home.lat,
    locationLon: home.lon,
    projectId: garden.id,
  });
  await routine('Vitamine D', rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }), { categoryIds: [healthCategory], dueTime: '09:00', reminders: [0] });
  const checks = await tickRoutines(today);
  const gardenRoutine = await prisma.routine.findFirst({ where: { title: 'Arroser le jardin' } });
  for (const check of checks.filter((item) => item.routineId === gardenRoutine?.id).slice(0, 6)) {
    await createTimeEntry({ routineId: check.routineId, projectId: garden.id, startedAt: new Date(check.doneAt.getTime() - 10 * 60_000), duration: 10 * 60 });
  }

  // --- Tracked time on the projects ------------------------------------------------------------------------
  for (let index = 0; index < 6; index += 1) {
    const startedAt = new Date(`${day(-faker.number.int({ min: 1, max: 30 }))}T${String(faker.number.int({ min: 9, max: 17 })).padStart(2, '0')}:00:00`);
    await createTimeEntry({
      projectId: faker.helpers.arrayElement([bathroom.id, garden.id, papers.id]),
      description: faker.helpers.arrayElement(['Bricolage', 'Rangement', 'Papiers']),
      startedAt,
      duration: faker.number.int({ min: 2, max: 8 }) * 15 * 60,
    });
  }

  // --- Library ---------------------------------------------------------------------------------------------
  const healthFolder = await createFolder('Santé', null);
  const taxes = await createFolder('Impôts', null);
  const house = await createFolder('Logement', null);
  await addFiles(healthFolder.id, [pdf('Carnet de vaccination de Tom.pdf', 'Carnet de vaccination'), pdf('Attestation mutuelle.pdf', 'Attestation mutuelle')]);
  await addFiles(taxes.id, [pdf('Avis d’imposition 2026.pdf', 'Avis d imposition 2026')]);
  await addLink(taxes.id, { title: 'Espace particulier impots.gouv', url: 'https://www.impots.gouv.fr', note: null });
  await addFiles(house.id, [pdf('Bail.pdf', 'Bail'), pdf('Quittance de loyer.pdf', 'Quittance de loyer')]);

  // --- Dashboard of the household ------------------------------------------------------------------------------
  const board = await prisma.dashboard.create({ data: { name: 'Foyer', projectId: null, position: 0 } });
  await prisma.dashboardChart.createMany({
    data: [
      {
        title: 'Dépenses par catégorie',
        wide: false,
        config: chart({ source: 'treasury', type: 'donut', dimension: 'category', period: 'past:91', measure: 'expense', treasury: { direction: 'out' } }),
      },
      { title: 'Solde du compte joint', wide: true, config: chart({ source: 'treasury', type: 'line', dimension: 'date', bucket: 'week', period: 'past:91', measure: 'balance' }) },
      { title: 'Tâches par projet', wide: false, config: chart({ type: 'stackedBar', dimension: 'project', series: 'state' }) },
    ].map((item, position) => ({ ...item, dashboardId: board.id, position })),
  });

  // --- Alarms and notifications --------------------------------------------------------------------------------
  const alarm = { note: null, interval: 1, weekdays: [], endDate: null, minutes: null, projectId: null, taskId: null, enabled: true };
  await createAlarm({ ...alarm, title: 'Sortir les poubelles', type: 'REMINDER', frequency: 'WEEKLY', weekdays: [2], startDate: monday, time: '20:30', taskId: bins.id, projectId: garden.id });
  await createAlarm({ ...alarm, title: 'Acheter le cadeau de Tom', type: 'REMINDER', frequency: 'ONCE', startDate: day(5), time: '12:00', taskId: birthday.id, projectId: papers.id });
  await createAlarm({ ...alarm, title: 'Relevé des compteurs', type: 'REMINDER', frequency: 'MONTHLY', startDate: day(-20), time: '18:00' });
  await setWorkspaceNotifications(workspace.id, ['ALARMS', 'CALENDAR']);

  console.log('Fixtures de l’espace personnel :', {
    projets: await prisma.project.count(),
    tâches: await prisma.task.count(),
    évènements: await prisma.calendarEvent.count(),
    plages: await prisma.workSchedule.count(),
    'mouvements de trésorerie': await prisma.treasuryEntry.count(),
    'produits de courses': await prisma.shoppingProduct.count(),
    routines: await prisma.routine.count(),
    'routines cochées': await prisma.routineCheck.count(),
    alarmes: await prisma.alarm.count(),
  });
  return { childcareTypeId: childcare.id, familyCalendarId: family.id };
}
