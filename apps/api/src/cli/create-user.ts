import { input, password as passwordPrompt } from '@inquirer/prompts';
import { emailSchema, usernameSchema } from '@ordo/shared';
import { strongPasswordSchema } from '@ordo/shared/password-strength';
import type { z } from 'zod';
import { hashPassword } from '../auth/crypto';
import { prisma } from '../db';

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

if ((await prisma.user.count()) > 0) {
  console.error('Un compte existe déjà. Ordo ne gère qu’une seule utilisatrice.');
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

// The user gets a contributor profile ("Moi") so tasks can be assigned to them.
const baseHandle = username.replace(/[^a-z0-9_-]/g, '-');
const taken = await prisma.contributor.findUnique({ where: { handle: baseHandle } });
await prisma.user.create({
  data: {
    username,
    email,
    passwordHash: await hashPassword(password),
    contributor: { create: { name: username, handle: taken ? `${baseHandle}-moi` : baseHandle } },
  },
});
await prisma.$disconnect();
console.log(`Compte « ${username} » créé.`);
