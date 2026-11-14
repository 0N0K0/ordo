-- Amounts typed in keep up to 4 decimals (shown rounded to 2); computed totals stay at 2.
ALTER TABLE "AccountingDocument" ALTER COLUMN "depositValue" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "AccountingDocument" ALTER COLUMN "globalDiscountValue" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "AccountingLine" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "AccountingLine" ALTER COLUMN "discountValue" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "CatalogItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "ImportedDocument" ALTER COLUMN "totalNet" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "ImportedDocument" ALTER COLUMN "totalVat" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "ImportedDocument" ALTER COLUMN "totalGross" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "TreasuryAccount" ALTER COLUMN "openingBalance" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "TreasuryBudget" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "TreasuryEntry" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "TreasuryAllocation" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "ShoppingProduct" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "ShoppingProduct" ALTER COLUMN "lastPrice" SET DATA TYPE DECIMAL(14,4);
ALTER TABLE "ShoppingItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(14,4);
