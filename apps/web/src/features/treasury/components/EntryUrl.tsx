import { IconAction } from '../../../components/actions/IconAction';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';

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
    <IconAction label="Ouvrir le lien" item={label} hint={url} component="a" href={url} {...EXTERNAL_LINK} size="sm">
      <ArrowSquareOutIcon aria-hidden />
    </IconAction>
  );
}
