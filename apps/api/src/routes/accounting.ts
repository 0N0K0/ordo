import { Router } from 'express';
import { GraphQLError } from 'graphql';
import { getSession } from '../auth/session';
import { documentPdf } from '../services/accounting-pdf';
import { documentsZip } from '../services/accounting-zip';

export const accountingRouter: Router = Router();

// ZIP of the documents issued over a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD&types=INVOICE,CREDIT_NOTE&imported=1.
accountingRouter.get('/documents/zip', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const zip = await documentsZip({ from: text(req.query.from), to: text(req.query.to), types: text(req.query.types).split(','), imported: req.query.imported === '1' });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zip.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(zip.content);
  } catch (error) {
    if (error instanceof GraphQLError) res.status(400).type('text/plain').send(error.message);
    else {
      console.error('Archive impossible.', error);
      res.sendStatus(500);
    }
  }
});

// PDF of a document: shown in place (preview), or downloaded with ?download=1; ?paid=1 prints a fully paid
// invoice receipted.
accountingRouter.get('/documents/:id/pdf', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const pdf = await documentPdf(req.params.id, { paid: Boolean(req.query.paid) });
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
    else if (error instanceof GraphQLError && error.extensions.code === 'BAD_USER_INPUT') res.status(409).type('text/plain').send(error.message);
    else {
      console.error('PDF impossible.', error);
      res.sendStatus(500);
    }
  }
});
