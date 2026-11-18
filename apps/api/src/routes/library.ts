import { Router } from 'express';
import { GraphQLError } from 'graphql';
import { prisma } from '../db';
import { libraryZip } from '../services/library/library';
import { queryText, requireSession, sendDownload } from './http';

export const libraryRouter: Router = Router();

// ZIP of a folder (?folderId=), of the whole library (no parameter), or of chosen documents (?ids=a,b).
libraryRouter.get('/zip', async (req, res) => {
  if (!(await requireSession(req, res))) return;
  try {
    const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean) : undefined;
    const folderId = queryText(req.query.folderId) || null;
    const zip = await libraryZip(ids ? { ids } : { folderId });
    sendDownload(res, zip.content, { type: 'application/zip', filename: zip.name });
  } catch (error) {
    if (error instanceof GraphQLError) res.status(error.extensions.code === 'NOT_FOUND' ? 404 : 400).json({ error: error.message });
    else {
      console.error('Archive impossible.', error);
      res.sendStatus(500);
    }
  }
});

// PDF of a document shown in place (preview); other files are downloaded through /api/attachments.
libraryRouter.get('/:id/view', async (req, res) => {
  if (!(await requireSession(req, res))) return;
  const document = await prisma.libraryDocument.findUnique({ where: { id: req.params.id }, include: { attachment: true } });
  if (!document?.attachment || document.attachment.mimeType !== 'application/pdf') {
    res.sendStatus(404);
    return;
  }
  // No "sandbox": browsers do not show PDFs in a sandboxed frame.
  sendDownload(res, Buffer.from(document.attachment.data), {
    type: 'application/pdf',
    filename: document.attachment.name,
    inline: true,
    securityPolicy: "default-src 'none'; frame-ancestors 'self'",
  });
});
