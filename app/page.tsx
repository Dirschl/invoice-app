"use client";

import { useCallback, useState } from "react";

type ApiOk = {
  filename: string;
  pageCount: number;
  fields: {
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    totalAmount?: string;
    currency?: string;
    vatId?: string;
    iban?: string;
  };
  rawTextPreview: string;
  hints: string[];
};

type ApiErr = { error: string };

const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: "Rechnungsnummer",
  invoiceDate: "Rechnungsdatum",
  dueDate: "Fällig am",
  totalAmount: "Betrag",
  currency: "Währung",
  vatId: "USt-IdNr.",
  iban: "IBAN",
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = (await res.json()) as ApiOk & ApiErr;
      if (!res.ok) {
        setError("error" in data ? data.error : `Fehler ${res.status}`);
        return;
      }
      if ("error" in data && data.error) {
        setError(data.error);
        return;
      }
      setResult(data as ApiOk);
    } catch {
      setError("Netzwerk- oder Serverfehler.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Rechnungs-PDF auswerten
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            PDF hochladen — der Server extrahiert Text und versucht typische Felder
            (Rechnungsnummer, Datum, Betrag, USt-Id, IBAN) per Heuristik zu erkennen.
            Für Vercel: Dateien bis ca. 4&nbsp;MB; gescannte Rechnungen brauchen OCR.
          </p>
        </header>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-white px-6 py-14 transition hover:border-zinc-400 hover:bg-zinc-50">
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={loading}
            onChange={(e) => void onFile(e.target.files)}
          />
          <span className="text-sm font-medium text-zinc-800">
            {loading ? "Wird verarbeitet …" : "PDF auswählen oder hierher ziehen"}
          </span>
          <span className="mt-1 text-xs text-zinc-500">nur .pdf</span>
        </label>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        {result && (
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Ergebnis
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Datei</dt>
                <dd className="font-medium">{result.filename}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Seiten</dt>
                <dd>{result.pageCount}</dd>
              </div>
              {Object.entries(result.fields).map(([k, v]) =>
                v ? (
                  <div key={k}>
                    <dt className="text-zinc-500">
                      {FIELD_LABELS[k] ?? k}
                    </dt>
                    <dd className="font-mono text-xs">{v}</dd>
                  </div>
                ) : null
              )}
            </dl>
            {result.hints.length > 0 && (
              <ul className="list-inside list-disc text-sm text-amber-800">
                {result.hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            {result.rawTextPreview ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-600">
                  Rohtext-Ausschnitt
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 whitespace-pre-wrap">
                  {result.rawTextPreview}
                </pre>
              </details>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
