import { Router } from 'express';
import { documentPdf } from '../services/accounting/accounting-pdf';
import { documentsZip } from '../services/accounting/accounting-zip';
import { queryText, requireSession, sendDownload, sendServiceError } from './http';

export const accountingRouter: Router = Router();

// ZIP of the documents issued over a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD&types=INVOICE,CREDIT_NOTE&imported=1.
accountingRouter.get('/documents/zip', async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const zip = await documentsZip({ from: queryText(req.query.from), to: queryText(req.query.to), types: queryText(req.query.types).split(','), imported: req.query.imported === '1' });
    sendDownload(res, zip.content, { type: 'application/zip', filename: zip.name });
  } catch (error) {
    sendServiceError(res, error, 'Archive impossible.');
  }
});

// PDF of a document: shown in place (preview), or downloaded with ?download=1; ?paid=1 prints a fully paid
// invoice receipted.
accountingRouter.get('/documents/:id/pdf', async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const pdf = await documentPdf(req.params.id, { paid: Boolean(req.query.paid) });
    // No "sandbox": browsers do not show PDFs in a sandboxed frame.
    sendDownload(res, pdf.content, { type: 'application/pdf', filename: pdf.filename, inline: !req.query.download, securityPolicy: "default-src 'none'; frame-ancestors 'self'" });
  } catch (error) {
    sendServiceError(res, error, 'PDF impossible.');
  }
});
