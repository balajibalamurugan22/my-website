# LIFEGENIE – Your Life, Your AI! 🚀

A modern, full-featured AI web application built with a futuristic cyber-dark aesthetic, powered by Google's latest **Gemini API**.

![LIFEGENIE Cyber AI Assistant](https://img.shields.io/badge/Powered%20by-Google%20Gemini-00f0ff?style=for-the-badge&logo=google)
![Status](https://img.shields.io/badge/Status-Production%20Ready-10b981?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Express%20%7C%20HTML5%20%2F%20CSS3%20%2F%20JS-7c3aed?style=for-the-badge)

---

## 🌟 Key Features

### 1. 🌌 Futuristic Cybernetic Dashboard
- **Dark Navy & Void Black** aesthetic with glowing Neon Cyan (`#00f0ff`) and Electric Purple (`#8b5cf6`) accents.
- **Animated 3D Quantum AI Core** rendered on HTML5 Canvas with orbital rings, floating quantum particles, and reactive energy states (`idle`, `thinking`, `speaking`).
- **Cyber-Glassmorphism** cards with backdrop blur, radiant borders, and smooth hover physics.
- **Ambient Web Audio Synthesizer**: Generates interactive sci-fi audio effects without external MP3 dependencies (can be toggled in Settings or Header).
- **Theme Switcher**: Instant switch between **Cyber Dark Void** and **Polar Ice Light**.

### 2. 💬 AI Assistant (Conversational Core)
- Real-time conversation powered by Google Gemini (`gemini-2.5-flash`, `gemini-1.5-flash`, or `gemini-1.5-pro`).
- Multi-turn conversation context memory.
- Full **Markdown rendering** (tables, lists, blockquotes, bold/italic) with **Highlight.js** code syntax highlighting.
- One-click copy buttons for responses and code blocks.
- Chat session manager: Save, switch, rename, and clear conversations stored in `localStorage`.
- Keyboard shortcuts: `Enter` to send, `Shift + Enter` for new lines.

### 3. 📚 Study Genie (Academic Mastery)
- **Concept Explainer**: In-depth concept breakdown with analogies, mechanics, and self-checks.
- **Interactive Quiz Master**: Automatically creates 4-8 question multiple-choice quizzes with clickable answers, instant feedback (green/red), explanations, and live score tallying.
- **Timetable Builder**: Generates balanced, Pomodoro-paced study schedules with break intervals and daily milestones.
- **ELI5 Simple Explainer**: Explains difficult or confusing topics in 5-year-old language with clear metaphors.

### 4. 💡 Idea Generator (Vision & Innovation)
- Categories: **Startup & Inventions**, **Game Development Projects & Mechanics**, **AI & Deep Tech**, **Mobile & Web Apps**, **Creative Content & Media**.
- Customizable vibe profiles: *Disruptive & High-Tech*, *Fun & Addictive*, *Practical & High Revenue*, *Futuristic Moonshot*.
- Formats each idea with: *The Problem*, *The Innovation*, *Core Features*, *Monetization & Impact*, and *First Action Step*.
- One-click **Save to Favorites** library with persistent local storage.

### 5. ✍️ Writing Assistant (Author & Editor Studio)
- Modes: **Comprehensive Essay**, **Creative Story**, **Professional Email / Letter**, **Grammar & Polish**, **Rewrite & Tone Shifter**.
- Tone selector: *Professional & Executive*, *Academic & Rigorous*, *Persuasive & Compelling*, *Creative & Atmospheric*, *Casual & Friendly*.
- Live word and character counter.
- One-click copy and **Export as Markdown (.md)** download.

### 6. 🎯 Goal Planner (Execution Roadmap)
- Create goals with categories, target deadlines, priorities, and descriptions.
- **✨ AI Generate Action Steps**: Uses Gemini to analyze your goal and break it down into realistic step-by-step milestone checklists!
- Dynamic progress calculation and glowing neon progress bar that updates in real-time as milestones are checked off.
- Filter by *All*, *In Progress*, and *Completed*.
- LocalStorage persistence.

### 7. ⚙️ Settings & Secure API Management
- **Never exposes API keys in client-side code**: Backend proxy endpoint securely relays requests.
- Configure API key via `.env` or directly through the **Settings Modal** in the UI with instant connection testing.
- Switch between Gemini models (`gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`).
- Adjustable temperature / creativity slider (0.0 to 1.0).
- Custom System Prompt modifier.

---

## 🛠️ Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ or v24+ recommended).
- **Google Gemini API Key**: Free to obtain from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Open `.env` and add your Google Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
DEFAULT_MODEL=gemini-2.5-flash
```

> **Note**: You can also enter or test your Gemini API Key directly in the web application under **Settings** ⚙️ at any time!

### 3. Start the Server
```bash
npm start
```
Or for auto-reload during development:
```bash
npm run dev
```

### 4. Launch the Web Application
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📁 Project Structure

```
life genie/
├── .env.example              # Template environment variables
├── .gitignore                # Git exclusions
├── package.json              # Dependencies and scripts
├── server.js                 # Secure Express backend with Gemini API proxy
├── README.md                 # Complete documentation
└── public/                   # Static frontend application
    ├── index.html            # Main dashboard shell & view containers
    ├── css/
    │   └── style.css         # Futuristic cyber theme & responsive layouts
    └── js/
        ├── app.js            # App orchestrator & navigation
        ├── api.js            # Frontend HTTP client for backend endpoints
        ├── audio.js          # Web Audio API sound synthesizer
        ├── core-visualizer.js# Canvas 3D quantum AI core visualizer
        ├── chat.js           # AI Assistant chat & markdown renderer
        ├── study.js          # Study Genie & interactive quiz master
        ├── ideas.js          # Idea Generator & favorites manager
        ├── writing.js        # Writing Assistant & markdown exporter
        ├── goals.js          # Goal Planner with AI milestone breakdown
        └── settings.js       # System settings & API key validator
```

---

## 🔒 Security Best Practices

1. **Backend Relay**: All Gemini API calls originate strictly from `server.js`.
2. **Zero Client Leakage**: The client never makes direct requests to Google's endpoints with API keys embedded in static scripts.
3. **Flexible Key Override**: Users can test their personal key via the Settings modal, which is sent via secure custom HTTP headers (`x-gemini-api-key`) directly to the local backend.

---

## 📱 Mobile & Responsive Support

LIFEGENIE is engineered with mobile-first media queries:
- **Desktop & Laptops**: Multi-column split layout with glassmorphism workspace.
- **Tablets & Mobile Phones**: Auto-collapsing sidebar accessible via animated hamburger menu, touch-friendly interactive targets, and auto-scrolling message streams.

---

## 📄 License
ISC License. Built for explorers everywhere!

