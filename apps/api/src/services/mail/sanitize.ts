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
 * are kept (the mail is shown in a sandboxed frame). Addresses of the app (« /api/… ») are only kept in what the user
 * writes (a mail to send, a signature): a mail received must not make the browser call the API.
 * @param {string} html Raw HTML.
 * @param {boolean} [written] Written by the user in the app. Optional. Default = false (a mail received).
 * @returns {string} Safe HTML.
 */
export function sanitizeMailHtml(html: string, written = false): string {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: false,
    FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'iframe', 'frame', 'object', 'embed', 'base', 'meta', 'link'],
    ADD_ATTR: ['target'],
    ALLOWED_URI_REGEXP: written ? /^(?:https?:|mailto:|tel:|cid:|data:image\/|\/api\/)/i : /^(?:https?:|mailto:|tel:|cid:|data:image\/)/i,
  });
}
