/** Kind of the slots without kind of a workspace (its working hours, « Travail »). */
export const DEFAULT_SLOT_KIND = 'default';

/**
 * Kind of slots of another workspace, shown in this one (a subscription).
 * @param {string} workspaceId Workspace of the slots.
 * @param {string | null | undefined} typeId Kind; none: its slots without kind.
 * @returns {string} Reference.
 */
export const foreignSlotKind = (workspaceId: string, typeId: string | null | undefined) => `ws:${workspaceId}:${typeId ?? DEFAULT_SLOT_KIND}`;
