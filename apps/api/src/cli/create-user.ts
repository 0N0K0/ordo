import { input, password as passwordPrompt } from '@inquirer/prompts';
import { emailSchema, usernameSchema } from '@ordo/shared';
import { strongPasswordSchema } from '@ordo/shared/password-strength';
import type { z } from 'zod';
import { hashPassword } from '../auth/crypto';
import { prisma } from '../db';
import { createWorkspace, setUpWorkspace } from '../services/workspaces';

/**
 * Turns a zod schema into an inquirer validator.
 * @param {z.ZodType} schema Schema to check the answer against.
 * @returns {(value: string) => true | string} Validator returning true or the first error message.
 */
function validateWith(schema: z.ZodType): (value: string) => true | string {
  return (value) => {
    const result = schema.safeParse(value);
    return result.success || (result.error.issues[0]?.message ?? 'Valeur invalide.');
  };
}

// The command line only creates the admin, once: she creates the other accounts from the app.
if (await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } })) {
  console.error('Le compte administrateur existe déjà : les autres comptes se créent depuis Ordo (Paramètres › Comptes).');
  process.exit(1);
}

const username = usernameSchema.parse(await input({ message: 'Identifiant :', validate: validateWith(usernameSchema) }));
const email = emailSchema.parse(await input({ message: 'Adresse email :', validate: validateWith(emailSchema) }));
const password = await passwordPrompt({
  message: 'Mot de passe :',
  mask: true,
  validate: validateWith(strongPasswordSchema([username, email])),
});
await passwordPrompt({
  message: 'Confirmation :',
  mask: true,
  validate: (value) => value === password || 'Les mots de passe ne correspondent pas.',
});

const user = await prisma.user.create({ data: { username, email, role: 'ADMIN', passwordHash: await hashPassword(password) } });
// The workspaces nobody owns yet (those of a new install) become hers, with her contributor profile ("Moi").
await prisma.workspace.updateMany({ where: { ownerId: null }, data: { ownerId: user.id } });
const workspaces = await prisma.workspace.findMany({ where: { ownerId: user.id } });
for (const workspace of workspaces) await setUpWorkspace(workspace);
if (!workspaces.length) await createWorkspace({ name: 'Pro', kind: 'PRO' }, user.id);
await prisma.$disconnect();
console.log(`Compte administrateur « ${username} » créé.`);
