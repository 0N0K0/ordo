import { prisma } from '../db';
import { writeSchemaFile } from '../graphql/print-schema';

await writeSchemaFile();
await prisma.$disconnect();
console.log('schema.graphql written.');
