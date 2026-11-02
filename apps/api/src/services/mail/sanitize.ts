import DOMPurify from 'isomorphic-dompurify';

// Links of mails open in a new tab, outside the app.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Sanitizes the HTML of a mail or a signature: no script, form, frame or event handler; styles and images
 * are kept (the mail is shown in a sandboxed frame).
 * @param {string} html Raw HTML.
 * @returns {string} Safe HTML.
 */
export function sanitizeMailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: false,
    FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'iframe', 'frame', 'object', 'embed', 'base', 'meta', 'link'],
    ADD_ATTR: ['target'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|cid:|data:image\/|\/api\/)/i,
  });
}
