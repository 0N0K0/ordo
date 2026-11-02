import { Router } from 'express';
import { GraphQLError } from 'graphql';
import { getSession } from '../auth/session';
import { documentPdf } from '../services/accounting-pdf';

export const accountingRouter: Router = Router();

// PDF of a document: shown in place (preview), or downloaded with ?download=1.
accountingRouter.get('/documents/:id/pdf', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const pdf = await documentPdf(req.params.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`,
      'Cache-Control': 'private, no-store',
      // No "sandbox": browsers do not show PDFs in a sandboxed frame.
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(pdf.content);
  } catch (error) {
    if (error instanceof GraphQLError && error.extensions.code === 'NOT_FOUND') res.sendStatus(404);
    else {
      console.error('PDF impossible.', error);
      res.sendStatus(500);
    }
  }
});
