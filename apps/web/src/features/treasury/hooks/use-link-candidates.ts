import { fromCents, lineCents } from '@ordo/shared';
import { useTreasuryEntrySearch } from '../api';
import { linkKey, type LineLink, type LinkCandidate } from '../lib/lines';

/**
 * Lines and whole entries found by a search, to link: not of the entry edited, nor linked already. A split entry is
 * linked through its lines (when lines may be linked), an entry without lines as a whole.
 * @param {string} search Text searched (2 characters at least).
 * @param {object} options Options.
 * @param {string | null} options.entryId Entry edited (its own lines are left out).
 * @param {readonly Pick<LineLink, 'kind' | 'id'>[]} options.links Links already made.
 * @param {boolean} [options.lines=true] Lines of other entries may be linked. Optional. Default = true.
 * @returns {LinkCandidate[]} Candidates.
 */
export function useLinkCandidates(search: string, { entryId, links, lines = true }: { entryId: string | null; links: readonly Pick<LineLink, 'kind' | 'id'>[]; lines?: boolean }): LinkCandidate[] {
  const { data: found } = useTreasuryEntrySearch(search);
  const linked = new Set(links.map(linkKey));
  return (found ?? [])
    .filter((item) => item.id !== entryId)
    .flatMap((item): LinkCandidate[] => {
      const base = { entryLabel: item.label, date: item.date, accountName: item.accountName };
      if (!item.lines.length) return [{ ...base, kind: 'entry', id: item.id, label: null, amount: item.amount }];
      return lines ? item.lines.map((other) => ({ ...base, kind: 'line', id: other.id, label: other.label ?? null, amount: fromCents(lineCents(item.amount, other)) })) : [];
    })
    .filter((link) => !linked.has(linkKey(link)));
}
