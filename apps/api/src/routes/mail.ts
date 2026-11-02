import { Router } from 'express';
import { getSession } from '../auth/session';
import { messageAttachment } from '../services/mail/reader';

export const mailRouter: Router = Router();

// Attachment of a mail read from the server: images are shown in place, other files downloaded.
mailRouter.get('/:accountId/attachment', async (req, res) => {
  if (!(await getSession(req, res))) {
    res.sendStatus(401);
    return;
  }
  const folder = String(req.query.folder ?? '');
  const uid = Number(req.query.uid);
  const index = Number(req.query.index);
  if (!folder || !Number.isInteger(uid) || !Number.isInteger(index)) {
    res.sendStatus(400);
    return;
  }
  try {
    const file = await messageAttachment(req.params.accountId, folder, uid, index);
    const image = /^image\/(png|jpeg|gif|webp)$/.test(file.contentType);
    res.set({
      'Content-Type': image ? file.contentType : 'application/octet-stream',
      'Content-Disposition': `${image ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Cache-Control': 'private, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(file.content);
  } catch {
    res.sendStatus(404);
  }
});
