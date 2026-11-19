import express from 'express';
import { createFetch } from '@whatwg-node/fetch';
import compression from 'compression';
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
import { sessionRequired } from './routes/http';
import { treasuryRouter } from './routes/treasury';
import { CSP_DIRECTIVES } from './security-headers';
import { scheduleConversationFollowUp } from './services/mail/linked';
import { scheduleMailSending } from './services/mail/scheduled';
import { scheduleGithubSync } from './services/github/sync';
import { scheduleRecurringInvoices } from './services/accounting/recurring-invoices';
import { workspaceMiddleware } from './services/workspaces/workspaces';

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
  // A missing built file is a 404, never the page: the browser must not take it for the file.
  app.get(/^\/(?!api\/|assets\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile('index.html', { root });
  });
}

/** Heaviest file an upload may carry (the documents of the library: 25 MB); each service then applies its own limit. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Most files one upload may carry. */
const MAX_UPLOAD_FILES = 50;

const yoga = createYoga<ServerContext>({
  // An upload over the limits is refused while it is read, not once in memory.
  fetchAPI: createFetch({ formDataLimits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES } }),
  schema,
  graphqlEndpoint: '/api/graphql',
  graphiql: !isProd,
  landingPage: !isProd,
  // The web app and the API share one origin: no other site may read the answers.
  cors: false,
  // Whatever the host says of NODE_ENV: the detail of an unexpected error only goes to the client in development.
  maskedErrors: { isDev: !isProd },
  context: createContext,
  plugins: isProd ? [disableIntrospection] : [],
});

const app = express();
// Express reads NODE_ENV itself (stack traces in its error pages): the mode of the app decides instead.
app.set('env', env.NODE_ENV);

// Behind the Vite proxy in dev, and a reverse proxy in production: needed for req.ip.
app.set('trust proxy', 'loopback');

// GraphiQL loads its assets from a CDN: CSP only in production.
app.use(helmet({ contentSecurityPolicy: isProd ? { directives: CSP_DIRECTIVES } : false }));
// The host compresses the files it serves, not the answers of the API: lists shrink several times (PDFs, ZIPs and images
// are left as they are).
app.use(compression());
// Every request works in one workspace: its data only.
app.use(workspaceMiddleware);
app.use('/api/icons', iconsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/mail', mailRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/library', libraryRouter);
app.use('/api/treasury', treasuryRouter);
// Files are sent by signed-in users only: an anonymous upload is refused before its body is read.
app.use(yoga.graphqlEndpoint, (req, res, next) => {
  if (req.is('multipart/form-data')) void sessionRequired(req, res, next);
  else next();
});
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
  console.log(`API ready (${env.NODE_ENV}) on http://localhost:${env.PORT}${yoga.graphqlEndpoint}`);
});
