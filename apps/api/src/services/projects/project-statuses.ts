import type { ProjectStatus } from '../../generated/prisma/client';
import { createLabelService } from '../core/labels';

/** Statuses of the projects; a project of a deleted status is left without one. */
export const projectStatuses = createLabelService<ProjectStatus>('projectStatus', { notFound: 'Statut', conflict: 'Un statut porte déjà ce libellé.' });
