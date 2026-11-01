import 'dotenv/config';
import argon2 from 'argon2';
import { prisma } from '../src/db';

const email = process.env.ADMIN_EMAIL!;
const passwordHash = await argon2.hash(process.env.ADMIN_PASSWORD!);

await prisma.user.upsert({
  where: { email },
  update: { passwordHash },
  create: { email, passwordHash },
});
await prisma.$disconnect();
