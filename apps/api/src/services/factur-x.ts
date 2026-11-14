import type { AccountingUnit, Address, DocumentTotals } from '@ordo/shared';
import type { AccountingDocumentType } from '../generated/prisma/client';
import {
  lineInput,
  type Buyer,
  type DocumentWithLines,
  type Seller,
} from './accounting-documents';

/** Name of the embedded invoice, imposed by Factur-X. */
export const FACTUR_X_FILENAME = 'factur-x.xml';
export const FACTUR_X_LEVEL = 'EN 16931';

/** UNTDID 1001 document type codes. */
const TYPE_CODES: Partial<Record<AccountingDocumentType, string>> = {
  INVOICE: '380',
  DEPOSIT_INVOICE: '386',
  CREDIT_NOTE: '381',
};

/** UN/ECE Recommendation 20 unit codes. */
const UNIT_CODES: Record<AccountingUnit, string> = {
  UNIT: 'C62',
  HOUR: 'HUR',
  DAY: 'DAY',
  MONTH: 'MON',
  FLAT: 'LS',
  DEPOSIT: 'C62',
};

/**
 * Whether a document type is an invoice for Factur-X (quotes are not).
 * @param {AccountingDocumentType} type Type.
 * @returns {boolean} True for invoices, deposit invoices and credit notes.
 */
export function hasFacturX(type: AccountingDocumentType): boolean {
  return type in TYPE_CODES;
}

/**
 * Escapes text for XML.
 * @param {string} value Text.
 * @returns {string} Escaped text.
 */
function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[char] ?? char,
  );
}

/**
 * Element with escaped text, or nothing when the value is empty.
 * @param {string} name Qualified name.
 * @param {string | null | undefined} value Text.
 * @param {string} [attributes] Attributes, already escaped. Optional.
 * @returns {string} XML.
 */
function element(
  name: string,
  value: string | null | undefined,
  attributes = '',
): string {
  if (value === null || value === undefined || value.trim() === '') return '';
  return `<${name}${attributes ? ` ${attributes}` : ''}>${escapeXml(value.trim())}</${name}>`;
}

/**
 * Amount of cents as a decimal ("1234.50").
 * @param {number} cents Cents.
 * @returns {string} Amount.
 */
const amount = (cents: number) => (cents / 100).toFixed(2);

/**
 * Date in the 102 format (YYYYMMDD).
 * @param {Date} date Calendar date (midnight UTC).
 * @returns {string} Date.
 */
const day = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');

/**
 * Number without trailing zeros ("2.5", "20").
 * @param {number} value Number.
 * @returns {string} Decimal.
 */
const decimal = (value: number) => String(Number(value.toFixed(4)));

/**
 * Postal address of a party (the country is required: France when unknown).
 * @param {Address | null} address Address.
 * @returns {string} XML.
 */
function postalAddress(address: Address | null): string {
  const lines = (address?.lines ?? []).filter((line) => line.trim());
  return [
    '<ram:PostalTradeAddress>',
    element('ram:PostcodeCode', address?.postalCode),
    element('ram:LineOne', lines[0]),
    element('ram:LineTwo', lines[1]),
    element('ram:LineThree', lines.slice(2).join(', ')),
    element('ram:CityName', address?.city),
    element('ram:CountryID', address?.country || 'FR'),
    element('ram:CountrySubDivisionName', address?.region),
    '</ram:PostalTradeAddress>',
  ].join('');
}

/**
 * Trade party: name, SIREN, address, email and VAT number (or fiscal number when there is none).
 * @param {object} party Party.
 * @param {string} party.name Name.
 * @param {string | null} party.siren SIREN.
 * @param {string | null} party.vatNumber VAT number.
 * @param {string | null} party.email Email.
 * @param {Address | null} party.address Address.
 * @param {boolean} fiscalFallback Whether the SIREN stands as fiscal number without VAT number (seller).
 * @returns {string} XML (inside the party element).
 */
function party(
  party: {
    name: string;
    contact: string | null;
    siren: string | null;
    vatNumber: string | null;
    email: string | null;
    address: Address | null;
  },
  fiscalFallback: boolean,
): string {
  return [
    element('ram:Name', party.name),
    party.siren
      ? `<ram:SpecifiedLegalOrganization>${element('ram:ID', party.siren, 'schemeID="0002"')}</ram:SpecifiedLegalOrganization>`
      : '',
    postalAddress(party.address),
    party.email
      ? `<ram:URIUniversalCommunication>${element('ram:URIID', party.email, 'schemeID="EM"')}</ram:URIUniversalCommunication>`
      : '',
    party.vatNumber
      ? `<ram:SpecifiedTaxRegistration>${element('ram:ID', party.vatNumber.replace(/\s/g, ''), 'schemeID="VA"')}</ram:SpecifiedTaxRegistration>`
      : fiscalFallback && party.siren
        ? `<ram:SpecifiedTaxRegistration>${element('ram:ID', party.siren, 'schemeID="FC"')}</ram:SpecifiedTaxRegistration>`
        : '',
  ].join('');
}

/** VAT category of a line or a breakdown: standard, zero rate, or exempt (franchise, disbursements). */
interface TaxCategory {
  code: 'S' | 'Z' | 'E';
  rate: number;
  exemptionReason?: string;
  exemptionCode?: string;
}

/**
 * Tax element of a category.
 * @param {TaxCategory} category Category.
 * @param {object} [amounts] Breakdown amounts (header). Optional.
 * @param {number} amounts.basis Basis, in cents.
 * @param {number} amounts.tax Tax, in cents.
 * @param {string} [name] Element name. Optional. Default = ram:ApplicableTradeTax.
 * @returns {string} XML.
 */
function tradeTax(
  category: TaxCategory,
  amounts?: { basis: number; tax: number },
  name = 'ram:ApplicableTradeTax',
): string {
  return [
    `<${name}>`,
    amounts ? element('ram:CalculatedAmount', amount(amounts.tax)) : '',
    '<ram:TypeCode>VAT</ram:TypeCode>',
    amounts ? element('ram:ExemptionReason', category.exemptionReason) : '',
    amounts ? element('ram:BasisAmount', amount(amounts.basis)) : '',
    element('ram:CategoryCode', category.code),
    amounts ? element('ram:ExemptionReasonCode', category.exemptionCode) : '',
    element('ram:RateApplicablePercent', decimal(category.rate)),
    `</${name}>`,
  ].join('');
}

/**
 * Factur-X XML (UN/CEFACT CII D16B, EN 16931 profile) of a final invoice, deposit invoice or credit note.
 * Items keep their VAT rate; disbursements are exempt lines; amounts already invoiced are negative lines;
 * the global discount is a document allowance per VAT rate, as spread by the totals.
 * @param {DocumentWithLines} document Final document.
 * @param {DocumentTotals} totals Its totals.
 * @param {Seller} seller Seller as printed.
 * @param {Buyer} buyer Buyer as printed.
 * @param {{ number: string, issueDate: Date } | null} source Invoice a credit note cancels.
 * @returns {string} XML.
 */
export function facturXml(
  document: DocumentWithLines,
  totals: DocumentTotals,
  seller: Seller,
  buyer: Buyer,
  source: { number: string; issueDate: Date } | null,
): string {
  const typeCode = TYPE_CODES[document.type];
  if (!typeCode || !document.number)
    throw new Error('Factur-X: final invoices only.');
  const vatApplicable = document.vatApplicable;
  const franchise: TaxCategory = {
    code: 'E',
    rate: 0,
    exemptionReason: document.vatExemptionText ?? seller.vatExemptionText,
    exemptionCode: 'VATEX-FR-FRANCHISE',
  };
  const disbursement: TaxCategory = vatApplicable
    ? {
        code: 'E',
        rate: 0,
        exemptionReason: 'Débours',
        exemptionCode: 'VATEX-EU-79-C',
      }
    : franchise;
  const itemCategory = (rate: number): TaxCategory =>
    !vatApplicable
      ? franchise
      : rate > 0
        ? { code: 'S', rate }
        : { code: 'Z', rate: 0 };
  const key = (category: TaxCategory) => `${category.code}|${category.rate}`;

  // Breakdown per category: bases come from the totals (after discount and deductions), disbursements apart.
  const breakdown = new Map<
    string,
    { category: TaxCategory; basis: number; tax: number }
  >();
  const addBreakdown = (category: TaxCategory, basis: number, tax: number) => {
    const current = breakdown.get(key(category)) ?? {
      category,
      basis: 0,
      tax: 0,
    };
    breakdown.set(key(category), {
      category,
      basis: current.basis + basis,
      tax: current.tax + tax,
    });
  };
  for (const item of totals.vat)
    addBreakdown(itemCategory(item.rate), item.base, item.vat);
  if (totals.disbursements) addBreakdown(disbursement, totals.disbursements, 0);

  // Line nets per rate, to find the share of the global discount of each rate.
  const netByRate = new Map<number, number>();
  const lines = document.lines
    .map((line, index) => ({
      line: lineInput(line),
      total: totals.lines[index],
    }))
    .filter(({ line }) => line.kind !== 'TEXT')
    .map(({ line, total }, index) => {
      const category =
        line.kind === 'DISBURSEMENT'
          ? disbursement
          : itemCategory(line.vatRate);
      if (line.kind !== 'DISBURSEMENT')
        netByRate.set(
          category.rate,
          (netByRate.get(category.rate) ?? 0) + total.net,
        );
      // Prices are never negative: the sign goes to the quantity.
      const sign =
        (line.kind === 'DEDUCTION' ? -1 : 1) * (line.unitPrice < 0 ? -1 : 1);
      return [
        '<ram:IncludedSupplyChainTradeLineItem>',
        `<ram:AssociatedDocumentLineDocument>${element('ram:LineID', String(index + 1))}</ram:AssociatedDocumentLineDocument>`,
        `<ram:SpecifiedTradeProduct>${element('ram:Name', line.title || '-')}${element('ram:Description', line.description)}</ram:SpecifiedTradeProduct>`,
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>${element('ram:ChargeAmount', decimal(Math.abs(line.unitPrice)))}</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>`,
        `<ram:SpecifiedLineTradeDelivery>${element('ram:BilledQuantity', decimal(line.quantity * sign), `unitCode="${UNIT_CODES[line.unit]}"`)}</ram:SpecifiedLineTradeDelivery>`,
        '<ram:SpecifiedLineTradeSettlement>',
        tradeTax(category),
        total.discount
          ? `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>${element('ram:ActualAmount', amount(total.discount))}${element('ram:Reason', 'Remise')}</ram:SpecifiedTradeAllowanceCharge>`
          : '',
        `<ram:SpecifiedTradeSettlementLineMonetarySummation>${element('ram:LineTotalAmount', amount(total.net))}</ram:SpecifiedTradeSettlementLineMonetarySummation>`,
        '</ram:SpecifiedLineTradeSettlement>',
        '</ram:IncludedSupplyChainTradeLineItem>',
      ].join('');
    });

  const allowances = totals.globalDiscount
    ? [...netByRate.entries()].map(([rate, net]) => {
        const base = totals.vat.find((item) => item.rate === rate)?.base ?? 0;
        const share = net - base;
        if (!share) return '';
        return [
          '<ram:SpecifiedTradeAllowanceCharge>',
          '<ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>',
          element('ram:ActualAmount', amount(share)),
          element('ram:Reason', 'Remise globale'),
          tradeTax(itemCategory(rate), undefined, 'ram:CategoryTradeTax'),
          '</ram:SpecifiedTradeAllowanceCharge>',
        ].join('');
      })
    : [];

  const lineTotal = totals.itemsNet - totals.deductions + totals.disbursements;
  const taxBasis = lineTotal - totals.globalDiscount;
  const notes = [
    [
      document.lateInterest?.trim()
        ? `Intérêts de retard : ${document.lateInterest.trim()}`
        : null,
      'PMD',
    ],
    // Due by law to a professional client paying late.
    [
      buyer.kind === 'COMPANY' && document.type !== 'CREDIT_NOTE'
        ? 'Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 €'
        : null,
      'PMT',
    ],
    [document.otherMentions, 'AAB'],
  ]
    .filter(([content]) => content?.trim())
    .map(
      ([content, code]) =>
        `<ram:IncludedNote>${element('ram:Content', content)}${element('ram:SubjectCode', code)}</ram:IncludedNote>`,
    );
  const iban =
    document.showBankDetails && seller.iban
      ? seller.iban.replace(/\s/g, '')
      : null;
  const buyerAddress = buyer.address as Address | null;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
    '<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>',
    '<rsm:ExchangedDocument>',
    element('ram:ID', document.number),
    element('ram:TypeCode', typeCode),
    `<ram:IssueDateTime><udt:DateTimeString format="102">${day(document.issueDate)}</udt:DateTimeString></ram:IssueDateTime>`,
    ...notes,
    '</rsm:ExchangedDocument>',
    '<rsm:SupplyChainTradeTransaction>',
    ...lines,
    '<ram:ApplicableHeaderTradeAgreement>',
    element('ram:BuyerReference', document.referenceValue),
    `<ram:SellerTradeParty>${party({ name: seller.name, contact: seller.contact, siren: seller.siren, vatNumber: seller.vatNumber, email: seller.email, address: seller.address as Address | null }, true)}</ram:SellerTradeParty>`,
    `<ram:BuyerTradeParty>${party({ name: buyer.name, contact: null, siren: buyer.siren, vatNumber: buyer.vatNumber, email: buyer.contact?.email ?? buyer.service?.email ?? buyer.email, address: buyerAddress }, false)}</ram:BuyerTradeParty>`,
    '</ram:ApplicableHeaderTradeAgreement>',
    '<ram:ApplicableHeaderTradeDelivery>',
    // Date of the service (its end for a period), the issue date when none is set: the element cannot be empty.
    `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${day(document.serviceEnd ?? document.serviceStart ?? document.issueDate)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`,
    '</ram:ApplicableHeaderTradeDelivery>',
    '<ram:ApplicableHeaderTradeSettlement>',
    element('ram:InvoiceCurrencyCode', document.currency),
    iban
      ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount>${element('ram:IBANID', iban)}${element('ram:AccountName', seller.accountHolder)}</ram:PayeePartyCreditorFinancialAccount>${seller.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>${element('ram:BICID', seller.bic.replace(/\s/g, ''))}</ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}</ram:SpecifiedTradeSettlementPaymentMeans>`
      : '',
    ...[...breakdown.values()].map(({ category, basis, tax }) =>
      tradeTax(category, { basis, tax }),
    ),
    document.serviceStart && document.serviceEnd
      ? `<ram:BillingSpecifiedPeriod><ram:StartDateTime><udt:DateTimeString format="102">${day(document.serviceStart)}</udt:DateTimeString></ram:StartDateTime><ram:EndDateTime><udt:DateTimeString format="102">${day(document.serviceEnd)}</udt:DateTimeString></ram:EndDateTime></ram:BillingSpecifiedPeriod>`
      : '',
    ...allowances,
    document.paymentTerms || document.dueDate
      ? `<ram:SpecifiedTradePaymentTerms>${element('ram:Description', document.paymentTerms)}${document.dueDate ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${day(document.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>` : ''}</ram:SpecifiedTradePaymentTerms>`
      : '',
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    element('ram:LineTotalAmount', amount(lineTotal)),
    totals.globalDiscount
      ? element('ram:AllowanceTotalAmount', amount(totals.globalDiscount))
      : '',
    element('ram:TaxBasisTotalAmount', amount(taxBasis)),
    element(
      'ram:TaxTotalAmount',
      amount(totals.totalVat),
      `currencyID="${escapeXml(document.currency)}"`,
    ),
    element('ram:GrandTotalAmount', amount(totals.totalGross)),
    element('ram:DuePayableAmount', amount(totals.totalGross)),
    '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    source
      ? `<ram:InvoiceReferencedDocument>${element('ram:IssuerAssignedID', source.number)}<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${day(source.issueDate)}</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>`
      : '',
    '</ram:ApplicableHeaderTradeSettlement>',
    '</rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
  ].join('');
}

/**
 * XMP metadata declaring the Factur-X attachment (PDF/A extension schema and its values).
 * @returns {string} XMP descriptions.
 */
export function facturXmp(): string {
  const property = (name: string, description: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`;
  return `
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
${property('DocumentFileName', 'Name of the embedded XML invoice file')}
${property('DocumentType', 'INVOICE')}
${property('Version', 'The actual version of the Factur-X XML schema')}
${property('ConformanceLevel', 'The conformance level of the embedded Factur-X data')}
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
<fx:DocumentType>INVOICE</fx:DocumentType>
<fx:DocumentFileName>${FACTUR_X_FILENAME}</fx:DocumentFileName>
<fx:Version>1.0</fx:Version>
<fx:ConformanceLevel>${FACTUR_X_LEVEL}</fx:ConformanceLevel>
</rdf:Description>`;
}
