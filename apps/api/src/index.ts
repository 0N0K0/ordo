import express from 'express';
import { NoSchemaIntrospectionCustomRule } from 'graphql';
import { createYoga, type Plugin } from 'graphql-yoga';
import helmet from 'helmet';
import { env, isProd } from './env';
import { createContext, type ServerContext } from './graphql/context';
import { writeSchemaFile } from './graphql/print-schema';
import { schema } from './graphql/schema';
import { accountingRouter } from './routes/accounting';
import { attachmentsRouter } from './routes/attachments';
import { exportsRouter } from './routes/exports';
import { iconsRouter } from './routes/icons';
import { mailRouter } from './routes/mail';
import { scheduleConversationFollowUp } from './services/mail/linked';
import { scheduleRecurringInvoices } from './services/recurring-invoices';

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

// Behind the Vite proxy in dev, and a reverse proxy in production: needed for req.ip.
app.set('trust proxy', 'loopback');

// GraphiQL loads its assets from a CDN: CSP only in production.
app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
app.use('/api/icons', iconsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/mail', mailRouter);
app.use('/api/exports', exportsRouter);
app.use(yoga.graphqlEndpoint, async (req, res) => {
  await yoga(req, res);
});

if (!isProd) await writeSchemaFile();

// Mails replying to conversations linked to projects join them.
scheduleConversationFollowUp();
// Recurring invoices are issued on their dates.
scheduleRecurringInvoices();

app.listen(env.PORT, () => {
  console.log(`API ready on http://localhost:${env.PORT}${yoga.graphqlEndpoint}`);
});
