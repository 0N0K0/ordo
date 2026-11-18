import { Router } from 'express';
import { fileSecurityPolicy, isPdf } from '../services/core/attachments';
import { messageAttachment } from '../services/mail/reader';
import { queryFlag, requireSession, sendDownload, sendServiceError } from './http';

export const mailRouter: Router = Router();

// Attachment of a mail read from the server: images and PDFs are shown in place (?download=1: downloaded), other
// files downloaded.
mailRouter.get('/:accountId/attachment', async (req, res) => {
  if (!(await requireSession(req, res))) return;
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
    const inline = (image || pdf) && !queryFlag(req.query.download);
    sendDownload(res, file.content, {
      type: image ? file.contentType : pdf ? 'application/pdf' : 'application/octet-stream',
      filename: file.filename,
      inline,
      cache: 'private, max-age=3600',
      securityPolicy: fileSecurityPolicy(inline && pdf),
    });
  } catch (error) {
    // A missing attachment: 404; the server out of reach: 503; anything else logged.
    sendServiceError(res, error, 'Pièce jointe de mail');
  }
});
