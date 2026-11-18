import { Stack } from '@mantine/core';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { BackLink } from '../page/BackLink';
import { PageMessage } from './PageMessage';

interface DetailNotFoundProps {
  /** What is missing, as the subject of the sentence (« Cette fiche », « Ce projet »). */
  what: string;
  /** Agreement with a feminine noun (« supprimée »). Optional. */
  feminine?: boolean;
  /** Address of its list, linked above the message (« ← Fiches »). Optional: without it, only the way home. */
  backTo?: string;
  /** Name of its list. Optional (with `backTo`). */
  backLabel?: string;
}

/**
 * Detail page whose item does not exist (deleted, wrong address), the same everywhere: the link back to its list above,
 * as on the detail page, then the « Introuvable » page message and its way home.
 * @param {DetailNotFoundProps} props Component props.
 * @returns {JSX.Element} Page.
 */
export function DetailNotFound({ what, feminine = false, backTo, backLabel }: DetailNotFoundProps) {
  return (
    <Stack gap="lg">
      {backTo && <BackLink to={backTo}>{backLabel}</BackLink>}
      <PageMessage icon={<MagnifyingGlassIcon size="55%" aria-hidden />} title="Introuvable" message={`${what} n’existe pas ou a été supprimé${feminine ? 'e' : ''}.`} />
    </Stack>
  );
}
