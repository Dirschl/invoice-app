import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { extractInvoiceFromText } from "@/lib/extract-invoice";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel-kompatibel (kleiner als Serverless-Limit)

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage (multipart erwartet)." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Keine Datei im Feld „file“." },
      { status: 400 }
    );
  }

  const nameOk = file.name.toLowerCase().endsWith(".pdf");
  const typeOk =
    !file.type ||
    file.type === "application/pdf" ||
    file.type === "application/x-pdf";
  if (!typeOk && !nameOk) {
    return NextResponse.json(
      { error: "Nur PDF-Dateien sind erlaubt." },
      { status: 400 }
    );
  }
  if (!nameOk) {
    return NextResponse.json(
      { error: "Dateiname muss auf .pdf enden." },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Leere Datei." }, { status: 400 });
  }
  if (buf.length > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Datei zu groß (max. ${Math.round(MAX_BYTES / 1024 / 1024)} MB auf diesem Endpoint).`,
      },
      { status: 413 }
    );
  }

  let text = "";
  let numpages = 0;
  try {
    const parsed = await pdfParse(buf);
    text = parsed.text ?? "";
    numpages = parsed.numpages ?? 0;
  } catch {
    return NextResponse.json(
      { error: "PDF konnte nicht gelesen werden." },
      { status: 422 }
    );
  }

  const extraction = extractInvoiceFromText(text);

  return NextResponse.json({
    filename: file.name,
    pageCount: numpages,
    ...extraction,
  });
}
