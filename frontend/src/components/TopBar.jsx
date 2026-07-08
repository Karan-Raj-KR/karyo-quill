import React from "react";

export function TopBar() {
  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-30 w-full bg-[#F7F8FA]/85 backdrop-blur-md border-b border-[#E2E8F0]"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            data-testid="quill-wordmark"
            className="font-semibold tracking-tight text-[#0F172A]"
            style={{ fontSize: 20, letterSpacing: "-0.02em" }}
          >
            Quill
          </span>
          <span
            aria-hidden
            className="ml-1 h-1.5 w-1.5 rounded-full bg-[#0D9488]"
          />
        </div>
        <p
          data-testid="top-bar-tagline"
          className="hidden md:block text-[13px] text-[#475569]"
        >
          Turn any conversation into a finished record.
        </p>
      </div>
    </header>
  );
}
