import { Router } from 'express';
import { treasuryStatementPdf } from '../services/treasury/treasury-pdf';
import { downloadRoute, queryText } from './http';

export const treasuryRouter: Router = Router();

// PDF statement of the actual entries of a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=… (all accounts without it).
treasuryRouter.get(
  '/statement.pdf',
  downloadRoute(async (req) => {
    const pdf = await treasuryStatementPdf({ from: queryText(req.query.from), to: queryText(req.query.to), accountId: queryText(req.query.accountId) || null });
    return { ...pdf, type: 'application/pdf' };
  }, 'Relevé impossible.'),
);
