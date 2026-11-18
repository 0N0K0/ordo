import { Router } from 'express';
import { documentPdf } from '../services/accounting/accounting-pdf';
import { documentsZip } from '../services/accounting/accounting-zip';
import { fileSecurityPolicy } from '../services/core/attachments';
import { downloadRoute, queryFlag, queryText, shownInPlace } from './http';

export const accountingRouter: Router = Router();

// ZIP of the documents issued over a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD&types=INVOICE,CREDIT_NOTE&imported=1.
accountingRouter.get(
  '/documents/zip',
  downloadRoute(async (req) => {
    const zip = await documentsZip({ from: queryText(req.query.from), to: queryText(req.query.to), types: queryText(req.query.types).split(','), imported: queryFlag(req.query.imported) });
    return { content: zip.content, type: 'application/zip', filename: zip.filename };
  }, 'Archive impossible.'),
);

// PDF of a document: shown in place (preview), or downloaded with ?download=1; ?paid=1 prints a fully paid
// invoice receipted.
accountingRouter.get(
  '/documents/:id/pdf',
  downloadRoute(async (req) => {
    const pdf = await documentPdf(String(req.params.id), { paid: queryFlag(req.query.paid) });
    const inline = shownInPlace(req, true);
    return { content: pdf.content, type: 'application/pdf', filename: pdf.filename, inline, securityPolicy: fileSecurityPolicy(inline) };
  }, 'PDF impossible.'),
);
