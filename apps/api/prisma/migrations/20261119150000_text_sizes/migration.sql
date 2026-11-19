-- One size per kind of text (decision DO): short free texts 250 characters, plain multi-line texts 4 000, markdown
-- 65 536. The values longer than their new maximum are shortened. Final accounting documents and their lines are left
-- as issued (a final document is never changed: it is corrected by a credit note), only drafts and models are cut.

-- Short free texts: 250 characters.
UPDATE "Task" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "CalendarEvent" SET "label" = left("label", 250) WHERE char_length("label") > 250;
UPDATE "CalendarEvent" SET "location" = left("location", 250) WHERE char_length("location") > 250;

UPDATE "Routine" SET "location" = left("location", 250) WHERE char_length("location") > 250;

UPDATE "Place" SET "address" = left("address", 250) WHERE char_length("address") > 250;

UPDATE "TreasuryEntry" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "ShoppingList" SET "deliveryAddress" = left("deliveryAddress", 250) WHERE char_length("deliveryAddress") > 250;
UPDATE "ShoppingDelivery" SET "address" = left("address", 250) WHERE char_length("address") > 250;

UPDATE "CompanyProfile" SET "vatExemptionText" = left("vatExemptionText", 250) WHERE char_length("vatExemptionText") > 250;
UPDATE "CompanyProfile" SET "paymentTerms" = left("paymentTerms", 250) WHERE char_length("paymentTerms") > 250;
UPDATE "CompanyProfile" SET "paymentMethods" = left("paymentMethods", 250) WHERE char_length("paymentMethods") > 250;
UPDATE "CompanyProfile" SET "lateInterest" = left("lateInterest", 250) WHERE char_length("lateInterest") > 250;

UPDATE "CatalogItem" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "ImportedDocument" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "AccountingDocument" SET "label" = left("label", 250) WHERE "status" <> 'FINAL' AND char_length("label") > 250;
UPDATE "AccountingDocument" SET "paymentTerms" = left("paymentTerms", 250) WHERE "status" <> 'FINAL' AND char_length("paymentTerms") > 250;
UPDATE "AccountingDocument" SET "paymentMethods" = left("paymentMethods", 250) WHERE "status" <> 'FINAL' AND char_length("paymentMethods") > 250;
UPDATE "AccountingDocument" SET "lateInterest" = left("lateInterest", 250) WHERE "status" <> 'FINAL' AND char_length("lateInterest") > 250;
UPDATE "AccountingDocument" SET "billingSchedule" = left("billingSchedule", 250) WHERE "status" <> 'FINAL' AND char_length("billingSchedule") > 250;
UPDATE "AccountingDocument" SET "vatExemptionText" = left("vatExemptionText", 250) WHERE "status" <> 'FINAL' AND char_length("vatExemptionText") > 250;

UPDATE "AccountingLine" SET "label" = left("label", 250)
WHERE char_length("label") > 250
  AND "documentId" IN (SELECT "id" FROM "AccountingDocument" WHERE "status" <> 'FINAL');

-- Plain multi-line texts: 4 000 characters.
UPDATE "Sheet" SET "note" = left("note", 4000) WHERE char_length("note") > 4000;
