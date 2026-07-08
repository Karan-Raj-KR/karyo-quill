import React, { useEffect, useState } from "react";
import { Sparkles, FileText, ChevronRight } from "lucide-react";
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

  const currentModeLabel = MODES.find((m) => m.value === mode)?.label || "Clinical Mode";

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
    <main data-testid="input-screen" className="w-full max-w-4xl mx-auto">
      
      {/* Breadcrumb Context */}
      <div className="flex items-center gap-2 mb-6 text-[13px] font-medium text-[var(--quill-muted)]">
        <span>Workspace</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span>New Session</span>
        <span className="mx-1.5 opacity-50">·</span>
        <span className="text-[var(--quill-accent)]">{currentModeLabel}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Context / Value Props */}
        <div className="lg:w-[280px] flex-shrink-0 pt-2">
          <h1
            data-testid="input-title"
            className="font-display text-[var(--quill-ink)] font-bold tracking-tight mb-3"
            style={{ fontSize: "clamp(28px, 4vw, 34px)", lineHeight: 1.15 }}
          >
            Capture Context. Catch Risks.
          </h1>
          <p className="text-[15px] leading-[1.6] text-[var(--quill-body)] mb-6">
            Paste your raw transcript or record live. Karyo-Quill automatically structures your clinical notes and actively scans for critical omissions or risks.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-[var(--quill-border)] flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <div className="text-[13px]">
                <strong className="block text-[var(--quill-ink)] font-semibold">HIPAA-conscious design</strong>
                <span className="text-[var(--quill-body)]">No data is permanently stored.</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-[var(--quill-border)] flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-400 text-xs">✓</span>
              </div>
              <div className="text-[13px]">
                <strong className="block text-[var(--quill-ink)] font-semibold">Active Gap-Check</strong>
                <span className="text-[var(--quill-body)]">Flags missing vital information.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: The Form Card */}
        <div className="flex-1 quill-card rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <label
              htmlFor="mode-select"
              className="block text-[13px] font-semibold text-[var(--quill-ink)] mb-2 uppercase tracking-wide"
            >
              Mode
            </label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger
                id="mode-select"
                data-testid="mode-select-trigger"
                className="h-12 w-full bg-[var(--quill-bg)] border-[var(--quill-border)] text-[var(--quill-ink)] text-[15px] rounded-xl shadow-sm focus:border-[var(--quill-border-focus)] transition-colors"
              >
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent
                data-testid="mode-select-content"
                className="bg-[var(--quill-card)] border-[var(--quill-border)] text-[var(--quill-ink)]"
              >
                {MODES.map((m) => (
                  <SelectItem
                    key={m.value}
                    value={m.value}
                    data-testid={`mode-option-${m.value}`}
                    className="text-[15px] focus:bg-[var(--quill-bg)]"
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-4">
            <label
              htmlFor="transcript-textarea"
              className="block text-[13px] font-semibold text-[var(--quill-ink)] mb-2 uppercase tracking-wide"
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
                rows={10}
                className="w-full resize-y rounded-xl bg-[var(--quill-bg)] border border-[var(--quill-border)] focus:border-[var(--quill-accent)] focus:ring-2 focus:ring-[var(--quill-accent-soft)] outline-none px-5 py-4 pr-16 text-[15px] leading-[1.6] text-[var(--quill-ink)] placeholder:text-[var(--quill-muted)] shadow-inner transition-all duration-200"
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
                className="mt-2 text-[13px] text-[var(--quill-red)] bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.18)] rounded-lg px-3 py-2"
              >
                {micError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-8 pt-6 border-t border-[var(--quill-border)]">
            <button
              type="button"
              data-testid="load-sample-button"
              onClick={loadSample}
              className="inline-flex items-center justify-center gap-2 rounded-xl h-11 px-4 text-[14px] font-medium text-[var(--quill-body)] bg-transparent hover:text-[var(--quill-ink)] hover:bg-[var(--quill-border)] active:scale-[0.98] transition-all"
            >
              <FileText className="h-4 w-4 opacity-70" />
              Load sample
            </button>

            <Button
              data-testid="generate-button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className="quill-primary inline-flex items-center justify-center gap-2 rounded-xl h-12 px-8 text-[15px] font-semibold tracking-wide"
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
        </div>
      </div>
      
      <p className="mt-8 text-center text-[12px] text-[var(--quill-muted)]">
        Karyo-Quill drafts; you review and approve. Suggestions are never auto-applied.
      </p>
    </main>
  );
}
