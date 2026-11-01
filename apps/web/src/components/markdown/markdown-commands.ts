/** Text and selection after an editing command. */
export interface EditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Wraps the selection (or a placeholder) with markers, e.g. **bold**. Unwraps when already wrapped.
 * @param {string} value Text.
 * @param {number} start Selection start.
 * @param {number} end Selection end.
 * @param {string} before Opening marker.
 * @param {string} after Closing marker.
 * @param {string} placeholder Text inserted when nothing is selected.
 * @returns {EditResult} New text and selection (around the wrapped text).
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): EditResult {
  if (value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after) {
    return {
      value: value.slice(0, start - before.length) + value.slice(start, end) + value.slice(end + after.length),
      selectionStart: start - before.length,
      selectionEnd: end - before.length,
    };
  }
  const selected = value.slice(start, end) || placeholder;
  return {
    value: value.slice(0, start) + before + selected + after + value.slice(end),
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

/**
 * Prefixes every line touched by the selection (lists, quote, heading). Removes the prefix when all lines have it.
 * @param {string} value Text.
 * @param {number} start Selection start.
 * @param {number} end Selection end.
 * @param {string | ((index: number) => string)} prefix Prefix, or a function for numbered lists.
 * @returns {EditResult} New text and selection (covering the edited lines).
 */
export function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string | ((index: number) => string),
): EditResult {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const prefixOf = (index: number) => (typeof prefix === 'string' ? prefix : prefix(index));
  const pattern = typeof prefix === 'string' ? null : /^\d+\. /;
  const allPrefixed = lines.every((line, index) => (pattern ? pattern.test(line) : line.startsWith(prefixOf(index))));

  const edited = lines
    .map((line, index) => {
      if (allPrefixed) return pattern ? line.replace(pattern, '') : line.slice(prefixOf(index).length);
      return prefixOf(index) + line;
    })
    .join('\n');
  return {
    value: value.slice(0, lineStart) + edited + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + edited.length,
  };
}

/**
 * Turns the selection into a link: [text](url), selecting "url" to type it.
 * @param {string} value Text.
 * @param {number} start Selection start.
 * @param {number} end Selection end.
 * @param {string} [url='url'] Known URL (e.g. pasted). Optional. Default = 'url'.
 * @returns {EditResult} New text and selection.
 */
export function insertLink(value: string, start: number, end: number, url = 'url'): EditResult {
  const text = value.slice(start, end) || 'texte';
  const inserted = `[${text}](${url})`;
  const urlStart = start + text.length + 3;
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    selectionStart: url === 'url' ? urlStart : start + inserted.length,
    selectionEnd: url === 'url' ? urlStart + url.length : start + inserted.length,
  };
}

/** Reference being typed at the caret ("#12", "@ali"). */
export interface ReferenceToken {
  trigger: '#' | '@';
  query: string;
  /** Index of the trigger character. */
  start: number;
}

/**
 * Finds the "#…" or "@…" token being typed just before the caret.
 * @param {string} value Text.
 * @param {number} caret Caret position.
 * @returns {ReferenceToken | null} Token, or null when the caret is not on a reference.
 */
export function referenceAt(value: string, caret: number): ReferenceToken | null {
  const match = /(^|[\s(])([#@])([\p{L}\p{N}_-]*)$/u.exec(value.slice(0, caret));
  if (!match) return null;
  return { trigger: match[2] as '#' | '@', query: match[3], start: caret - match[3].length - 1 };
}

/**
 * Replaces a reference token with the chosen reference followed by a space.
 * @param {string} value Text.
 * @param {ReferenceToken} token Token being typed.
 * @param {number} caret Caret position (end of the token).
 * @param {string} reference Reference to insert ("#12", "@alice").
 * @returns {EditResult} New text and caret.
 */
export function completeReference(value: string, token: ReferenceToken, caret: number, reference: string): EditResult {
  const inserted = `${reference} `;
  const position = token.start + inserted.length;
  return {
    value: value.slice(0, token.start) + inserted + value.slice(caret),
    selectionStart: position,
    selectionEnd: position,
  };
}

/**
 * Whether a pasted text is a single URL.
 * @param {string} text Pasted text.
 * @returns {boolean} True for an http(s) URL.
 */
export function isUrl(text: string): boolean {
  return /^https?:\/\/\S+$/.test(text.trim());
}
