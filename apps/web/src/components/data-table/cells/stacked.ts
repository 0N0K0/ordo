/** Values a cell shows at most before folding them. */
export const MAX_STACKED = 5;

/**
 * Number of values shown: all up to MAX_STACKED, else one less (the last place tells how many more there are).
 * @param {number} count Values.
 * @param {boolean} expanded Unfolded.
 * @returns {number} Values shown.
 */
export const stackedCount = (count: number, expanded: boolean) => (expanded || count <= MAX_STACKED ? count : MAX_STACKED - 1);
