import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import axios from "axios";

const MAX_RECORD_SECONDS = 300; // 5 minutes (hard cap)
const MIN_RECORD_MS = 1000; // < 1s is discarded
const WARN_BEFORE_SECONDS = 30; // soft "30s left" hint at 4:30

/** Pick a MediaRecorder mimeType supported by this browser. Chrome/FF prefer
 *  audio/webm;codecs=opus. Safari (iOS/macOS) typically only supports
 *  audio/mp4. Fall back to whatever is left, or null if none. */
function pickMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return null;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/aac",
    "audio/wav",
  ];
  for (const t of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(t)) return t;
    } catch (_e) {
      // ignore
    }
  }
  return null;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Mic recorder for the Quill input.
 *
 * Props:
 *  - apiBase: `${REACT_APP_BACKEND_URL}/api`
 *  - onTranscribed(text): called with the transcribed text on success
 *  - onError(message): called when something fails or recording is too short
 *  - disabled: hard-disable the button (e.g. while parent is busy)
 */
export function MicRecorder({ apiBase, onTranscribed, onError, disabled }) {
  const [state, setState] = useState("idle"); // idle | recording | transcribing
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const stoppedReasonRef = useRef("user"); // "user" | "too-short" | "max-length"

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (_e) { /* ignore */ }
      });
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cleanupStream, [cleanupStream]);

  const sendForTranscription = useCallback(async (blob, mime) => {
    setState("transcribing");
    const form = new FormData();
    // Use a generic filename — backend resolves extension from mimeType.
    const ext = (mime || "audio/webm").includes("mp4") ? "m4a" : "webm";
    form.append("audio", blob, `recording.${ext}`);
    form.append("mimeType", mime || "audio/webm");
    try {
      const res = await axios.post(`${apiBase}/transcribe`, form, {
        timeout: 70000,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const text = (res?.data?.text || "").trim();
      if (!text) {
        onError?.("No speech detected — try again.");
        setState("idle");
        return;
      }
      onTranscribed?.(text);
      setState("idle");
    } catch (err) {
      let msg = "Couldn't transcribe — try again.";
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 413) msg = "Recording too long (over 15 MB).";
      else if (status === 503) msg = "Mic transcription is disabled on the server.";
      else if (typeof detail === "string" && detail) msg = detail;
      else if (err?.code === "ECONNABORTED") msg = "Transcription timed out — try a shorter clip.";
      onError?.(msg);
      setState("idle");
    }
  }, [apiBase, onTranscribed, onError]);

  const finalizeRecording = useCallback(() => {
    cleanupStream();
    const reason = stoppedReasonRef.current;
    const durationMs = performance.now() - startedAtRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];

    if (reason === "too-short" || durationMs < MIN_RECORD_MS) {
      onError?.("Too short to transcribe — try again.");
      setState("idle");
      setElapsed(0);
      return;
    }
    if (chunks.length === 0) {
      onError?.("Nothing was recorded — try again.");
      setState("idle");
      setElapsed(0);
      return;
    }
    const blob = new Blob(chunks, { type: mimeTypeRef.current || "audio/webm" });
    setElapsed(0);
    sendForTranscription(blob, mimeTypeRef.current);
  }, [cleanupStream, onError, sendForTranscription]);

  const stopRecording = useCallback((reason = "user") => {
    stoppedReasonRef.current = reason;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch (_e) { /* ignore */ }
    } else {
      // No active recorder — treat as cancel
      finalizeRecording();
    }
  }, [finalizeRecording]);

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      onError?.("Recording isn't supported in this browser.");
      return;
    }
    const mime = pickMimeType();
    if (!mime) {
      onError?.("Recording isn't supported in this browser.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        onError?.("Microphone permission denied. Enable it in browser settings.");
      } else if (name === "NotFoundError") {
        onError?.("No microphone found on this device.");
      } else {
        onError?.("Couldn't access microphone.");
      }
      return;
    }

    streamRef.current = stream;
    mimeTypeRef.current = mime;
    chunksRef.current = [];
    stoppedReasonRef.current = "user";

    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (_e) {
      cleanupStream();
      onError?.("Recording isn't supported in this browser.");
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = finalizeRecording;
    recorder.onerror = () => {
      cleanupStream();
      onError?.("Recording error.");
      setState("idle");
      setElapsed(0);
    };

    startedAtRef.current = performance.now();
    setElapsed(0);
    setState("recording");
    try {
      recorder.start(1000); // 1s timeslices so we have chunks even on early stop
    } catch (_e) {
      cleanupStream();
      onError?.("Couldn't start recording.");
      setState("idle");
      return;
    }

    timerRef.current = setInterval(() => {
      const secs = Math.floor((performance.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_RECORD_SECONDS) {
        stopRecording("max-length");
      }
    }, 250);
  }, [state, cleanupStream, finalizeRecording, onError, stopRecording]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (state === "idle") {
      onError?.(""); // clear any prior error
      startRecording();
    } else if (state === "recording") {
      stopRecording("user");
    }
  }, [disabled, state, startRecording, stopRecording, onError]);

  const secsLeft = Math.max(0, MAX_RECORD_SECONDS - elapsed);
  const showWarn = state === "recording" && secsLeft <= WARN_BEFORE_SECONDS;

  return (
    <div className="quill-mic-wrap" data-state={state}>
      {state === "recording" && (
        <span data-testid="mic-timer" className="quill-mic-timer">
          <span className="quill-mic-pulse-dot" aria-hidden />
          {fmtTime(elapsed)}
        </span>
      )}
      {showWarn && (
        <span data-testid="mic-warn" className="quill-mic-warn">
          {secsLeft}s left
        </span>
      )}
      <button
        type="button"
        data-testid="mic-button"
        data-state={state}
        onClick={handleClick}
        disabled={disabled || state === "transcribing"}
        aria-label={
          state === "recording"
            ? "Stop recording"
            : state === "transcribing"
            ? "Transcribing"
            : "Record conversation"
        }
        title={
          state === "recording"
            ? "Stop recording"
            : state === "transcribing"
            ? "Transcribing…"
            : "Record conversation"
        }
        className={`quill-mic-btn quill-mic-btn-${state}`}
      >
        {state === "transcribing" ? (
          <Loader2 className="quill-mic-icon quill-mic-icon-spin" />
        ) : state === "recording" ? (
          <Square className="quill-mic-icon" />
        ) : (
          <Mic className="quill-mic-icon" />
        )}
      </button>
    </div>
  );
}
