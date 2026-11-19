/** Colour of each feedback type, shared by alerts and toasts (decision 12): success green, information blue, warning orange, error red. */
export const FEEDBACK_COLORS = { success: 'green', info: 'blue', warning: 'orange', error: 'red' } as const;

/** Colour of a lateness in the home page, the billing and the treasury (decisions AI, CF): a warning, orange. */
export const LATE_COLOR = FEEDBACK_COLORS.warning;
