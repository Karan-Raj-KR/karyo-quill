import React, { useMemo } from "react";
import { AlertTriangle, Check, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";

const RISK_KEYWORDS = ["interaction", "drug", "allergy"];

function isHighRisk(flags) {
  const joined = (flags || []).join(" ").toLowerCase();
  return RISK_KEYWORDS.some((kw) => joined.includes(kw));
}

function StaggerCard({ index, children, testId, className = "" }) {
  return (
    <div
      data-testid={testId}
      className={`quill-stagger bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 quill-card-shadow ${className}`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {children}
    </div>
  );
}

export function ResultScreen({
  transcript,
  result,
  approved,
  setApproved,
  onExport,
  onNew,
}) {
  const highRisk = useMemo(() => isHighRisk(result.flags), [result.flags]);
  const accentColor = highRisk ? "#DC2626" : "#F59E0B";
  const accentSoftBg = highRisk
    ? "rgba(220, 38, 38, 0.06)"
    : "rgba(245, 158, 11, 0.07)";

  // Stagger order: gap check first (most important), then sections, then suggestions
  const sectionCount = result.sections?.length || 0;
  const gapIdx = 0;
  const sectionStart = 1;
  const suggestionsIdx = sectionStart + sectionCount;

  return (
    <main
      data-testid="result-screen"
      className="mx-auto w-full max-w-[1200px] px-5 sm:px-8 pt-6 sm:pt-8 pb-24"
    >
      {/* Header: title + actions */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <button
            type="button"
            data-testid="new-button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#475569] hover:text-[#0F172A] transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            New
          </button>
          <h2
            data-testid="document-title"
            className="text-[#0F172A] font-semibold tracking-tight truncate"
            style={{ fontSize: "clamp(22px, 3vw, 26px)", letterSpacing: "-0.02em" }}
          >
            {result.documentTitle}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!approved ? (
            <Button
              data-testid="approve-button"
              onClick={() => setApproved(true)}
              className="quill-primary inline-flex items-center gap-2 rounded-xl h-10 px-4 text-[14px] font-semibold"
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          ) : (
            <span
              data-testid="approved-pill"
              className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12px] font-medium text-[#0D9488]"
              style={{ background: "rgba(13,148,136,0.1)" }}
            >
              <Check className="h-3.5 w-3.5" />
              Approved
            </span>
          )}
          <Button
            data-testid="export-button"
            disabled={!approved}
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl h-10 px-4 text-[14px] font-semibold bg-[#0F172A] text-white hover:bg-[#1E293B] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] active:scale-[0.98] transition-all"
          >
            {result.exportLabel}
          </Button>
        </div>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6">
        {/* Left: transcript */}
        <aside
          data-testid="transcript-panel"
          className="bg-white border border-[#E2E8F0] rounded-2xl quill-card-shadow"
        >
          <div className="px-5 pt-5 pb-3 border-b border-[#E2E8F0]">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#94A3B8]">
              Original transcript
            </p>
          </div>
          <div
            data-testid="transcript-content"
            className="px-5 py-4 max-h-[68vh] lg:max-h-[calc(100vh-220px)] overflow-y-auto whitespace-pre-wrap text-[14px] leading-[1.75] text-[#64748B]"
          >
            {transcript}
          </div>
        </aside>

        {/* Right: generated record cards (staggered) */}
        <section
          data-testid="record-panel"
          className="flex flex-col gap-4"
        >
          {/* Gap check (headline element) */}
          <StaggerCard
            index={gapIdx}
            testId="gap-check-card"
            className="relative overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
              style={{ background: accentColor }}
            />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{ background: accentSoftBg }}
            />
            <div className="relative pl-3">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: highRisk ? "rgba(220,38,38,0.12)" : "rgba(245,158,11,0.15)" }}
                >
                  <AlertTriangle
                    className="h-[18px] w-[18px]"
                    style={{ color: accentColor }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: accentColor }}
                  >
                    {highRisk ? "Risk — review carefully" : "Gap check"}
                  </p>
                  <h3 className="text-[#0F172A] font-semibold tracking-tight" style={{ fontSize: 17 }}>
                    Items that need your attention
                  </h3>
                </div>
              </div>
              <ul
                data-testid="gap-check-list"
                className="space-y-2 pl-12"
              >
                {result.flags.map((flag, i) => (
                  <li
                    key={i}
                    data-testid={`gap-flag-${i}`}
                    className="text-[14px] leading-[1.6] text-[#0F172A] relative pl-4"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.65em] h-1.5 w-1.5 rounded-full"
                      style={{ background: accentColor }}
                    />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          </StaggerCard>

          {/* Sections */}
          {result.sections.map((s, i) => (
            <StaggerCard
              key={i}
              index={sectionStart + i}
              testId={`section-card-${i}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#94A3B8] mb-1.5">
                {s.heading.includes("ICD-10") ? "Codes" : "Section"}
              </p>
              <h3
                className="text-[#0F172A] font-semibold tracking-tight mb-2"
                style={{ fontSize: 17 }}
              >
                {s.heading}
              </h3>
              {s.heading.includes("ICD-10") ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {s.content.split(";").map((code, ci) => {
                    const trimmed = code.trim();
                    if (!trimmed) return null;
                    return (
                      <span
                        key={ci}
                        data-testid={`icd-pill-${ci}`}
                        className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium"
                        style={{
                          background: "rgba(13,148,136,0.1)",
                          color: "#0D9488",
                        }}
                      >
                        {trimmed}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[14px] leading-[1.7] text-[#475569]">
                  {s.content}
                </p>
              )}
            </StaggerCard>
          ))}

          {/* Suggestions */}
          <StaggerCard index={suggestionsIdx} testId="suggestions-card">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-[#0F172A] font-semibold tracking-tight"
                style={{ fontSize: 17 }}
              >
                Suggestions
              </h3>
              <span className="text-[11px] text-[#94A3B8] tracking-wide">
                Suggestions — pending human approval.
              </span>
            </div>
            <ul data-testid="suggestions-list" className="space-y-3">
              {result.suggestions.map((sg, i) => (
                <li
                  key={i}
                  data-testid={`suggestion-${i}`}
                  className="rounded-xl border border-[#E2E8F0] bg-[#FBFCFD] p-3.5"
                >
                  <p className="text-[14px] font-semibold text-[#0F172A] tracking-tight mb-0.5">
                    {sg.label}
                  </p>
                  <p className="text-[13.5px] leading-[1.6] text-[#475569]">
                    {sg.detail}
                  </p>
                </li>
              ))}
            </ul>
          </StaggerCard>
        </section>
      </div>
    </main>
  );
}
