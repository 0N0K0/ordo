import type { InputFields } from './builder';

/** Which product fields an input requires. */
interface ProductRequirements<People extends boolean, Perishable extends boolean> {
  /** Members and relations it is for: required (stock, shopping) or not (sheets). */
  people: People;
  /** Perishable flag: required (stock) or not. */
  perishable: Perishable;
}

/**
 * Fields every product input has (sheet item, shopping product and item, stock item): its category, quantity, unit,
 * note, whom it is for and whether it perishes. Its name (`label` or `name`) and its own fields are added by each input.
 * @param {InputFields} t Field builder.
 * @param {ProductRequirements} required Fields required.
 * @returns {object} Fields.
 */
export function productInputFields<People extends boolean, Perishable extends boolean>(t: InputFields, required: ProductRequirements<People, Perishable>) {
  return {
    categoryId: t.id(),
    quantity: t.float(),
    unit: t.string(),
    note: t.string(),
    memberIds: t.idList({ required: required.people }),
    relationIds: t.idList({ required: required.people }),
    perishable: t.boolean({ required: required.perishable }),
  };
}

/**
 * Fields of a product bought (sheet item, shopping product and item): its store, its link and where it is kept.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
export function purchaseInputFields(t: InputFields) {
  return { storeId: t.id(), url: t.string(), storageId: t.id() };
}

/** Product fields of an input, as GraphQL gives them (omitted, null, an empty id). */
interface ProductInputValues {
  categoryId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  memberIds?: string[] | null;
  relationIds?: string[] | null;
  perishable?: boolean | null;
}

/**
 * Product fields as the services read them: omitted ones null (an empty id too), no people, not perishable.
 * @param {ProductInputValues} input GraphQL input.
 * @returns {object} Service fields.
 */
export function productInput(input: ProductInputValues) {
  return {
    categoryId: input.categoryId || null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    note: input.note ?? null,
    memberIds: input.memberIds ?? [],
    relationIds: input.relationIds ?? [],
    perishable: input.perishable ?? false,
  };
}

/**
 * Purchase fields as the services read them: omitted ones null (an empty id too).
 * @param {{ storeId?: string | null, url?: string | null, storageId?: string | null }} input GraphQL input.
 * @returns {{ storeId: string | null, url: string | null, storageId: string | null }} Service fields.
 */
export function purchaseInput(input: { storeId?: string | null; url?: string | null; storageId?: string | null }) {
  return { storeId: input.storeId || null, url: input.url ?? null, storageId: input.storageId || null };
}
