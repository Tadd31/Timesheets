# ⏱️ Timesheet Recorder

A modern, offline-first timesheet and project tracking application built with React, TypeScript, and Tailwind CSS. Designed with a clean, Notion-inspired aesthetic, **Timesheet Recorder** features real-time Google Sheets synchronization, project budget monitoring, agency directory management, caffeine counters, and printable executive weekly reports.

![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg)
![React](https://img.shields.io/badge/React-19-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)

---

## ✨ Features

- **⏱️ Time & Entry Logging**: Log hours worked per project, add detailed work notes, assign tags (*Frontend, Backend, Design, Meeting, Research*), and track caffeine consumption.
- **📊 Project & Budget Analytics**: Define project rates (hourly or day rates), set target budgets, monitor burn-rate alerts, and visualize time allocation using interactive Recharts.
- **🟩 Google Sheets Live Sync**: Bi-directional integration with Google Sheets via OAuth 2.0. Automatically creates and updates tabs for `Projects`, `Timesheet Entries`, and `Registered Agencies`.
- **🏢 Registered Agencies Directory**: Manage agency partners, contact details, web URLs, and finance emails with full Google Sheets backup and sync.
- **📑 Printable Weekly & Audit Reports**: Generate executive summaries with daily hour breakdowns, project shares, caffeine audits, and sarcastic corporate performance reviews. Includes print-optimized CSS (`Ctrl+P` / `Cmd+P`).
- **☕ Caffeine Audit Counter**: Track daily, weekly, monthly, and annual coffee consumption alongside productivity metrics.
- **🌙 Dark & Light Mode**: Clean, high-contrast visual design inspired by Notion with smooth dark mode transitions.
- **💾 Offline-First Architecture**: Continuous local storage persistence (`localStorage`) ensures zero data loss during network disruptions or page refreshes.

---

## 🏗️ Architecture & Code Base Structure

### System Architecture

`Timesheet Recorder` is designed with an **Offline-First, Cloud-Synced** architecture. All state reads and writes occur immediately in client memory and `localStorage`, ensuring zero latency and instant UI feedback regardless of network speed. An asynchronous Google Sheets sync engine handles cloud persistence and multi-user team collaboration in the background.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           REACT UI LAYER                                │
│ (Dashboard, Project Manager, Timesheet Logger, Weekly Audit Reports)    │
└────────────────────┬───────────────────────────────┬────────────────────┘
                     │                               │
        Immediate    │                               │  Async Auto-Sync
       State Updates │                               │  & Polling (30s)
                     ▼                               ▼
┌───────────────────────────┐           ┌─────────────────────────────────┐
│     LOCAL STORAGE ENGINE  │           │   GOOGLE SHEETS SYNC ENGINE     │
│  - Multi-Key Migration    │           │ - In-Memory Session Caching     │
│  - Fail-Safe Fallback     │           │ - Deterministic Data Merging    │
│  - Instant Offline Access │           │ - Batch Sheet Clear & Updates   │
└───────────────────────────┘           └─────────────────────────────────┘
```

### Key Modules & Directory Layout

```text
├── src/
│   ├── components/                     # Modular presentation & interactive components
│   │   ├── AgencyDirectoryModal.tsx    # Registered agency modal & form manager
│   │   ├── BudgetAlertsModal.tsx       # Threshold alert setup & notification list
│   │   ├── HumorBanner.tsx             # Sarcastic corporate humor banner
│   │   ├── ProjectManager.tsx          # Project listing, budget burn-rate & edit drawers
│   │   ├── ProjectModal.tsx            # Project creation/editing modal
│   │   ├── ProjectStatsModal.tsx       # Recharts analytics & time distribution charts
│   │   ├── QuickAddModal.tsx           # Rapid timesheet logger with auto-suggestions
│   │   ├── TimesheetForm.tsx           # Daily time entry form with caffeine tracker
│   │   ├── TimesheetList.tsx           # Grouped timesheet history & inline editing
│   │   └── WeeklyReport.tsx            # Executive weekly report & print stylesheet
│   │
│   ├── utils/                          # Core service layers & helper functions
│   │   ├── api.ts                      # Idempotent tag endpoint simulator
│   │   ├── formatters.ts               # Currency, duration, and date formatting utilities
│   │   ├── googleAuth.ts               # Firebase Auth & Google Sheets API v4 connector
│   │   ├── humor.ts                    # Dynamic corporate humor generator
│   │   ├── storage.ts                  # LocalStorage engine with multi-version key migration
│   │   └── syncUtils.ts                # Deterministic dataset merging & deep-diff comparison
│   │
│   ├── App.tsx                         # Main application state orchestrator & lifecycle
│   ├── main.tsx                        # React DOM entry point
│   ├── types.ts                        # Strict TypeScript models & interface declarations
│   └── index.css                       # Global Tailwind CSS v4 styling & print utilities
├── package.json
└── README.md
```

### Engineering & Performance Optimizations

1. **In-Memory Spreadsheet Verification Cache (`googleAuth.ts`)**:
   - Tab verification (`ensureAgenciesSheet`) uses a session-level `Set<string>` cache to avoid unnecessary Google API GET requests prior to every sync or background poll cycle.

2. **Deterministic Data Merging & Diffing (`syncUtils.ts`)**:
   - Merging logic for Projects, Entries, and Agencies is centralized in a pure helper function (`mergeSheetAndLocalData`).
   - Deep equality checking (`isDataEqual`) compares updated datasets against existing state before triggering React state setters, eliminating redundant component re-renders during 30-second silent background polling.

3. **Multi-Key Backward Compatibility (`storage.ts`)**:
   - `loadFromCandidateKeys` automatically checks legacy storage keys across previous app versions, seamlessly migrating data to primary keys without user intervention or loss.

4. **Print-Optimized Media Styles (`index.css`)**:
   - Custom `@media print` CSS rules isolate and format weekly executive reports for clean A4/Letter PDF exports or physical printing without navigation clutter.

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm** / **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/timesheet-recorder.git
   cd timesheet-recorder
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📊 Google Sheets Sync Setup

To enable real-time synchronization with Google Sheets:

1. Click **Connect Google** in the top navigation header.
2. Grant permission for Google Sheets access.
3. The app will automatically create a dedicated spreadsheet with three tabs:
   - `Projects`: Project names, client agencies, rates, and budget details.
   - `Timesheet Entries`: Logged hours, comments, coffee counts, tags, and timestamps.
   - `Registered Agencies`: Agency directory, address, website, and contact emails.
4. You can also paste an existing Google Spreadsheet ID under **Sync Settings** to sync directly to an existing file.

---

## 📜 License

This project is licensed under the [Apache-2.0 License](LICENSE).
