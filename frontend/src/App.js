import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import "./App.css";
import { TopBar } from "./components/TopBar";
import { InputScreen } from "./components/InputScreen";
import { ResultScreen } from "./components/ResultScreen";
import { PrintView } from "./components/PrintView";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API = `${BACKEND_URL}/api`;

const SCREENS = {
  INPUT: "input",
  RESULT: "result",
  PRINT: "print",
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

  const handleExport = useCallback(async () => {
    if (!result || !approved) return;

    if (mode === "clinical") {
      setScreen(SCREENS.PRINT);
      return;
    }

    // Other modes: copy composed body to clipboard
    const body = composeExportBody(result);
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Copied", { duration: 2000 });
    } catch (err) {
      // Fallback: select-and-copy via temp textarea
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
    <div data-testid="quill-app" className="quill-app min-h-screen bg-[#F7F8FA]">
      {screen !== SCREENS.PRINT && <TopBar />}

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

      {screen === SCREENS.PRINT && result && (
        <PrintView result={result} onExit={() => setScreen(SCREENS.RESULT)} />
      )}

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#0F172A",
            color: "#F8FAFC",
            border: "1px solid #1E293B",
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}

export default App;
