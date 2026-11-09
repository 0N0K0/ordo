import { Router } from 'express';
import { getSession } from '../auth/session';
import { fileSecurityPolicy, isPdf } from '../services/attachments';
import { messageAttachment } from '../services/mail/reader';

export const mailRouter: Router = Router();

// Attachment of a mail read from the server: images and PDFs are shown in place (?download=1: downloaded), other
// files downloaded.
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
    const pdf = isPdf(file.content);
    const inline = (image || pdf) && !req.query.download;
    res.set({
      'Content-Type': image ? file.contentType : pdf ? 'application/pdf' : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Cache-Control': 'private, max-age=3600',
      'Content-Security-Policy': fileSecurityPolicy(inline && pdf),
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(file.content);
  } catch {
    res.sendStatus(404);
  }
});
