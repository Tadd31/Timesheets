# ⏱️ Timesheet Recorder

A modern, offline-first timesheet and project tracking application built with React, TypeScript, and Tailwind CSS. Designed with a clean, Notion-inspired aesthetic, **Timesheet Recorder** features real-time Google Sheets synchronization, project budget monitoring, agency directory management, caffeine counters, and printable executive weekly reports.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
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

## 🚀 Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **Animations**: [Motion](https://motion.dev/)
- **APIs**: Google Sheets API v4, Google OAuth 2.0, Firebase Auth

---

## 📂 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── AgencyDirectoryModal.tsx  # Agency management modal
│   │   ├── BudgetAlertsModal.tsx     # Budget thresholds & alert configuration
│   │   ├── ProjectModal.tsx          # Project create & edit form
│   │   ├── ProjectStatsModal.tsx     # Analytics & burn-rate charts
│   │   ├── QuickAddModal.tsx         # Fast timesheet entry logger
│   │   └── WeeklyReport.tsx          # Executive weekly report & print view
│   ├── utils/
│   │   ├── googleAuth.ts             # Google OAuth & Sheets API sync logic
│   │   └── storage.ts                # Offline localStorage engine & migration
│   ├── App.tsx                       # Main application state & dashboard
│   ├── main.tsx                      # Entry point
│   ├── types.ts                      # Shared TypeScript interfaces & models
│   └── index.css                     # Global styles & print utilities
├── package.json
└── README.md
```

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
