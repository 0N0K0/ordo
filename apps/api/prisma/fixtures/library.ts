import { prisma } from '../../src/db';
import type { Project } from '../../src/generated/prisma/client';
import { addFiles, addLink, createFolder } from '../../src/services/library';
import { addProjectFiles, addProjectLink } from '../../src/services/project-resources';
import { tinyPdf } from './mail';

/**
 * File of the fixtures.
 * @param {string} name File name.
 * @param {string} content Content.
 * @param {string} type Media type.
 * @returns {File} File.
 */
const file = (name: string, content: string, type: string) => new File([content], name, { type });

/**
 * PDF of the fixtures, with one line of text.
 * @param {string} name File name.
 * @param {string} text Text (ASCII).
 * @returns {File} File.
 */
const pdf = (name: string, text: string) => file(name, tinyPdf(text), 'application/pdf');

/**
 * Library and documents of the projects: folders (with sub-folders), files and links in them and at the root, one
 * document supporting a movement of the treasury; links (mock-ups, repository, specifications) and files of the
 * active root projects. After the team (the movement it supports).
 * @param {object} input Data of the other fixtures.
 * @param {Project[]} input.projects Projects.
 * @returns {Promise<void>}
 */
export async function seedLibrary({ projects }: { projects: Project[] }): Promise<void> {
  // --- Library ----------------------------------------------------------------------------------------
  const admin = await createFolder('Administratif', null);
  const insurance = await createFolder('Assurances', admin.id);
  const contracts = await createFolder('Contrats', admin.id);
  const invoices = await createFolder('Factures fournisseurs', admin.id);
  const templates = await createFolder('Modèles', null);
  await createFolder('Archives', null);

  await addFiles(insurance.id, [pdf('Attestation RC Pro 2026.pdf', 'Attestation RC Pro 2026'), pdf('Contrat multirisque bureau.pdf', 'Contrat multirisque')]);
  await addLink(insurance.id, { title: 'Espace client de l’assureur', url: 'https://www.example.com/assurance', note: 'Identifiant dans le gestionnaire de mots de passe.' });
  await addFiles(contracts.id, [
    pdf('Bail commercial.pdf', 'Bail commercial'),
    file('Conditions générales de vente.md', '# Conditions générales de vente\n\n1. Objet\n2. Prix\n3. Paiement\n', 'text/markdown'),
  ]);
  const [receipt] = await addFiles(invoices.id, [pdf('Facture clavier et souris.pdf', 'Facture clavier et souris')]);
  await addFiles(templates.id, [file('Modèle de compte rendu.md', '# Compte rendu\n\n## Participants\n\n## Décisions\n\n## Actions\n', 'text/markdown')]);
  await addLink(templates.id, { title: 'Charte graphique', url: 'https://www.example.com/charte', note: null });
  await addLink(null, { title: 'Drive partagé', url: 'https://drive.example.com/atelier', note: 'Dossier partagé avec l’équipe.' });
  await addFiles(null, [file('Numéros utiles.txt', 'Accueil : 04 78 00 00 00\nInformatique : 04 78 00 00 01\n', 'text/plain')]);

  // The receipt supports the purchase of the team fixtures.
  const purchase = await prisma.treasuryEntry.findFirst({ where: { label: 'Clavier et souris' }, select: { id: true } });
  if (purchase && receipt) await prisma.treasuryEntry.update({ where: { id: purchase.id }, data: { libraryDocuments: { connect: { id: receipt.id } } } });

  // --- Documents of the projects ------------------------------------------------------------------------
  const roots = projects.filter((project) => project.parentId === null && !project.archivedAt);
  for (const [index, project] of roots.slice(0, 4).entries()) {
    const slug = project.title
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    await addProjectLink(project.id, { title: 'Maquettes', url: `https://www.figma.com/file/${slug}`, note: index === 0 ? 'Version validée par le client le mois dernier.' : null });
    await addProjectLink(project.id, { title: 'Dépôt de code', url: `https://github.com/atelier-demo/${slug}`, note: null });
    if (index % 2 === 0) await addProjectLink(project.id, { title: 'Recette', url: `https://recette.example.com/${slug}`, note: 'Accès : demo / demo' });
    await addProjectFiles(project.id, [
      pdf('Cahier des charges.pdf', 'Cahier des charges'),
      file('Notes de lancement.md', `# ${project.title}\n\n- Objectifs\n- Planning\n- Contacts\n`, 'text/markdown'),
    ]);
  }
}
