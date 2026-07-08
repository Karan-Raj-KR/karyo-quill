import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import "./App.css";
import { TopBar } from "./components/TopBar";
import { InputScreen } from "./components/InputScreen";
import { ResultScreen } from "./components/ResultScreen";
import { PrintView } from "./components/PrintView";
import { Sidebar } from "./components/Sidebar";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API = `${BACKEND_URL}/api`;

const SCREENS = {
  INPUT: "input",
  RESULT: "result",
  PRINT: "print",
};

const MOCK_SESSION_TRANSCRIPTS = {
  1: "Patient (JS): Throat's been hurting since Monday. Had a fever too.\nDoctor: Any difficulty swallowing or breathing?\nPatient: Swallowing, yes. Breathing is fine. Just feel very worn out.",
  2: "Patient (AM): Experiencing a lot of chest congestion and coughing up thick green phlegm. No chest pain.\nDoctor: Let's check your lungs. Take deep breaths. I hear some rhonchi. Lungs sound congested.\nPatient: Do I need an inhaler or antibiotics?",
  3: "Patient (RC): Here for a routine check-up. Feeling healthy overall. No complaints.\nDoctor: Blood pressure is 120/80. Heart rate is 72. Chest is clear. Everything looks great.\nPatient: Perfect, thanks doctor.",
  4: "Patient (KL): Broke out in hives this morning after eating peanut butter cookies.\nDoctor: Hives are widespread on both arms. Any tongue swelling or throat tightness?\nPatient: No, just really itchy skin.",
  5: "Patient (TB): Bad headache for 3 days. Light makes it worse.\nDoctor: Any nausea or vomiting? Any visual changes?\nPatient: A bit nauseous, yes. No aura.",
};

const MOCK_SESSION_RESULTS = {
  1: {
    documentTitle: "Clinical Note — John Smith (Acute Pharyngitis)",
    sections: [
      { heading: "Subjective", content: "John Smith reports a severe sore throat and fatigue for 2 days. Describes swallowing discomfort. Denies shortness of breath." },
      { heading: "Objective", content: "Tonsils swollen with mild erythema. Lungs clear. Blood pressure not recorded." },
      { heading: "Assessment", content: "Acute pharyngitis, viral vs bacterial." },
      { heading: "Plan", content: "Rest, hydration, and salt water gargles. Advise return if symptoms persist beyond 5 days." },
      { heading: "ICD-10 Codes", content: "J02.9 — Acute pharyngitis, unspecified" }
    ],
    suggestions: [
      { label: "Paracetamol", detail: "500 mg PO QID PRN for pain or fever." },
      { label: "Throat lozenges", detail: "Use every 3 hours PRN for soreness." }
    ],
    flags: [
      "Blood pressure not recorded this visit",
      "Allergy history not confirmed"
    ],
    exportLabel: "Print prescription"
  },
  2: {
    documentTitle: "Clinical Note — Alice Miller (Acute Bronchitis)",
    sections: [
      { heading: "Subjective", content: "Alice reports cough with productive green sputum for 5 days. Denies chest pain or dyspnea." },
      { heading: "Objective", content: "Temp 37.9°C. Rhonchi heard bilaterally. O2 sat 98% on room air." },
      { heading: "Assessment", content: "Acute bronchitis, likely viral." },
      { heading: "Plan", content: "Supportive therapy, fluids, rest. Return if dyspnea or high fever develops." },
      { heading: "ICD-10 Codes", content: "J20.9 — Acute bronchitis, unspecified" }
    ],
    suggestions: [
      { label: "Guaifenesin", detail: "600 mg PO BID for congestion. Take with plenty of water." },
      { label: "Albuterol inhaler", detail: "1-2 puffs QID PRN for wheezing." }
    ],
    flags: [
      "Severe risk of medication interaction with current warfarin prescription",
      "Blood pressure not recorded this visit"
    ],
    exportLabel: "Print prescription"
  },
  3: {
    documentTitle: "Clinical Note — Robert Chen (Routine Wellness)",
    sections: [
      { heading: "Subjective", content: "Robert presents for an annual wellness exam. Reports feeling well. Active lifestyle." },
      { heading: "Objective", content: "BP 120/80. HR 72. Lungs clear. Heart regular rate and rhythm." },
      { heading: "Assessment", content: "Healthy adult wellness exam." },
      { heading: "Plan", content: "Continue healthy lifestyle. Recommended screening labs ordered." },
      { heading: "ICD-10 Codes", content: "Z00.00 — Encounter for general adult medical examination" }
    ],
    suggestions: [
      { label: "Routine Labs", detail: "CBC, CMP, Lipid panel ordered." }
    ],
    flags: [],
    exportLabel: "Print prescription"
  },
  4: {
    documentTitle: "Clinical Note — Karen Lee (Acute Urticaria)",
    sections: [
      { heading: "Subjective", content: "Karen reports sudden onset of generalized hives after cookie ingestion. Denies dyspnea." },
      { heading: "Objective", content: "Diffuse erythematous wheals on bilateral upper extremities. Swelling absent." },
      { heading: "Assessment", content: "Acute urticaria, secondary to suspected food allergy." },
      { heading: "Plan", content: "Avoid suspected allergen. Take antihistamines. Go to ER if airway compromise occurs." },
      { heading: "ICD-10 Codes", content: "L50.0 — Allergic urticaria" }
    ],
    suggestions: [
      { label: "Cetirizine", detail: "10 mg PO daily for hives." },
      { label: "EpiPen Auto-Injector", detail: "Carry at all times for emergency use if airway tightness occurs." }
    ],
    flags: [
      "Food allergen details not fully logged in history",
      "Blood pressure not recorded this visit"
    ],
    exportLabel: "Print prescription"
  },
  5: {
    documentTitle: "Clinical Note — Thomas Brown (Migraine)",
    sections: [
      { heading: "Subjective", content: "Thomas reports severe throbbing headache with photophobia and nausea for 3 days." },
      { heading: "Objective", content: "Neurological exam normal. Light sensitivity noted." },
      { heading: "Assessment", content: "Acute migraine headache without aura." },
      { heading: "Plan", content: "Rest in a quiet, dark room. Limit caffeine." },
      { heading: "ICD-10 Codes", content: "G43.909 — Migraine, unspecified, not intractable, without status migrainosus" }
    ],
    suggestions: [
      { label: "Sumatriptan", detail: "50 mg PO at onset of headache. May repeat in 2 hours once if needed." }
    ],
    flags: [
      "Blood pressure not recorded this visit"
    ],
    exportLabel: "Print prescription"
  },
};

function composeExportBody(result) {
  const sectionLines = result.sections
    .map((s) => `${s.heading}\n${s.content}`)
    .join("\n\n");
  const suggestionLines = result.suggestions
    .map((s) => `• ${s.label} — ${s.detail}`)
    .join("\n");
  return `${result.documentTitle}\n\n${sectionLines}\n\nSuggestions\n${suggestionLines}\n`;
}

function App() {
  const [screen, setScreen] = useState(SCREENS.INPUT);
  const [mode, setMode] = useState("clinical");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [approved, setApproved] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);

  // Fetch server feature flags once on mount.
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/config`, { timeout: 6000 })
      .then((res) => {
        if (!cancelled) setMicEnabled(Boolean(res?.data?.enableMic));
      })
      .catch(() => {
        if (!cancelled) setMicEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/generate`, {
        transcript,
        mode,
      });
      setResult(res.data);
      setApproved(false);
      setScreen(SCREENS.RESULT);
    } catch (err) {
      console.error("Generate failed:", err);
      toast.error("Couldn't generate record. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [transcript, mode]);

  const handleNew = useCallback(() => {
    setScreen(SCREENS.INPUT);
    setTranscript("");
    setResult(null);
    setApproved(false);
    setMode("clinical");
  }, []);

  const handleSelectSession = useCallback((sessionId) => {
    const mockRes = MOCK_SESSION_RESULTS[sessionId];
    const mockTx = MOCK_SESSION_TRANSCRIPTS[sessionId];
    if (mockRes) {
      setResult(mockRes);
      setTranscript(mockTx || "");
      setApproved(false);
      setScreen(SCREENS.RESULT);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!result || !approved) return;

    if (mode === "clinical") {
      setScreen(SCREENS.PRINT);
      return;
    }

    const body = composeExportBody(result);
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Copied", { duration: 2000 });
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = body;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        toast.success("Copied", { duration: 2000 });
      } catch (e) {
        toast.error("Copy failed — please select and copy manually.");
      } finally {
        document.body.removeChild(ta);
      }
    }
  }, [result, approved, mode]);

  return (
    <div data-testid="quill-app" className="quill-app quill-app-shell">
      {screen !== SCREENS.PRINT && <TopBar />}
      
      {screen === SCREENS.PRINT ? (
        <PrintView result={result} onExit={() => setScreen(SCREENS.RESULT)} />
      ) : (
        <div className="quill-app-body">
          <Sidebar onNew={handleNew} onSelectSession={handleSelectSession} />
          
          <div className="quill-main">
            {screen === SCREENS.INPUT && (
              <InputScreen
                mode={mode}
                setMode={setMode}
                transcript={transcript}
                setTranscript={setTranscript}
                onGenerate={handleGenerate}
                loading={loading}
                apiBase={API}
                micEnabled={micEnabled}
              />
            )}
      
            {screen === SCREENS.RESULT && result && (
              <ResultScreen
                transcript={transcript}
                result={result}
                approved={approved}
                setApproved={setApproved}
                onExport={handleExport}
                onNew={handleNew}
              />
            )}
          </div>
        </div>
      )}

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#0F172A",
            color: "#FFF",
            border: "1px solid #1E293B",
          },
        }}
      />
    </div>
  );
}

export default App;
