import type { ProjectCategory } from '../../generated/prisma/client';
import { createLabelService } from '../core/labels';

/** Categories of the projects; projects simply lose a deleted one. */
export const projectCategories = createLabelService<ProjectCategory>('projectCategory', { notFound: 'Catégorie', conflict: 'Une catégorie porte déjà ce nom.' });
