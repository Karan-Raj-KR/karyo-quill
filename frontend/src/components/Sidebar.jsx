import React from "react";
import { Plus } from "lucide-react";

export const MOCK_SESSIONS = [
  { id: 1, initials: "JS", date: "Oct 12", status: "amber" },
  { id: 2, initials: "AM", date: "Oct 12", status: "red" },
  { id: 3, initials: "RC", date: "Oct 11", status: "green" },
  { id: 4, initials: "KL", date: "Oct 10", status: "green" },
  { id: 5, initials: "TB", date: "Oct 09", status: "amber" },
];

const StatusDot = ({ status }) => {
  const colors = {
    red: "bg-[#ef4444]",
    amber: "bg-[#f59e0b]",
    green: "bg-[#10b981]",
  };
  return (
    <span 
      className={`block w-2 h-2 rounded-full ${colors[status] || colors.green}`} 
      aria-hidden="true"
    />
  );
};

export function Sidebar({ onNew, onSelectSession }) {
  return (
    <aside className="quill-sidebar">
      <button 
        onClick={onNew}
        className="w-full flex items-center gap-2 justify-center bg-[var(--quill-accent)] text-white font-medium rounded-lg px-4 py-2.5 shadow-sm transition-all hover:bg-[var(--quill-accent-hover)] active:scale-[0.98] mb-8"
      >
        <Plus className="w-4 h-4" />
        New Note
      </button>

      <div className="flex-1">
        <h3 className="text-[11px] font-semibold text-[var(--quill-muted)] uppercase tracking-wider mb-3 px-2">
          Recent Sessions
        </h3>
        <ul className="space-y-1">
          {MOCK_SESSIONS.map((session) => (
            <li 
              key={session.id} 
              onClick={() => onSelectSession && onSelectSession(session.id)}
              className="quill-sidebar-item"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--quill-border)] flex items-center justify-center text-[11px] font-medium text-[var(--quill-ink)]">
                  {session.initials}
                </div>
                <span className="text-[14px] font-medium text-[var(--quill-body)]">
                  {session.date}
                </span>
              </div>
              <StatusDot status={session.status} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
