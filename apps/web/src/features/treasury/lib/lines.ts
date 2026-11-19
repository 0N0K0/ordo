import { type TreasuryLineMode, LEVEL, round2 } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import { taggedKey } from '../../../lib/tagged-key';

/**
 * Line of a split entry as edited: its value is relative to the entry (positive: in the direction of the entry,
 * negative: the other way), signed when saved.
 */
export interface LineValues {
  /** Line saved already (kept, with the links other entries have to it). */
  id: string | null;
  label: string | null;
  mode: TreasuryLineMode;
  value: number;
  memberId: string | null;
  /** Relation it is for, instead of a member. */
  relationId: string | null;
  /** Loan with the relation (money out lends or repays, money in borrows or is repaid). */
  loan: boolean;
  /** Own day (a purchase paid by a deferred debit card); none: the day of the entry. */
  date: string | null;
  categoryId: string | null;
  contextId: string | null;
  projectId: string | null;
  libraryDocumentIds: string[];
  projectResourceIds: string[];
  linkedLineIds: string[];
  linkedEntryIds: string[];
  /** Links as shown (not saved). */
  links: LineLink[];
}

/** Line of another entry, or whole entry without lines, linked to a line. */
export interface LineLink {
  kind: 'line' | 'entry';
  id: string;
  entryLabel: string;
  date: string;
  label: string | null;
  /** Signed amount. */
  amount: number;
}

/**
 * Number of things a line is attached to: its project, documents and links.
 * @param {LineValues} line Line.
 * @returns {number} Count.
 */
export const attachmentCount = (line: LineValues) =>
  (line.projectId ? 1 : 0) + (line.loan ? 1 : 0) + (line.date ? 1 : 0) + line.libraryDocumentIds.length + line.projectResourceIds.length + line.links.length;

/**
 * New line.
 * @param {Partial<LineValues>} fields Its fields.
 * @returns {LineValues} Line.
 */
export function newSplitLine(fields: Partial<LineValues>): LineValues {
  return {
    id: null,
    label: null,
    mode: 'AMOUNT',
    value: 0,
    memberId: null,
    relationId: null,
    loan: false,
    date: null,
    categoryId: null,
    contextId: null,
    projectId: null,
    libraryDocumentIds: [],
    projectResourceIds: [],
    linkedLineIds: [],
    linkedEntryIds: [],
    links: [],
    ...fields,
  };
}

/**
 * Short description of a linked line or entry.
 * @param {LineLink} link Link.
 * @returns {string} "12 mars 2026 · Courses › Glace · -4,50 €".
 */
export const describeLink = (link: LineLink) => `${fmt.day(link.date)} · ${link.entryLabel}${link.label ? `${LEVEL}${link.label}` : ''} · ${fmt.money(link.amount)}`;

/**
 * Value of a line in another unit, keeping its share of the entry.
 * @param {TreasuryLineMode} mode Unit wanted.
 * @param {number} share Amount of the line relative to the entry (positive: its direction).
 * @param {number} entryAmount Amount of the entry, positive.
 * @returns {number} Amount, or percentage of the entry (0 for an entry of 0).
 */
export const valueInMode = (mode: TreasuryLineMode, share: number, entryAmount: number) => (mode === 'PERCENT' ? (entryAmount ? round2((share * 100) / entryAmount) : 0) : share);

/**
 * Category kept for a line only when it is of the direction the line goes.
 * @param {readonly { id: string, direction: string }[]} categories Categories.
 * @param {string | null} id Category.
 * @param {'IN' | 'OUT'} direction Direction of the line.
 * @returns {string | null} The category, or null when it is of the other direction (or unknown).
 */
export function categoryForDirection(categories: readonly { id: string; direction: string }[], id: string | null, direction: 'IN' | 'OUT'): string | null {
  const category = categories.find((item) => item.id === id);
  return category && category.direction === direction ? category.id : null;
}

/** Line or whole entry found to link, with the account of its entry. */
export type LinkCandidate = LineLink & { accountLabel: string };

/**
 * Key of a link, unique among lines and entries.
 * @param {Pick<LineLink, 'kind' | 'id'>} link Link.
 * @returns {string} "line:<id>" or "entry:<id>".
 */
export const linkKey = (link: Pick<LineLink, 'kind' | 'id'>) => taggedKey(link.kind, link.id);
