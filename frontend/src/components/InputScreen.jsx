import React, { useEffect, useState } from "react";
import { Sparkles, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { MicRecorder } from "./MicRecorder";
import { MODES, SAMPLES } from "../lib/samples";

export function InputScreen({
  mode,
  setMode,
  transcript,
  setTranscript,
  onGenerate,
  loading,
  apiBase,
  micEnabled,
}) {
  const canGenerate = transcript.trim().length > 0 && !loading;
  const [micError, setMicError] = useState("");

  // Auto-dismiss inline mic errors after ~4s
  useEffect(() => {
    if (!micError) return undefined;
    const id = setTimeout(() => setMicError(""), 4000);
    return () => clearTimeout(id);
  }, [micError]);

  const loadSample = () => {
    setTranscript(SAMPLES[mode] || "");
  };

  const appendTranscribed = (text) => {
    if (!text) return;
    setTranscript((prev) => {
      if (!prev) return text;
      const sep = prev.endsWith("\n") ? "" : "\n";
      return `${prev.trimEnd()}${sep ? "\n" : ""}${text}`;
    });
  };

  return (
    <main
      data-testid="input-screen"
      className="mx-auto w-full max-w-[720px] px-5 sm:px-8 pt-10 sm:pt-16 pb-24"
    >
      <div className="mb-8 sm:mb-10">
        <h1
          data-testid="input-title"
          className="text-[#0F172A] font-semibold tracking-tight"
          style={{ fontSize: "clamp(26px, 4.2vw, 30px)", letterSpacing: "-0.02em", lineHeight: 1.15 }}
        >
          What did you discuss?
        </h1>
        <p
          className="mt-2 text-[#475569]"
          style={{ fontSize: 15, lineHeight: 1.6 }}
        >
          Paste a transcript — or record the conversation live — and Karyo-Quill will turn it into a structured, ready-to-share record.
        </p>
      </div>

      <div className="mb-5">
        <label
          htmlFor="mode-select"
          className="block text-[13px] font-medium text-[#0F172A] mb-2 tracking-tight"
        >
          Mode
        </label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger
            id="mode-select"
            data-testid="mode-select-trigger"
            className="h-11 w-full bg-white border-[#E2E8F0] text-[#0F172A] text-[15px] rounded-xl shadow-sm hover:border-[#CBD5E1] transition-colors"
          >
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent
            data-testid="mode-select-content"
            className="bg-white border-[#E2E8F0]"
          >
            {MODES.map((m) => (
              <SelectItem
                key={m.value}
                value={m.value}
                data-testid={`mode-option-${m.value}`}
                className="text-[15px] text-[#0F172A] focus:bg-[#F1F5F9]"
              >
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-2">
        <label
          htmlFor="transcript-textarea"
          className="block text-[13px] font-medium text-[#0F172A] mb-2 tracking-tight"
        >
          Transcript
        </label>
        <div className="relative" data-testid="transcript-wrap">
          <textarea
            id="transcript-textarea"
            data-testid="transcript-textarea"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the conversation transcript…"
            rows={12}
            className="w-full resize-y rounded-2xl bg-white border border-[#E2E8F0] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15 outline-none px-5 py-4 pr-16 text-[15px] leading-[1.6] text-[#0F172A] placeholder:text-[#94A3B8] shadow-sm transition-colors"
            style={{ minHeight: 220 }}
          />
          {micEnabled && (
            <MicRecorder
              apiBase={apiBase}
              onTranscribed={appendTranscribed}
              onError={(msg) => setMicError(msg || "")}
              disabled={loading}
            />
          )}
        </div>
        {micError && (
          <p
            data-testid="mic-error"
            role="alert"
            className="mt-2 text-[13px] text-[#B91C1C] bg-[rgba(220,38,38,0.05)] border border-[rgba(220,38,38,0.18)] rounded-lg px-3 py-2"
          >
            {micError}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
        <button
          type="button"
          data-testid="load-sample-button"
          onClick={loadSample}
          className="inline-flex items-center justify-center gap-2 rounded-xl h-11 px-4 text-[14px] font-medium text-[#0F172A] bg-transparent hover:bg-[#EEF2F4] active:scale-[0.98] transition-all"
        >
          <FileText className="h-4 w-4 text-[#475569]" />
          Load sample
        </button>

        <Button
          data-testid="generate-button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="quill-primary inline-flex items-center justify-center gap-2 rounded-xl h-11 px-6 text-[15px] font-semibold tracking-tight"
        >
          {loading ? (
            <>
              <span className="quill-spinner" aria-hidden />
              Generating…
            </>
          ) : (
            <>
              Generate <Sparkles className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      <p className="mt-6 text-[12px] text-[#94A3B8]">
        Karyo-Quill drafts; you review and approve. Suggestions are never auto-applied.
      </p>
    </main>
  );
}
