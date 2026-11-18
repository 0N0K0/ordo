import { graphql } from '../../graphql';
import { execute } from '../../lib/graphql-client';

const UploadAttachmentDocument = graphql(`
  mutation UploadAttachment($file: File!) {
    uploadAttachment(file: $file) {
      id
      filename
      url
      isImage
    }
  }
`);

/**
 * Uploads a file to link from a markdown text.
 * @param {File} file File.
 * @returns {Promise<{ id: string, name: string, url: string, isImage: boolean }>} Stored attachment.
 */
export async function uploadAttachment(file: File) {
  return (await execute(UploadAttachmentDocument, { file })).uploadAttachment;
}

/**
 * Markdown of an attachment: an image shown in place, or a download link.
 * @param {{ filename: string, url: string, isImage: boolean }} attachment Attachment.
 * @returns {string} Markdown.
 */
export function attachmentMarkdown(attachment: { filename: string; url: string; isImage: boolean }): string {
  const label = attachment.filename.replace(/([[\]\\])/g, '\\$1');
  return `${attachment.isImage ? '!' : ''}[${label}](${attachment.url})`;
}
