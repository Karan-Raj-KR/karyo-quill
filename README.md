# Quill: Universal AI Scribe 🪶

**Quill** is a web-first application designed to transform raw conversation transcripts into structured, actionable records. It acts as an intelligent AI scribe for professionals across various industries, saving time and preventing critical documentation errors.

**[Live Demo](https://frontend-theta-six-9b54d8ggbk.vercel.app)** 

## 🚀 What is Quill?

Quill is a modern, web-based AI assistant. Instead of relying on manual note-taking during or after a conversation, Quill takes a raw, unstructured transcript of a conversation and automatically synthesizes it into a highly structured, formatted document. It is built as a single-page application (SPA) that prioritizes speed, clarity, and an exceptional user experience.

## ✨ What Can It Do?

Quill is versatile and operates across **four distinct modes**, each tailored to a specific professional workflow:

*   🏥 **Clinical Mode (Default):** Designed for healthcare. It takes a doctor-patient transcript and generates a formal clinical note, suggests relevant ICD-10 medical billing codes, and prepares a ready-to-print prescription.
*   🤝 **Sales Mode:** Designed for account executives and sales reps. It analyzes a discovery call and produces a comprehensive recap, along with a polished, draftable follow-up email that can be copied in a single click.
*   👔 **Interview Mode:** Designed for recruiters and hiring managers. It evaluates candidate interview notes and creates a structured candidate scorecard with clear recommendations for the next round.
*   📋 **Intake Mode:** Designed for agencies and service businesses. It converts a client intake conversation into a project brief, outlining goals, deliverables, and timelines.

## 💡 The Problem We Solve

Professionals across all industries suffer from the same operational bottleneck: **administrative overhead and manual data entry.**
After a 30-minute meeting, professionals often spend another 15 minutes formatting notes, drafting emails, or filling out electronic health records (EHR). 

Furthermore, human error leads to **critical omissions**. A doctor might forget to document a patient's allergy history, or a sales rep might end a call without clarifying the client's budget. Quill solves this by instantly doing the heavy lifting of documentation while acting as a safeguard that actively scans for missing, critical information.

## 🔍 Key Features & The "Gap Check"

The defining feature of Quill is its intelligent **Gap-Check system**. Instead of just summarizing text, Quill evaluates what is *missing* or *risky* in a conversation. The Gap-Check card visually dominates the user interface to ensure critical flags are never missed.

*   🛑 **Red Flags (Critical Risks):** In clinical mode, if the AI detects that a drug interaction or allergy history was NOT discussed, it highlights this as a severe risk with a red accent.
*   ⚠️ **Amber Flags (Missing Information):** In sales or interview modes, if a key metric like "budget" or "salary expectations" is missing from the transcript, Quill surfaces an amber warning so the user knows what to follow up on.

**Other features include:**
*   **Staggered Card Reveals:** A sleek UI animation where information cards slide in sequentially, providing a premium feel.
*   **One-Click Exports:** The ability to immediately trigger a native `window.print()` for a medical prescription, or copy an email body directly to the clipboard.

## 🛠️ The Technical Solution

Quill achieves this through a modern, decoupled architecture:

### Frontend (React SPA)
A responsive two-screen React application (Input Screen & Result Screen) styled with Tailwind CSS. It uses a refined design system (inter font, specific color palettes like teal accents and slate text) to present the data beautifully. 

### Backend (Python FastAPI)
A robust Python backend that securely handles the AI processing. It receives the transcript and mode, then communicates with **Claude Sonnet 4.5** (via an integration layer). 

### Strict AI Prompting
The solution's magic lies in its strict LLM instructions. The AI is forced to return data in a highly rigid JSON schema containing exactly what the frontend expects: `documentTitle`, `sections`, `suggestions`, `flags`, and `exportLabel`. If the AI hallucinates or breaks the schema, the backend gracefully falls back to reliable, hardcoded seed data to ensure the UI never crashes in front of the user.

## 💻 Local Development Setup

To run Quill locally, you'll need both the frontend and backend running.

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export MONGO_URL="mongodb://localhost:27017" # Dummy or actual connection
export DB_NAME="quill"
uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

### 2. Frontend Setup

In a new terminal:

```bash
cd frontend
npx yarn install
export PORT=3001
export REACT_APP_BACKEND_URL="http://localhost:8001"
npx yarn start
```
The application will open in your browser at `http://localhost:3001`.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
