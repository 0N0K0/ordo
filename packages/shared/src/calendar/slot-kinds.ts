/** Kind of the slots without kind of a workspace (its working hours, « Travail »). */
export const DEFAULT_SLOT_KIND = 'default';

/** Start of a reference to a kind of slots of another workspace. */
const FOREIGN_PREFIX = 'ws:';

/**
 * Kind of slots of the workspace: its id, or the one of its slots without kind.
 * @param {string | null | undefined} typeId Kind; none: the slots without kind.
 * @returns {string} Reference.
 */
export const ownSlotKind = (typeId: string | null | undefined) => typeId ?? DEFAULT_SLOT_KIND;

/**
 * Kind of slots of another workspace, shown or named in this one (a subscription, a slot condition).
 * @param {string} workspaceId Workspace of the slots.
 * @param {string | null | undefined} typeId Kind; none: its slots without kind.
 * @returns {string} Reference.
 */
export const foreignSlotKind = (workspaceId: string, typeId: string | null | undefined) => `${FOREIGN_PREFIX}${workspaceId}:${typeId ?? DEFAULT_SLOT_KIND}`;

/**
 * Workspace of a kind of slots of another workspace (`foreignSlotKind`); null for a kind of this workspace.
 * @param {string} kind Reference.
 * @returns {string | null} Workspace id.
 */
export function foreignSlotKindWorkspace(kind: string): string | null {
  if (!kind.startsWith(FOREIGN_PREFIX)) return null;
  const end = kind.indexOf(':', FOREIGN_PREFIX.length);
  return end > FOREIGN_PREFIX.length ? kind.slice(FOREIGN_PREFIX.length, end) : null;
}

/**
 * Kind of a schedule, as a slot condition names it: of this workspace (no workspace given), or of another one.
 * @param {{ typeId?: string | null }} schedule Schedule.
 * @param {string | null} [workspaceId] Workspace of a schedule of another workspace. Optional. Default = this one.
 * @returns {string} Reference.
 */
export const scheduleSlotKind = (schedule: { typeId?: string | null }, workspaceId: string | null = null) =>
  workspaceId ? foreignSlotKind(workspaceId, schedule.typeId) : ownSlotKind(schedule.typeId);
