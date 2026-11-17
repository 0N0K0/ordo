import { builder } from './builder';

/** Name and color of an item of a simple list (a status, a category, a store…). */
export const NameColorInput = builder.inputType('NameColorInput', {
  description: 'Name and color of an item of a simple list.',
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }) }),
});

/** Changes of the name and color of an item of a simple list (omitted fields unchanged). */
export const NameColorPatch = builder.inputType('NameColorPatch', {
  description: 'Changes of an item of a simple list (omitted fields unchanged).',
  fields: (t) => ({ name: t.string(), color: t.string() }),
});
