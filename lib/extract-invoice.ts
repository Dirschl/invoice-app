/**
 * Heuristische Extraktion: Rechnungsempfänger, Rechnungsdatum, Endbetrag.
 */

export type ExtractedFields = {
  recipient?: string;
  invoiceDate?: string;
  endAmount?: string;
};

export type ExtractionResult = {
  fields: ExtractedFields;
  hints: string[];
};

function firstMatch(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  return m?.[1]?.trim();
}

/** Bevorzugt Zeile mit „Endbetrag“, sonst typische Schlussbeträge. */
function pickEndAmount(text: string): string | undefined {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const end = line.match(
      /Endbetrag\s*[:\s]?\s*(?:EUR|€)?\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i
    );
    if (end?.[1]) return end[1].trim();
  }
  const patterns = [
    /(?:Zu zahlen|Gesamt(?:betrag)?|Gesamtsumme|Summe|Gesamt|Total|Amount due)\s*[:\s]?\s*(?:EUR|€)?\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i,
    /(?:EUR|€)\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/i,
  ];
  for (const line of lines) {
    for (const p of patterns) {
      const m = line.match(p);
      if (m?.[1]) return m[1].trim();
    }
  }
  const fallback = text.match(
    /([\d]{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)/i
  );
  return fallback?.[1]?.trim();
}

const STOP_LINE =
  /^(rechnungs(nummer|datum)|datum|ust|iban|mwst|summe|gesamt|seite|artikel|pos\.)/i;

function extractRecipient(text: string): string | undefined {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((l) => l.replace(/\u00a0/g, " ").trim());

  const labelPatterns: RegExp[] = [
    /^Rechnungsempfänger\s*:\s*(.+)$/i,
    /^Rechnungsadresse\s*:\s*(.+)$/i,
    /^Rechnung an\s*:\s*(.+)$/i,
    /^Kunde\s*:\s*(.+)$/i,
    /^Empfänger\s*:\s*(.+)$/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const lp of labelPatterns) {
      const m = line.match(lp);
      if (m?.[1]) {
        const first = m[1].trim();
        if (first.length > 1) {
          const rest = collectFollowingLines(lines, i + 1, 4);
          return [first, ...rest].filter(Boolean).join("\n").slice(0, 800);
        }
      }
    }

    if (
      /^(Rechnungsempfänger|Rechnungsadresse|Rechnung an|Kunde|Empfänger)\s*:?\s*$/i.test(
        line
      )
    ) {
      const rest = collectFollowingLines(lines, i + 1, 5);
      if (rest.length) return rest.join("\n").slice(0, 800);
    }
  }

  return undefined;
}

function collectFollowingLines(
  lines: string[],
  start: number,
  max: number
): string[] {
  const out: string[] = [];
  for (let j = start; j < lines.length && out.length < max; j++) {
    const next = lines[j];
    if (!next) {
      if (out.length > 0) break;
      continue;
    }
    if (STOP_LINE.test(next)) break;
    if (/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}$/.test(next) && out.length >= 2)
      break;
    out.push(next);
  }
  return out;
}

export function extractInvoiceFromText(fullText: string): ExtractionResult {
  const text = fullText.replace(/\u00a0/g, " ").trim();
  const hints: string[] = [];

  if (!text.length) {
    hints.push(
      "Kein lesbarer Text (z. B. gescanntes PDF ohne OCR)."
    );
    return { fields: {}, hints };
  }

  const fields: ExtractedFields = {};

  fields.recipient = extractRecipient(text);

  fields.invoiceDate =
    firstMatch(
      text,
      /(?:Rechnungsdatum|Datum\s*(?:der)?\s*Rechnung|Invoice\s*date)\s*[:\s]+(\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4})/i
    ) ?? firstMatch(text, /\b(\d{1,2}[.\/]\d{1,2}[.\/]\d{4})\b/);

  fields.endAmount = pickEndAmount(text);

  if (!fields.recipient && !fields.endAmount && !fields.invoiceDate) {
    hints.push(
      "Keine der drei Felder zuverlässig erkannt — Layout ggf. abweichend."
    );
  }

  return { fields, hints };
}
