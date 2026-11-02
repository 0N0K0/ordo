import { fakerFR as faker } from '@faker-js/faker';
import { Factory } from 'fishery';
import { prisma } from '../../src/db';
import type { Client, Contributor, Milestone, Prisma, Project, Task, TaskComment, TimeEntry } from '../../src/generated/prisma/client';

/** Shade 6 of the Mantine colors, as offered by the app's color pickers. */
export const COLORS = [
  '#228be6',
  '#15aabf',
  '#12b886',
  '#40c057',
  '#82c91e',
  '#fab005',
  '#fd7e14',
  '#fa5252',
  '#e64980',
  '#be4bdb',
  '#7950f2',
  '#4c6ef5',
];

const PROJECT_KINDS = ['Site vitrine', 'Boutique en ligne', 'Application mobile', 'Intranet', 'Refonte', 'Audit SEO', 'Identité visuelle', 'Plateforme de réservation'];
/** Titles of sub-projects (phases of their parent). */
export const PHASES = ['Maquettes', 'Développement', 'Recette', 'Contenus', 'Référencement', 'Hébergement', 'Formation', 'Maintenance'];
const MILESTONES = ['Maquettes validées', 'Version bêta', 'Recette', 'Mise en production', 'Lancement', 'Livraison finale'];
const TASK_VERBS = ['Ajouter', 'Corriger', 'Mettre à jour', 'Rédiger', 'Préparer', 'Intégrer', 'Tester', 'Optimiser', 'Configurer', 'Documenter', 'Revoir', 'Valider'];
const TASK_OBJECTS = [
  'la page d’accueil',
  'le formulaire de contact',
  'l’export PDF',
  'les maquettes mobiles',
  'le tunnel de paiement',
  'la recherche',
  'les notifications',
  'l’authentification',
  'le tableau de bord',
  'la fiche client',
  'les traductions',
  'la facturation',
  'la sauvegarde',
  'l’API partenaires',
  'la charte graphique',
  'le cahier de recette',
  'le menu de navigation',
  'les emails transactionnels',
];

/**
 * Calendar date (midnight UTC), as stored in @db.Date columns.
 * @param {Date} date Any date.
 * @returns {Date} Date at midnight UTC.
 */
export function day(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/**
 * Optional value: present with the given probability.
 * @param {number} probability Probability (0 to 1).
 * @param {() => T} value Value builder.
 * @returns {T | null} Value or null.
 */
export function maybe<T>(probability: number, value: () => T): T | null {
  return faker.datatype.boolean(probability) ? value() : null;
}

/**
 * A few markdown paragraphs, sometimes with a task list.
 * @returns {string} Markdown.
 */
function markdown(): string {
  const parts = [faker.lorem.paragraph()];
  if (faker.datatype.boolean(0.4)) {
    parts.push(
      faker.helpers
        .multiple(() => `- [${faker.datatype.boolean() ? 'x' : ' '}] ${faker.lorem.sentence({ min: 3, max: 7 })}`, { count: { min: 2, max: 4 } })
        .join('\n'),
    );
  }
  if (faker.datatype.boolean(0.3)) parts.push(faker.lorem.paragraph());
  return parts.join('\n\n');
}

export const clientFactory = Factory.define<Prisma.ClientUncheckedCreateInput, object, Client>(({ sequence, onCreate }) => {
  onCreate((data) => prisma.client.create({ data }));
  return {
    name: faker.company.name(),
    color: maybe(0.7, () => faker.helpers.arrayElement(COLORS)),
    position: sequence,
    favorite: faker.datatype.boolean(0.2),
  };
});

export const projectFactory = Factory.define<Prisma.ProjectUncheckedCreateInput, object, Project>(({ sequence, onCreate }) => {
  onCreate((data) => prisma.project.create({ data }));
  const start = faker.date.between({ from: faker.date.recent({ days: 120 }), to: faker.date.soon({ days: 30 }) });
  return {
    title: `${faker.helpers.arrayElement(PROJECT_KINDS)} ${faker.location.city()}`,
    description: maybe(0.6, () => faker.lorem.paragraph()),
    color: maybe(0.5, () => faker.helpers.arrayElement(COLORS)),
    startDate: maybe(0.7, () => day(start)),
    endDate: maybe(0.6, () => day(faker.date.soon({ days: 180, refDate: start }))),
    position: sequence,
    favorite: faker.datatype.boolean(0.15),
  };
});

export const contributorFactory = Factory.define<Prisma.ContributorUncheckedCreateInput, object, Contributor>(
  ({ sequence, onCreate }) => {
    onCreate((data) => prisma.contributor.create({ data }));
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      name: `${firstName} ${lastName}`,
      // Sequence suffix: handles are unique.
      handle: `${faker.helpers.slugify(firstName).toLowerCase()}-${sequence}`,
    };
  },
);

export const milestoneFactory = Factory.define<Prisma.MilestoneUncheckedCreateInput, object, Milestone>(
  ({ sequence, onCreate }) => {
    onCreate((data) => prisma.milestone.create({ data }));
    return {
      projectId: '',
      title: faker.helpers.arrayElement(MILESTONES),
      description: maybe(0.5, () => faker.lorem.sentence()),
      dueDate: maybe(0.8, () => day(faker.date.soon({ days: 90 }))),
      position: sequence,
    };
  },
);

export const taskFactory = Factory.define<Prisma.TaskUncheckedCreateInput, object, Task>(({ sequence, onCreate }) => {
  onCreate((data) => prisma.task.create({ data }));
  const start = maybe(0.6, () => faker.date.between({ from: faker.date.recent({ days: 30 }), to: faker.date.soon({ days: 30 }) }));
  return {
    projectId: '',
    title: `${faker.helpers.arrayElement(TASK_VERBS)} ${faker.helpers.arrayElement(TASK_OBJECTS)}`,
    description: maybe(0.6, markdown),
    effort: maybe(0.7, () => faker.helpers.arrayElement([0.5, 1, 2, 3, 5, 8, 13])),
    startDate: start && day(start),
    endDate: start ? maybe(0.8, () => day(faker.date.soon({ days: 20, refDate: start }))) : maybe(0.3, () => day(faker.date.soon({ days: 30 }))),
    position: sequence,
  };
});

export const commentFactory = Factory.define<Prisma.TaskCommentUncheckedCreateInput, object, TaskComment>(({ onCreate }) => {
  onCreate((data) => prisma.taskComment.create({ data }));
  return { taskId: '', body: faker.lorem.sentences({ min: 1, max: 3 }), createdAt: faker.date.recent({ days: 20 }) };
});

const WORK_LOG = [
  'Réunion de suivi avec le client',
  'Développement de la fonctionnalité',
  'Corrections suite à la recette',
  'Intégration des maquettes',
  'Rédaction de la documentation',
  'Revue de code et mise en production',
  'Analyse du besoin',
  'Échanges par email et préparation du devis',
];
const WORK_DETAILS = [
  'Points ouverts notés pour la prochaine réunion.',
  'Reste à valider avec le client.',
  'Tests manuels sur mobile et ordinateur.',
  'Quelques ajustements de dernière minute.',
  'Bloqué un moment par un accès manquant.',
];

/**
 * Finished time entry on a working day of the last six weeks, between 8:00 and 18:00 (local time),
 * from 15 minutes to 3 h 30. Entries tracked with the timer sometimes include pauses.
 */
export const timeEntryFactory = Factory.define<Prisma.TimeEntryUncheckedCreateInput, object, TimeEntry>(({ onCreate }) => {
  onCreate((data) => prisma.timeEntry.create({ data }));
  let day = faker.date.recent({ days: 42 });
  // Working days only.
  while (day.getDay() === 0 || day.getDay() === 6) day = new Date(day.getTime() - 86_400_000);
  const startedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), faker.number.int({ min: 8, max: 16 }), faker.helpers.arrayElement([0, 15, 30, 45]));
  const duration = faker.number.int({ min: 1, max: 14 }) * 15 * 60;
  const pausedSeconds = faker.datatype.boolean(0.25) ? faker.number.int({ min: 2, max: 30 }) * 60 : 0;
  const lines = [faker.helpers.arrayElement(WORK_LOG)];
  if (faker.datatype.boolean(0.4)) lines.push(faker.helpers.arrayElement(WORK_DETAILS));
  return {
    projectId: '',
    description: maybe(0.85, () => lines.join('\n')),
    startedAt,
    endedAt: new Date(startedAt.getTime() + (duration + pausedSeconds) * 1000),
    pausedSeconds,
    duration,
  };
});
