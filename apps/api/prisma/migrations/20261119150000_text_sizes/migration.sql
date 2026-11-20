-- One size per kind of text (decision DO): short free texts 250 characters, plain multi-line texts 4 000, markdown
-- 65 536; the legal mentions (VAT mention, payment terms, late interest, registration) 500. The values longer than their
-- new maximum are shortened, in every accounting document and line, final ones included (the one exception to "a final
-- document is never changed"). The columns are TEXT: no width to change.

-- Short free texts: 250 characters.
UPDATE "Task" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "CalendarEvent" SET "label" = left("label", 250) WHERE char_length("label") > 250;
UPDATE "CalendarEvent" SET "location" = left("location", 250) WHERE char_length("location") > 250;

UPDATE "Routine" SET "location" = left("location", 250) WHERE char_length("location") > 250;

UPDATE "Place" SET "address" = left("address", 250) WHERE char_length("address") > 250;

UPDATE "TreasuryEntry" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "ShoppingList" SET "deliveryAddress" = left("deliveryAddress", 250) WHERE char_length("deliveryAddress") > 250;
UPDATE "ShoppingDelivery" SET "address" = left("address", 250) WHERE char_length("address") > 250;

UPDATE "CompanyProfile" SET "vatExemptionText" = left("vatExemptionText", 500) WHERE char_length("vatExemptionText") > 500;
UPDATE "CompanyProfile" SET "paymentTerms" = left("paymentTerms", 500) WHERE char_length("paymentTerms") > 500;
UPDATE "CompanyProfile" SET "paymentMethods" = left("paymentMethods", 250) WHERE char_length("paymentMethods") > 250;
UPDATE "CompanyProfile" SET "lateInterest" = left("lateInterest", 500) WHERE char_length("lateInterest") > 500;

UPDATE "CatalogItem" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "ImportedDocument" SET "label" = left("label", 250) WHERE char_length("label") > 250;

UPDATE "AccountingDocument" SET "label" = left("label", 250) WHERE char_length("label") > 250;
UPDATE "AccountingDocument" SET "paymentTerms" = left("paymentTerms", 500) WHERE char_length("paymentTerms") > 500;
UPDATE "AccountingDocument" SET "paymentMethods" = left("paymentMethods", 250) WHERE char_length("paymentMethods") > 250;
UPDATE "AccountingDocument" SET "lateInterest" = left("lateInterest", 500) WHERE char_length("lateInterest") > 500;
UPDATE "AccountingDocument" SET "billingSchedule" = left("billingSchedule", 250) WHERE char_length("billingSchedule") > 250;
UPDATE "AccountingDocument" SET "vatExemptionText" = left("vatExemptionText", 500) WHERE char_length("vatExemptionText") > 500;

UPDATE "AccountingLine" SET "label" = left("label", 250) WHERE char_length("label") > 250;

-- The company as frozen on final documents (seller): the same limits (jsonb_set: PostgreSQL 9.5+).
UPDATE "AccountingDocument" SET "seller" = jsonb_set("seller", '{paymentTerms}', to_jsonb(left("seller"->>'paymentTerms', 500)))
WHERE jsonb_typeof("seller"->'paymentTerms') = 'string' AND char_length("seller"->>'paymentTerms') > 500;
UPDATE "AccountingDocument" SET "seller" = jsonb_set("seller", '{lateInterest}', to_jsonb(left("seller"->>'lateInterest', 500)))
WHERE jsonb_typeof("seller"->'lateInterest') = 'string' AND char_length("seller"->>'lateInterest') > 500;
UPDATE "AccountingDocument" SET "seller" = jsonb_set("seller", '{paymentMethods}', to_jsonb(left("seller"->>'paymentMethods', 250)))
WHERE jsonb_typeof("seller"->'paymentMethods') = 'string' AND char_length("seller"->>'paymentMethods') > 250;

-- Plain multi-line texts: 4 000 characters.
UPDATE "Sheet" SET "note" = left("note", 4000) WHERE char_length("note") > 4000;
