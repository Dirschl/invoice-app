"use client";

import { useCallback, useRef, useState } from "react";

type ApiOk = {
  fields: {
    recipient?: string;
    invoiceDate?: string;
    endAmount?: string;
  };
  hints: string[];
};

type ApiErr = { error: string };

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Bitte eine PDF-Datei verwenden.");
      return;
    }
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

  const onFileInput = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      if (file) void uploadFile(file);
    },
    [uploadFile]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Rechnungs-PDF auswerten
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Es werden nur{" "}
            <span className="font-medium text-zinc-800">Rechnungsempfänger</span>,{" "}
            <span className="font-medium text-zinc-800">Endbetrag</span> und{" "}
            <span className="font-medium text-zinc-800">Rechnungsdatum</span> angezeigt.
            PDF per Klick oder per Drag&nbsp;&amp;&nbsp;Drop (max. ca. 4&nbsp;MB).
          </p>
        </header>

        <div
          className={`relative rounded-xl border-2 border-dashed bg-white px-6 py-14 transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50/80"
              : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50"
          }`}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <label className="flex cursor-pointer flex-col items-center justify-center">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={loading}
              onChange={(e) => {
                onFileInput(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="text-sm font-medium text-zinc-800">
              {loading ? "Wird verarbeitet …" : "PDF auswählen oder hier ablegen"}
            </span>
            <span className="mt-1 text-xs text-zinc-500">nur .pdf</span>
          </label>
        </div>

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
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-zinc-500">Rechnungsempfänger</dt>
                <dd className="mt-1 whitespace-pre-wrap font-medium text-zinc-900">
                  {result.fields.recipient ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Endbetrag</dt>
                <dd className="mt-1 font-mono text-base font-medium text-zinc-900">
                  {result.fields.endAmount
                    ? `${result.fields.endAmount} €`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Rechnungsdatum</dt>
                <dd className="mt-1 font-mono text-base font-medium text-zinc-900">
                  {result.fields.invoiceDate ?? "—"}
                </dd>
              </div>
            </dl>
            {result.hints.length > 0 && (
              <ul className="list-inside list-disc text-sm text-amber-800">
                {result.hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
