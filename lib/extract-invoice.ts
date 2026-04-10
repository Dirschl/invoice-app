/**
 * Heuristische Extraktion typischer Rechnungsfelder aus Rohtext (DE/EN).
 * Für echte Produktion: ML/OCR, feste Lieferanten-Templates oder eine Parser-Pipeline.
 */

export type ExtractedFields = {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: string;
  currency?: string;
  vatId?: string;
  iban?: string;
};

export type ExtractionResult = {
  fields: ExtractedFields;
  rawTextPreview: string;
  hints: string[];
};

const MAX_PREVIEW = 3500;

function firstMatch(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  return m?.[1]?.trim();
}

function pickAmount(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const amountPatterns = [
    /(?:Gesamt(?:betrag)?|Gesamtsumme|Summe|Endbetrag|Gesamt|Zu zahlen|Total|Amount due)\s*[:\s]?\s*(?:EUR|€)?\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:EUR|€)\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(?:Gesamt|Summe|Total)?/i,
  ];
  for (const line of lines) {
    for (const p of amountPatterns) {
      const m = line.match(p);
      if (m?.[1]) return m[1].trim();
    }
  }
  const fallback = text.match(
    /([\d]{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)/i
  );
  return fallback?.[1]?.trim();
}

export function extractInvoiceFromText(fullText: string): ExtractionResult {
  const text = fullText.replace(/\u00a0/g, " ").trim();
  const hints: string[] = [];

  if (!text.length) {
    hints.push(
      "Kein lesbarer Text gefunden (gescanntes PDF ohne OCR oder verschlüsselt)."
    );
    return { fields: {}, rawTextPreview: "", hints };
  }

  const fields: ExtractedFields = {};

  fields.invoiceNumber =
    firstMatch(text, /Rechnungs?(?:nummer|nr\.?)\s*[:\s#]+([A-Z0-9\-\/]+)/i) ??
    firstMatch(text, /Invoice\s*(?:No\.?|Number)\s*[:\s#]+([A-Z0-9\-\/]+)/i);

  fields.invoiceDate =
    firstMatch(
      text,
      /(?:Rechnungsdatum|Datum\s*(?:der)?\s*Rechnung|Invoice\s*date)\s*[:\s]+(\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4})/i
    ) ?? firstMatch(text, /\b(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})\b/);

  fields.dueDate = firstMatch(
    text,
    /(?:Fällig(?:keit| am)?|Zahlbar bis|Due\s*date)\s*[:\s]+(\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4})/i
  );

  fields.totalAmount = pickAmount(text);
  if (fields.totalAmount) {
    fields.currency =
      /\bUSD\b/i.test(text) && !/\bEUR\b/i.test(text) ? "USD" : "EUR";
  }

  const vat = text.match(/\b(DE\s?\d{9})\b/i);
  if (vat) fields.vatId = vat[1].replace(/\s/g, "");

  const iban = text.match(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/);
  if (iban) fields.iban = iban[1];

  if (!fields.invoiceNumber && !fields.totalAmount) {
    hints.push(
      "Wenige Treffer — Layout abweichend oder Tabellen-PDF; Regex ggf. anpassen."
    );
  }

  return {
    fields,
    rawTextPreview: text.slice(0, MAX_PREVIEW),
    hints,
  };
}
