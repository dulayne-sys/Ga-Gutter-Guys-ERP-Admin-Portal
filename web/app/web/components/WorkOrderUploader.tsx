"use client";

/**
 * WorkOrderUploader — Staged Beta Feature
 *
 * Allows uploading photos, PDFs, or scanned work order sheets.
 * Parsing pipeline is staged — file preview and state are implemented;
 * backend AI extraction is wired as a placeholder for future connection.
 *
 * This component is deliberately non-destructive and does not
 * auto-submit any Firestore writes.
 */

import { useRef, useState } from "react";

type ExtractedFields = {
  customerName: string;
  jobDescription: string;
  materials: string;
  crew: string;
  notes: string;
};

const emptyFields: ExtractedFields = {
  customerName: "",
  jobDescription: "",
  materials: "",
  crew: "",
  notes: "",
};

type WorkOrderUploaderProps = {
  onPrefill?: (fields: ExtractedFields) => void;
  onClose?: () => void;
};

export function WorkOrderUploader({ onPrefill, onClose }: WorkOrderUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [fields, setFields] = useState<ExtractedFields>(emptyFields);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setParsed(false);
    setFields(emptyFields);
    setParseError(null);

    if (!selected) {
      setPreview(null);
      return;
    }

    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => setPreview(String(event.target?.result ?? ""));
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      // Simulate a file input change
      const dt = new DataTransfer();
      dt.items.add(dropped);
      if (inputRef.current) {
        inputRef.current.files = dt.files;
        inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setParsing(true);
    setParseError(null);

    // Staged placeholder — real OCR/AI parsing would call a Cloud Function here
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));

    // Return empty parsed fields — user fills manually after upload
    const stagingResult: ExtractedFields = {
      customerName: "",
      jobDescription: "",
      materials: "",
      crew: "",
      notes: `[Uploaded: ${file.name}] — AI extraction pending. Please fill in manually.`,
    };

    setParsed(true);
    setFields(stagingResult);
    setParsing(false);
  };

  const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  const isValidFile = file && (acceptedTypes.includes(file.type) || file.name.toLowerCase().endsWith(".pdf"));

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/5 px-6 py-10 text-center hover:border-indigo-400/50 hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-8 w-8 text-slate-400">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <p className="text-sm font-medium text-slate-200">Drop a file here or click to upload</p>
        <p className="mt-1 text-xs text-slate-500">Supports: Photo (JPG, PNG, HEIC), PDF, Scanned sheet</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* File info */}
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
              setPreview(null);
              setParsed(false);
              setFields(emptyFields);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Image preview */}
      {preview ? (
        <div className="overflow-hidden rounded-xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Work order preview" className="max-h-56 w-full object-contain" />
        </div>
      ) : null}

      {/* Parse action */}
      {file && !parsed ? (
        <div className="space-y-2">
          {!isValidFile ? (
            <p className="text-xs text-amber-400">File type may not be supported. JPG, PNG, HEIC, and PDF are recommended.</p>
          ) : null}
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <strong>Beta Feature:</strong> AI extraction is staged. Fields will be pre-populated for manual completion.
          </div>
          <button
            type="button"
            onClick={() => void handleParse()}
            disabled={parsing}
            className="w-full rounded-lg bg-indigo-500/20 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
          >
            {parsing ? "Processing..." : "Extract Fields (Beta)"}
          </button>
        </div>
      ) : null}

      {parseError ? (
        <p className="text-xs text-rose-400">{parseError}</p>
      ) : null}

      {/* Extracted / manual fields */}
      {parsed ? (
        <div className="space-y-3">
          <p className="text-xs text-emerald-400">File processed — complete the fields below:</p>

          {(Object.keys(fields) as (keyof ExtractedFields)[]).map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium capitalize text-slate-300">
                {key.replace(/([A-Z])/g, " $1")}
              </label>
              {key === "notes" || key === "materials" ? (
                <textarea
                  rows={2}
                  value={fields[key]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              ) : (
                <input
                  type="text"
                  value={fields[key]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                />
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            {onPrefill ? (
              <button
                type="button"
                onClick={() => onPrefill(fields)}
                className="flex-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-2 text-sm font-semibold text-white"
              >
                Use These Fields
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
