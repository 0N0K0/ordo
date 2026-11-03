import { Router } from 'express';
import { GraphQLError } from 'graphql';
import { getSession } from '../auth/session';
import { prisma } from '../db';
import { libraryZip } from '../services/library';

export const libraryRouter: Router = Router();

// ZIP of a folder (?folderId=), of the whole library (no parameter), or of chosen documents (?ids=a,b).
libraryRouter.get('/zip', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  try {
    const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean) : undefined;
    const folderId = typeof req.query.folderId === 'string' && req.query.folderId ? req.query.folderId : null;
    const zip = await libraryZip(ids ? { ids } : { folderId });
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zip.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(zip.content);
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
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  const document = await prisma.libraryDocument.findUnique({ where: { id: req.params.id }, include: { attachment: true } });
  if (!document?.attachment || document.attachment.mimeType !== 'application/pdf') {
    res.sendStatus(404);
    return;
  }
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(document.attachment.name)}`,
    'Cache-Control': 'private, no-store',
    // No "sandbox": browsers do not show PDFs in a sandboxed frame.
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(Buffer.from(document.attachment.data));
});
