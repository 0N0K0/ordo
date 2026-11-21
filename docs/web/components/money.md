# Montants signés

Affichage et saisie d'un montant signé (mouvement d'argent ou de stock) : entrée en vert avec « + », sortie en rouge. Source : `apps/web/src/components/money/`. Les formats d'argent (`fmt.money`, `fmt.moneyCents`…) sont dans [lib/format](../lib.md#formats-formatts).

## `signed-text.ts`

`signedText(value, format = fmt.money)` : texte d'un montant (ou d'une quantité) signé : « + » devant une entrée, le moins du format devant une sortie (« +12,00 € », « -3,50 € »). Imposé par eslint. Utilisé par la trésorerie et le stock.

## `SignedAmount.tsx`

- `SignedAmount` : montant signé sur une ligne, en monospace, vert (≥ 0) ou rouge (< 0). Props : `value`, `format` (défaut montant en euros ; une quantité avec son format), et les props de `Text`. Utilisé par la trésorerie, le stock, les achats, l'accueil. eslint interdit la couleur `red` / `green` choisie à la main sur un test `< 0`.
- `SignedAmountCell` : montant signé saisi en place dans un tableau (`EditableNumber` de `data-table`, « - » pour une sortie), vert ou rouge selon le signe ; 0 refusé (« Le montant ne peut pas être nul. ») ; enregistre `{ direction: directionOf(amount), amount: |amount| }` (`directionOf` de `@ordo/shared` : entrée au-dessus de 0). Props : `value`, `label`, `onSave`. Utilisé par la trésorerie.

Voir [Règles : trésorerie](../../business-rules/finances/treasury.md).
