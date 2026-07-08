import React from "react";
import { Activity } from "lucide-react";

export function TopBar() {
  return (
    <header data-testid="top-bar" className="quill-app-header">
      <div className="flex items-center gap-3">
        <span
          data-testid="quill-wordmark"
          className="font-display font-semibold tracking-tight text-[var(--quill-ink)]"
          style={{ fontSize: 22, letterSpacing: "-0.02em" }}
        >
          Karyo-Quill
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--quill-border)]/50 border border-[var(--quill-border)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-medium text-[var(--quill-body)] uppercase tracking-wider">
            Connected
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[14px] font-medium text-[var(--quill-ink)]">
          Dr. A. Mehta
        </span>
        <div className="w-8 h-8 rounded-full bg-[var(--quill-border)] flex items-center justify-center">
          <span className="text-[13px] font-medium text-[var(--quill-body)]">AM</span>
        </div>
      </div>
    </header>
  );
}
