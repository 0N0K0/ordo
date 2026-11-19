import { Badge, Select, Tooltip, type BadgeProps, type SelectProps } from '@mantine/core';
import { LinkIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { useLinkCandidates } from '../hooks/use-link-candidates';
import { describeLink, linkKey, type LineLink, type LinkCandidate } from '../lib/lines';
import { RemoveButton } from '../../../components/actions/RemoveButton';

interface EntryLinkSelectProps extends Omit<SelectProps, 'data' | 'value' | 'onChange' | 'searchValue' | 'onSearchChange'> {
  /** Entry edited (its own lines are left out). */
  entryId: string | null;
  /** Links already made. */
  links: readonly Pick<LineLink, 'kind' | 'id'>[];
  /** Lines of other entries may be linked. Optional. Default = true. */
  lines?: boolean;
  /** Options also name the account of their entry. Optional. Default = false. */
  withAccount?: boolean;
  /** Links the line or entry chosen. */
  onLink: (link: LinkCandidate) => void;
}

/**
 * Search of a line or an entry to link, by its label (filtered by the server), emptied once one is chosen.
 * @param {EntryLinkSelectProps} props Component props (and those of the select).
 * @returns {JSX.Element} Select.
 */
export function EntryLinkSelect({ entryId, links, lines = true, withAccount = false, onLink, ...props }: EntryLinkSelectProps) {
  const [search, setSearch] = useState('');
  const candidates = useLinkCandidates(search, { entryId, links, lines });
  return (
    <Select
      placeholder="Rechercher un mouvement par son libellé…"
      searchable
      leftSection={<LinkIcon aria-hidden />}
      {...props}
      searchValue={search}
      onSearchChange={setSearch}
      // Filtered by the server.
      filter={({ options }) => options}
      nothingFoundMessage={search.trim().length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun mouvement'}
      data={candidates.map((link) => ({ value: linkKey(link), label: withAccount ? `${describeLink(link)} · ${link.accountLabel}` : describeLink(link) }))}
      value={null}
      onChange={(key) => {
        const link = candidates.find((item) => linkKey(item) === key);
        if (!link) return;
        onLink(link);
        setSearch('');
      }}
    />
  );
}

interface LinkBadgeProps {
  link: LineLink;
  /** Unlinks it, from its cross (none: no cross). Optional. */
  onUnlink?: () => void;
  /** Optional. Default = "light". */
  variant?: BadgeProps['variant'];
  /** Optional. Default = the size of the badges. */
  size?: BadgeProps['size'];
  /** Text. Optional. Default = its description (describeLink). */
  children?: ReactNode;
  /** Its description shows in a tooltip (for a shortened text). Optional. Default = false. */
  withTooltip?: boolean;
}

/**
 * Badge of a linked line or entry: red for money out, green for money in, with a cross unlinking it.
 * @param {LinkBadgeProps} props Component props.
 * @returns {JSX.Element} Badge.
 */
export function LinkBadge({ link, onUnlink, variant = 'light', size, children, withTooltip = false }: LinkBadgeProps) {
  const badge = (
    <Badge
      size={size}
      variant={variant}
      // eslint-disable-next-line no-restricted-syntax -- a badge of a link, coloured as its sign.
      color={link.amount < 0 ? 'red' : 'green'}
      leftSection={<LinkIcon aria-hidden />}
      rightSection={onUnlink && <RemoveButton variant="field" size="xs" label="Délier" aria-label={`Délier ${describeLink(link)}`} onClick={onUnlink} />}
    >
      {children ?? describeLink(link)}
    </Badge>
  );
  return withTooltip ? <Tooltip label={describeLink(link)}>{badge}</Tooltip> : badge;
}
