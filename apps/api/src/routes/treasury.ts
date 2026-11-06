import { Router } from 'express';
import { GraphQLError } from 'graphql';
import { getSession } from '../auth/session';
import { treasuryStatementPdf } from '../services/treasury-pdf';

export const treasuryRouter: Router = Router();

// PDF statement of the actual entries of a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=… (all accounts without it).
treasuryRouter.get('/statement.pdf', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const pdf = await treasuryStatementPdf({ from: text(req.query.from), to: text(req.query.to), accountId: text(req.query.accountId) || null });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(pdf.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(pdf.content);
  } catch (error) {
    if (error instanceof GraphQLError) res.status(400).type('text/plain').send(error.message);
    else {
      console.error('Relevé impossible.', error);
      res.sendStatus(500);
    }
  }
});
