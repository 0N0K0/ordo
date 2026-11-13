import { fakerFR as faker } from '@faker-js/faker';
import { addDays, DEFAULT_RECURRENCE, type Recurrence, type RoutineInput } from '@ordo/shared';
import { prisma } from '../../src/db';
import type { Contributor, Project } from '../../src/generated/prisma/client';
import { savePlace } from '../../src/services/geo';
import { createTimeEntry } from '../../src/services/time-entries';
import {
  changeRoutineOccurrence,
  createCategory,
  createRoutine,
  deleteRoutineOccurrence,
  moveRoutineOccurrence,
  occurrencesBetween,
  routineToday,
  setRoutineArchived,
  slotsOf,
} from '../../src/services/routines';

/**
 * Rule from the default one.
 * @param {Partial<Recurrence>} changes Changes.
 * @returns {Recurrence} Rule.
 */
const rule = (changes: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...changes });

/**
 * Ticks most occurrences of the routines of the current workspace over the last four weeks (each time of the day
 * apart; today, only some first ones): their history.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {Promise<{ routineId: string, date: Date, slot: number, doneAt: Date }[]>} Ticks made.
 */
export async function tickRoutines(today: string): Promise<{ routineId: string; date: Date; slot: number; doneAt: Date }[]> {
  const routines = await prisma.routine.findMany({ where: { archivedAt: null }, include: { schedule: true } });
  const checks: { routineId: string; date: Date; slot: number; doneAt: Date }[] = [];
  for (const routine of routines) {
    for (const date of occurrencesBetween(routine, addDays(today, -28), today)) {
      const slots = Math.max(1, slotsOf(routine, date).length);
      for (let slot = 0; slot < slots; slot += 1) {
        if (date === today && (slot > 0 || faker.datatype.boolean(0.5))) continue;
        if (!faker.datatype.boolean(0.8)) continue;
        const hour = faker.number.int({ min: 8, max: 20 });
        checks.push({
          routineId: routine.id,
          date: new Date(`${date}T00:00:00.000Z`),
          slot,
          doneAt: new Date(`${date}T${String(hour).padStart(2, '0')}:${String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0')}:00`),
        });
      }
    }
  }
  await prisma.routineCheck.createMany({ data: checks });
  return checks;
}

/**
 * Places and routines: categories (with sub-categories), routines with their own rule and time window, with cases
 * (several times of the day, one optional), following a schedule, with sub-routines, a dependency, a place and its
 * travel times, for a project, assigned, archived; their ticks of the last weeks (the history), a moved occurrence,
 * one with other times and a deleted one.
 * @param {object} input Data of the other fixtures.
 * @param {Project[]} input.projects Projects.
 * @param {Contributor[]} input.contributors Contributors.
 * @param {string | null} input.meId Contributor of the app user.
 * @param {string} input.scheduleId Working hours (schedule) a routine follows.
 * @returns {Promise<void>}
 */
export async function seedRoutines({ projects, contributors, meId, scheduleId }: { projects: Project[]; contributors: Contributor[]; meId: string | null; scheduleId: string }): Promise<void> {
  const today = routineToday();

  // --- Places ------------------------------------------------------------------------------------------
  const office = await savePlace(null, { name: 'Bureau', address: '12 rue de la République, 69002 Lyon', lat: 45.7615, lon: 4.8357 });
  const gym = await savePlace(null, { name: 'Salle de sport', address: '40 quai Perrache, 69002 Lyon', lat: 45.7436, lon: 4.8215 });
  await savePlace(null, { name: 'Maison', address: '8 rue Paul Bert, 69003 Lyon', lat: 45.7578, lon: 4.8511 });
  await savePlace(null, { name: 'Client — Villeurbanne', address: '20 cours Émile Zola, 69100 Villeurbanne', lat: 45.7699, lon: 4.8803 });

  // --- Categories --------------------------------------------------------------------------------------
  const category = async (name: string, color: string | null, parentId: string | null = null) => (await createCategory({ name, color, parentId })).id;
  const work = await category('Bureau', '#228be6');
  const paperwork = await category('Administratif', '#fab005', work);
  const tidying = await category('Rangement', '#12b886', work);
  const health = await category('Santé', '#fa5252');
  const learning = await category('Apprentissage', '#7950f2');

  const activeRoots = projects.filter((project) => project.parentId === null && !project.archivedAt);
  const base = (title: string, startOffset: number, recurrence: Recurrence, changes: Partial<RoutineInput> = {}): RoutineInput => ({
    title,
    description: null,
    categoryIds: [],
    parentId: null,
    startDate: addDays(today, startOffset),
    recurrence,
    estimate: null,
    projectId: null,
    assigneeIds: [],
    requiredIds: [],
    ...changes,
  });
  const mine = meId ? [meId] : [];

  // --- Routines ----------------------------------------------------------------------------------------
  const mail = await createRoutine(
    base('Relever le courrier', -60, rule({ weekdays: [1, 2, 3, 4, 5] }), {
      categoryIds: [paperwork],
      fromTime: '09:00',
      dueTime: '10:00',
      estimate: 10,
      location: office.name,
      locationLat: office.lat,
      locationLon: office.lon,
      assigneeIds: mine,
    }),
  );
  const timesheet = await createRoutine(
    base('Saisir les temps de la semaine', -56, rule({ weekdays: [5] }), { categoryIds: [paperwork], dueTime: '18:00', estimate: 15, reminders: [30], assigneeIds: mine }),
  );
  await createRoutine(
    base('Préparer la facturation du mois', -90, rule({ frequency: 'MONTHLY', monthlyMode: 'DAY' }), {
      description: 'Relever les temps passés, vérifier les acomptes, puis émettre les factures.',
      categoryIds: [paperwork],
      estimate: 60,
      reminders: [1440],
      requiredIds: [timesheet.id],
      assigneeIds: mine,
    }),
  );
  await createRoutine(
    base('Sauvegarde des postes', -42, rule({}), { categoryIds: [tidying], estimate: 10, scheduleId, scheduleAnchor: 'END', description: 'Avant de partir, à la fin des horaires de travail.' }),
  );
  await createRoutine(
    base('Pauses actives', -30, rule({}), {
      categoryIds: [health],
      estimate: 5,
      cases: [
        {
          recurrence: rule({ weekdays: [1, 2, 3, 4] }),
          slots: [
            { fromTime: '10:30', dueTime: '11:00' },
            { fromTime: '15:30', dueTime: '16:00' },
            { fromTime: '17:30', dueTime: '18:00', optional: true },
          ],
        },
        { recurrence: rule({ weekdays: [5] }), slots: [{ fromTime: '10:30', dueTime: '11:00' }] },
      ],
    }),
  );
  await createRoutine(
    base('Sport', -45, rule({ weekdays: [2, 4] }), {
      categoryIds: [health],
      fromTime: '18:30',
      dueTime: '20:00',
      estimate: 60,
      location: gym.name,
      locationLat: gym.lat,
      locationLon: gym.lon,
      travelBefore: 15,
      travelAfter: 20,
      reminders: [15],
    }),
  );
  const cleaning = await createRoutine(base('Ménage du bureau', -70, rule({ weekdays: [1, 4] }), { categoryIds: [tidying], estimate: 30, assigneeIds: contributors.slice(0, 2).map(({ id }) => id) }));
  await createRoutine(base('Vider les poubelles', -70, rule({ weekdays: [1, 4] }), { parentId: cleaning.id, categoryIds: [tidying], estimate: 5 }));
  await createRoutine(base('Nettoyer la machine à café', -70, rule({ interval: 2, weekdays: [5] }), { parentId: cleaning.id, categoryIds: [tidying], estimate: 10 }));
  const plants = await createRoutine(base('Arroser les plantes', -50, rule({ weekdays: [1] }), { categoryIds: [tidying], estimate: 5 }));
  if (activeRoots[0]) {
    await createRoutine(
      base(`Point d’avancement — ${activeRoots[0].title}`, -35, rule({ weekdays: [4] }), { projectId: activeRoots[0].id, fromTime: '11:00', dueTime: '12:00', estimate: 20, assigneeIds: mine }),
    );
  }
  await createRoutine(base('Lire un chapitre de documentation', -40, rule({ frequency: 'DAILY', count: 60 }), { categoryIds: [learning], estimate: 20, dueTime: '22:00' }));
  const watch = await createRoutine(base('Veille techno', -120, rule({ weekdays: [2] }), { categoryIds: [learning], fromTime: '08:30', dueTime: '09:00', estimate: 30 }));

  // --- Ticks of the last four weeks (most of them, some late, some forgotten) ----------------------------
  const checks = await tickRoutines(today);
  const routines = await prisma.routine.findMany({ include: { schedule: true } });

  // --- Time spent on some ticked routines (with the project of the routine, if any) -----------------------------
  const timed = routines.filter((routine) => routine.estimate && routine.estimate >= 15 && !routine.parentId);
  for (const check of checks.filter((item) => timed.some((routine) => routine.id === item.routineId)).slice(0, 25)) {
    const routine = timed.find((item) => item.id === check.routineId)!;
    if (!faker.datatype.boolean(0.6)) continue;
    const minutes = Math.max(5, routine.estimate! + faker.number.int({ min: -5, max: 10 }));
    await createTimeEntry({ routineId: routine.id, projectId: routine.projectId, startedAt: new Date(check.doneAt.getTime() - minutes * 60_000), duration: minutes * 60 });
  }

  // --- Exceptions to the rules ---------------------------------------------------------------------------
  const next = async (id: string, after = 0) => {
    const routine = await prisma.routine.findUniqueOrThrow({ where: { id }, include: { schedule: true } });
    return occurrencesBetween(routine, addDays(today, 1), addDays(today, 30))[after] ?? null;
  };
  // Watering postponed to the next day.
  const watering = await next(plants.id);
  if (watering) await moveRoutineOccurrence(plants.id, watering, addDays(watering, 1));
  // The mail picked up later on one day, and the gym skipped once.
  const late = await next(mail.id, 1);
  if (late) await changeRoutineOccurrence(mail.id, late, 'THIS', late, 0, { fromTime: '14:00', dueTime: '15:00' });
  const gymRoutine = routines.find((routine) => routine.title === 'Sport');
  const skipped = gymRoutine ? await next(gymRoutine.id) : null;
  if (gymRoutine && skipped) await deleteRoutineOccurrence(gymRoutine.id, skipped, 'THIS');

  // An archived routine (with its history).
  await setRoutineArchived(watch.id, true);
}
