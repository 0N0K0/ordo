import { Alert, Anchor, Text } from '@mantine/core';
import { ImageIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import classes from './MailBody.module.css';

/**
 * Document shown in the frame: the sanitized mail, with a policy blocking scripts and, unless allowed,
 * remote images (tracking pixels).
 * @param {string} html Sanitized HTML.
 * @param {boolean} remoteImages Whether remote images load.
 * @returns {string} Document.
 */
function frameDocument(html: string, remoteImages: boolean): string {
  const images = remoteImages ? "img-src * data:" : "img-src 'self' data:";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src * data:; ${images}">
<base target="_blank">
<style>body{margin:0;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1f2328;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin:0 0 0 .5em;padding-left:.75em;border-left:3px solid #d0d7de;color:#57606a}</style>
</head><body>${html}</body></html>`;
}

/**
 * Body of a mail: HTML in a sandboxed frame sized to its content (no script can run), or plain text.
 * Remote images are blocked until the user allows them.
 * @param {{ html: string | null, text: string | null }} props Component props.
 * @returns {JSX.Element} Body.
 */
export function MailBody({ html, text }: { html: string | null; text: string | null }) {
  const [remoteImages, setRemoteImages] = useState(false);
  const [height, setHeight] = useState(200);
  if (!html) {
    return (
      <Text size="sm" className={classes.text}>
        {text?.trim() || 'Ce mail est vide.'}
      </Text>
    );
  }
  const hasRemoteImages = /<img[^>]+src="https?:/i.test(html);
  return (
    <>
      {hasRemoteImages && !remoteImages && (
        <Alert color="gray" icon={<ImageIcon aria-hidden />} py={6}>
          <Text size="xs">
            Images distantes bloquées (elles peuvent signaler l’ouverture du mail).{' '}
            <Anchor component="button" type="button" size="xs" onClick={() => setRemoteImages(true)}>
              Afficher les images
            </Anchor>
          </Text>
        </Alert>
      )}
      <iframe
        key={String(remoteImages)}
        title="Contenu du mail"
        className={classes.frame}
        // Same origin to measure the content; without "allow-scripts", nothing runs in it.
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={frameDocument(html, remoteImages)}
        style={{ height }}
        onLoad={(event) => {
          const document = event.currentTarget.contentDocument;
          if (document) setHeight(Math.max(120, document.documentElement.scrollHeight + 8));
        }}
      />
    </>
  );
}
