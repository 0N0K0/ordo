import { Router } from 'express';
import { GraphQLError } from 'graphql';
import { treasuryStatementPdf } from '../services/treasury/treasury-pdf';
import { queryText, requireSession, sendDownload } from './http';

export const treasuryRouter: Router = Router();

// PDF statement of the actual entries of a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=… (all accounts without it).
treasuryRouter.get('/statement.pdf', async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const pdf = await treasuryStatementPdf({ from: queryText(req.query.from), to: queryText(req.query.to), accountId: queryText(req.query.accountId) || null });
    sendDownload(res, pdf.content, { type: 'application/pdf', filename: pdf.name });
  } catch (error) {
    if (error instanceof GraphQLError) res.status(400).type('text/plain').send(error.message);
    else {
      console.error('Relevé impossible.', error);
      res.sendStatus(500);
    }
  }
});
