import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import express from 'express';
import {
  lexicographicSortSchema,
  NoSchemaIntrospectionCustomRule,
  printSchema,
} from 'graphql';
import { createYoga, type Plugin } from 'graphql-yoga';
import helmet from 'helmet';
import { createContext, type ServerContext } from './graphql/context';
import { schema } from './graphql/schema';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);

const disableIntrospection: Plugin = {
  /**
   * Rejects introspection queries.
   * @param {object} payload Envelop validate payload.
   * @returns {void}
   */
  onValidate({ addValidationRule }) {
    addValidationRule(NoSchemaIntrospectionCustomRule);
  },
};

const yoga = createYoga<ServerContext>({
  schema,
  graphqlEndpoint: '/api/graphql',
  graphiql: !isProd,
  context: createContext,
  plugins: isProd ? [disableIntrospection] : [],
});

const app = express();

// GraphiQL loads its assets from a CDN: CSP only in production.
app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
app.use(yoga.graphqlEndpoint, async (req, res) => {
  await yoga(req, res);
});

// SDL snapshot used by the front codegen.
if (!isProd) {
  await writeFile(
    new URL('../schema.graphql', import.meta.url),
    printSchema(lexicographicSortSchema(schema)),
  );
}

app.listen(port, () => {
  console.log(`API ready on http://localhost:${port}${yoga.graphqlEndpoint}`);
});
