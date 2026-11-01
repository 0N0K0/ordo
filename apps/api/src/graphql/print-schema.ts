import { writeFile } from 'node:fs/promises';
import { lexicographicSortSchema, printSchema } from 'graphql';
import { schema } from './schema';

/**
 * Writes the SDL snapshot used by the front codegen to apps/api/schema.graphql.
 * @returns {Promise<void>}
 */
export async function writeSchemaFile(): Promise<void> {
  await writeFile(new URL('../../schema.graphql', import.meta.url), printSchema(lexicographicSortSchema(schema)));
}
