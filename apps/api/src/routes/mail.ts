import { Router } from 'express';
import { clientError } from '../graphql/errors';
import { fileSecurityPolicy, INLINE_TYPES, isPdf } from '../services/core/attachments';
import { messageAttachment } from '../services/mail/reader';
import { downloadRoute, queryText, shownInPlace } from './http';

export const mailRouter: Router = Router();

// Attachment of a mail read from the server: images and PDFs are shown in place (?download=1: downloaded), other
// files downloaded. A missing attachment: 404; the server out of reach: 503; anything else logged.
mailRouter.get(
  '/:accountId/attachment',
  downloadRoute(async (req) => {
    const folder = queryText(req.query.folder);
    const uid = Number(req.query.uid);
    const index = Number(req.query.index);
    if (!folder || !Number.isInteger(uid) || !Number.isInteger(index)) throw clientError('BAD_USER_INPUT', 'Pièce jointe mal désignée.');
    const file = await messageAttachment(String(req.params.accountId), folder, uid, index);
    const image = INLINE_TYPES.includes(file.contentType);
    const pdf = isPdf(file.content);
    const inline = shownInPlace(req, image || pdf);
    return {
      content: file.content,
      type: image ? file.contentType : pdf ? 'application/pdf' : 'application/octet-stream',
      filename: file.filename,
      inline,
      cache: 'private, max-age=3600',
      securityPolicy: fileSecurityPolicy(inline && pdf),
    };
  }, 'Pièce jointe de mail impossible.'),
);
