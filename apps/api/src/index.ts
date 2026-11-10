import express from 'express';
import { NoSchemaIntrospectionCustomRule } from 'graphql';
import { createYoga, type Plugin } from 'graphql-yoga';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { env, isProd } from './env';
import { createContext, type ServerContext } from './graphql/context';
import { writeSchemaFile } from './graphql/print-schema';
import { schema } from './graphql/schema';
import { accountingRouter } from './routes/accounting';
import { attachmentsRouter } from './routes/attachments';
import { exportsRouter } from './routes/exports';
import { libraryRouter } from './routes/library';
import { iconsRouter } from './routes/icons';
import { mailRouter } from './routes/mail';
import { treasuryRouter } from './routes/treasury';
import { scheduleConversationFollowUp } from './services/mail/linked';
import { scheduleMailSending } from './services/mail/scheduled';
import { scheduleGithubSync } from './services/github/sync';
import { scheduleRecurringInvoices } from './services/recurring-invoices';
import { workspaceMiddleware } from './services/workspaces';

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

/**
 * Serves the built web app (apps/web/dist) and falls back to its index.html for the client-side routes, so one Node
 * app hosts the whole site in production. Hashed assets are cached for good; the page and the service worker never.
 * @returns {void}
 */
function serveWeb(): void {
  const root = fileURLToPath(new URL('../../web/dist', import.meta.url));
  app.use(
    express.static(root, {
      index: false,
      setHeaders: (res, file) => {
        res.setHeader('Cache-Control', file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root });
  });
}

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

// GraphiQL loads its assets from a CDN: CSP only in production, where maps load their tiles from OpenStreetMap.
app.use(
  helmet({
    contentSecurityPolicy: isProd ? { directives: { 'img-src': ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org'] } } : false,
  }),
);
// Every request works in one workspace: its data only.
app.use(workspaceMiddleware);
app.use('/api/icons', iconsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/mail', mailRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/library', libraryRouter);
app.use('/api/treasury', treasuryRouter);
app.use(yoga.graphqlEndpoint, async (req, res) => {
  await yoga(req, res);
});

if (isProd) serveWeb();
else await writeSchemaFile();

// Mails replying to conversations linked to projects join them.
scheduleConversationFollowUp();
scheduleMailSending();
// Recurring invoices are issued on their dates.
scheduleRecurringInvoices();
scheduleGithubSync();

app.listen(env.PORT, () => {
  console.log(`API ready on http://localhost:${env.PORT}${yoga.graphqlEndpoint}`);
});
