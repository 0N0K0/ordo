import { addDays, type ShoppingItemInput } from '@ordo/shared';
import { prisma } from '../../src/db';
import {
  addItem,
  addProducts,
  attachListEntry,
  createBaseList,
  createCategory,
  createList,
  createProduct,
  createStorage,
  createStore,
  setItemPurchased,
  setListClosed,
} from '../../src/services/shopping';
import { createEntry } from '../../src/services/treasury';
import type { SeededTeam } from './team';

/** Fields of a product or an item, from its name. */
type Article = Partial<ShoppingItemInput> & { name: string };

/**
 * Shopping: stores, storage modes, categories (with sub-categories, some tied to base lists), base lists with their
 * products (missing ones, perishable ones with a storage mode and a date, prices, people they are for), and lists:
 * one open made from the missing products and attached to tasks, partly bought, one done and attached to its payment.
 * After the team (members and relations) and the treasury (account, categories).
 * @param {object} input Data of the other fixtures.
 * @param {SeededTeam} input.team Members and relations.
 * @param {string} input.today Today (YYYY-MM-DD).
 * @returns {Promise<void>}
 */
export async function seedShopping({ team, today }: { team: SeededTeam; today: string }): Promise<void> {
  // --- Stores and storage modes ----------------------------------------------------------------------
  const stores = new Map<string, string>();
  for (const [name, color] of [
    ['Biocoop', '#40c057'],
    ['Carrefour', '#228be6'],
    ['Bureau Vallée', '#fd7e14'],
    ['En ligne', '#7950f2'],
  ] as const) {
    stores.set(name, (await createStore({ name, color })).id);
  }
  const storages = new Map<string, string>();
  for (const [name, color] of [
    ['Réfrigérateur', '#15aabf'],
    ['Congélateur', '#4c6ef5'],
    ['Placard', '#fab005'],
  ] as const) {
    storages.set(name, (await createStorage({ name, color })).id);
  }

  // --- Base lists and categories ----------------------------------------------------------------------
  const kitchen = await createBaseList('Cuisine du bureau');
  const supplies = await createBaseList('Fournitures');
  const upkeep = await createBaseList('Entretien');
  const categories = new Map<string, string>();
  const category = async (name: string, color: string | null, baseListIds: string[], parent?: string) => {
    categories.set(name, (await createCategory({ name, color, parentId: parent ? (categories.get(parent) ?? null) : null, baseListIds })).id);
  };
  await category('Alimentation', '#40c057', [kitchen.id]);
  await category('Boissons', '#15aabf', [kitchen.id], 'Alimentation');
  await category('Produits frais', '#82c91e', [kitchen.id], 'Alimentation');
  await category('Épicerie', '#fab005', [kitchen.id], 'Alimentation');
  await category('Papeterie', '#fd7e14', [supplies.id]);
  await category('Informatique', '#7950f2', [supplies.id]);
  await category('Ménage', '#e64980', [upkeep.id]);

  const [alex, sam] = team.memberIds;
  const article = ({ name, ...changes }: Article, categoryName: string, storeName: string | null): ShoppingItemInput => ({
    name,
    categoryId: categories.get(categoryName) ?? null,
    storeId: storeName ? (stores.get(storeName) ?? null) : null,
    url: null,
    note: null,
    quantity: null,
    unit: null,
    unitPrice: null,
    ...changes,
  });
  const perishable = (storage: string, days: number) => ({ perishable: true, storageId: storages.get(storage) ?? null, expiresAt: addDays(today, days) });

  // --- Products of the base lists ---------------------------------------------------------------------
  const products: [string, Article, string, string | null, boolean][] = [
    [kitchen.id, { name: 'Café en grains', quantity: 1, unit: 'kg', unitPrice: 18.9 }, 'Boissons', 'Biocoop', true],
    [kitchen.id, { name: 'Thé vert', quantity: 2, unit: 'boîtes', unitPrice: 6.5, memberIds: sam ? [sam] : [] }, 'Boissons', 'Biocoop', false],
    [kitchen.id, { name: 'Lait d’avoine', quantity: 6, unit: 'L', unitPrice: 1.95, ...perishable('Placard', 60) }, 'Boissons', 'Carrefour', true],
    [kitchen.id, { name: 'Yaourts nature', quantity: 8, unitPrice: 0.45, ...perishable('Réfrigérateur', 4) }, 'Produits frais', 'Carrefour', false],
    [kitchen.id, { name: 'Beurre doux', quantity: 1, unit: 'plaquette', unitPrice: 2.8, ...perishable('Réfrigérateur', -2) }, 'Produits frais', 'Biocoop', false],
    [kitchen.id, { name: 'Pain de mie', quantity: 1, unitPrice: 2.2, ...perishable('Congélateur', 30) }, 'Épicerie', 'Carrefour', false],
    [kitchen.id, { name: 'Biscuits', quantity: 3, unit: 'paquets', unitPrice: 2.4, note: 'Sans huile de palme.' }, 'Épicerie', 'Biocoop', true],
    [supplies.id, { name: 'Ramettes A4', quantity: 5, unit: 'ramettes', unitPrice: 5.9 }, 'Papeterie', 'Bureau Vallée', true],
    [supplies.id, { name: 'Post-it', quantity: 4, unit: 'blocs', unitPrice: 3.2, memberIds: alex ? [alex] : [] }, 'Papeterie', 'Bureau Vallée', false],
    [supplies.id, { name: 'Cartouches d’encre', quantity: 2, unitPrice: 24.9, url: 'https://www.example.com/cartouches' }, 'Informatique', 'En ligne', true],
    [supplies.id, { name: 'Câble USB-C', quantity: 2, unitPrice: 12, relationIds: team.relationIds.slice(1, 2) }, 'Informatique', 'En ligne', false],
    [upkeep.id, { name: 'Liquide vaisselle', quantity: 1, unitPrice: 2.9 }, 'Ménage', 'Biocoop', true],
    [upkeep.id, { name: 'Éponges', quantity: 1, unit: 'lot', unitPrice: 3.5 }, 'Ménage', 'Carrefour', false],
    [upkeep.id, { name: 'Sacs poubelle', quantity: 1, unit: 'rouleau', unitPrice: 4.2 }, 'Ménage', 'Carrefour', true],
  ];
  for (const [baseListId, item, categoryName, storeName, missing] of products) {
    await createProduct({ ...article(item, categoryName, storeName), baseListId, missing });
  }

  // --- Lists ----------------------------------------------------------------------------------------
  const tasks = await prisma.task.findMany({ where: { closedAt: null, archivedAt: null, parentId: null }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 2 });
  // Open: the missing products of two base lists, a few of them bought, plus an item of this list only.
  const open = await createList({ name: 'Courses de la semaine', taskIds: tasks.map(({ id }) => id), baseListIds: [kitchen.id, upkeep.id] });
  await addItem(open.id, article({ name: 'Fleurs pour l’accueil', quantity: 1, unit: 'bouquet', unitPrice: 15, note: 'Pour la visite du client jeudi.' }, 'Alimentation', null));
  const openItems = await prisma.shoppingItem.findMany({ where: { listId: open.id }, orderBy: { position: 'asc' } });
  for (const item of openItems.slice(0, 2)) await setItemPurchased(item.id, true);

  // Done last month: bought, and paid with a movement of the treasury.
  const done = await createList({ name: 'Rentrée — fournitures', taskIds: tasks.slice(0, 1).map(({ id }) => id), baseListIds: [] });
  const supplyProducts = await prisma.shoppingProduct.findMany({ where: { baseListId: supplies.id }, select: { id: true } });
  await addProducts(
    done.id,
    supplyProducts.map(({ id }) => id),
  );
  for (const item of await prisma.shoppingItem.findMany({ where: { listId: done.id } })) await setItemPurchased(item.id, true);
  await setListClosed(done.id, true);
  const account = await prisma.treasuryAccount.findFirst({ where: { name: 'Compte courant pro' } });
  const categoryId = (await prisma.treasuryCategory.findFirst({ where: { name: 'Matériel', direction: 'OUT' } }))?.id ?? null;
  if (account) {
    const entry = await createEntry({
      accountId: account.id,
      status: 'ACTUAL',
      date: addDays(today, -27),
      valueDate: null,
      label: 'Bureau Vallée — fournitures de rentrée',
      amount: -110.1,
      categoryId,
      methodId: (await prisma.treasuryPaymentMethod.findFirst({ where: { name: 'Carte' } }))?.id ?? null,
      clientId: null,
      counterpartyId: null,
      projectId: null,
      note: null,
      recurrence: null,
      allocations: [],
      linkedEntryIds: [],
      libraryDocumentIds: [],
      projectResourceIds: [],
    });
    await attachListEntry(done.id, entry.id);
  }

  // An empty list, not attached.
  await createList({ name: 'Pot de départ de Camille', taskIds: [], baseListIds: [] });
}
