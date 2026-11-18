import { IconAction } from '../../../components/actions/IconAction';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';

/**
 * Opens the page of an entry on the internet (an online order…) in a new tab.
 * @param {{ url: string | null | undefined, label: string }} props Component props.
 * @param {string | null | undefined} props.url Page of the entry.
 * @param {string} props.label Label of the entry, for the accessible name.
 * @returns {JSX.Element | null} Link, none without a page.
 */
export function EntryUrl({ url, label }: { url: string | null | undefined; label: string }) {
  if (!url) return null;
  return (
    <IconAction label={url} component="a" href={url} target="_blank" rel="noopener noreferrer" size="sm" aria-label={`Ouvrir le lien de ${label}`}>
      <ArrowSquareOutIcon aria-hidden />
    </IconAction>
  );
}
