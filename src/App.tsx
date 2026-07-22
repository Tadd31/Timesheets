/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, TimeEntry, BudgetAlert, Agency } from './types';
import {
  getProjects,
  saveProjects,
  getEntries,
  saveEntries,
  getDarkMode,
  saveDarkMode,
  getAlerts,
  saveAlerts,
  getAgencies,
  saveAgencies
} from './utils/storage';

// Component imports
import HumorBanner from './components/HumorBanner';
import ProjectManager from './components/ProjectManager';
import TimesheetForm from './components/TimesheetForm';
import TimesheetList from './components/TimesheetList';
import WeeklyReport from './components/WeeklyReport';

// Icon imports
import {
  Calendar,
  Clock,
  FolderOpen,
  FileSpreadsheet,
  Sun,
  Moon,
  Trash2,
  AlertOctagon,
  Sparkles,
  HelpCircle,
  RotateCcw,
  X,
  WifiOff,
  Database,
  ShieldCheck,
  Info,
  RefreshCw,
  ExternalLink,
  LogOut,
  AlertCircle,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  findSpreadsheet,
  createSpreadsheet,
  syncDataToSheet,
  loadDataFromSheet,
  getAccessToken,
  writeHeaders
} from './utils/googleAuth';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string>('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '2432') {
      setIsAuthenticated(true);
      setLoginError('');
      if (rememberMe) {
        localStorage.setItem('timesheet_authenticated', 'true');
      } else {
        sessionStorage.setItem('timesheet_authenticated', 'true');
      }
    } else {
      setLoginError('Incorrect passcode. The auditors remain suspicious.');
    }
  };

  const handleAppLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('timesheet_authenticated');
    sessionStorage.removeItem('timesheet_authenticated');
    setPasswordInput('');
  };

  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'timesheet' | 'projects' | 'reports'>('timesheet');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [lastDeletedEntry, setLastDeletedEntry] = useState<TimeEntry | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);

  // Google Sheets sync states
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [syncingState, setSyncingState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return localStorage.getItem('timesheet_recorder_last_synced_time');
  });
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [showSyncPanel, setShowSyncPanel] = useState<boolean>(false);
  const [showSyncInfoModal, setShowSyncInfoModal] = useState<boolean>(false);
  const [customSheetInput, setCustomSheetInput] = useState<string>('');
  const [customSheetError, setCustomSheetError] = useState<string>('');

  const updateLastSyncedTime = () => {
    const now = new Date().toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLastSyncedTime(now);
    localStorage.setItem('timesheet_recorder_last_synced_time', now);
    localStorage.setItem('timesheet_recorder_last_synced_iso', new Date().toISOString());
  };

  const handleConnectCustomSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSheetInput.trim()) {
      setCustomSheetError('Please enter a valid Spreadsheet URL or ID.');
      return;
    }

    const match = customSheetInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const id = match && match[1] ? match[1] : customSheetInput.trim();

    if (!id || id.length < 10) {
      setCustomSheetError('Could not parse a valid spreadsheet ID.');
      return;
    }

    try {
      localStorage.setItem('timesheet_recorder_spreadsheet_id', id);
      setSpreadsheetId(id);
      setSheetsUrl(`https://docs.google.com/spreadsheets/d/${id}`);
      setCustomSheetError('');
      setCustomSheetInput('');
      
      const token = accessToken || await getAccessToken();
      if (token) {
        setSyncingState('syncing');
        await writeHeaders(token, id);
        await syncDataToSheet(token, id, projects, entries, agencies);
        setSyncingState('synced');
        updateLastSyncedTime();
        alert("Successfully linked custom spreadsheet! Existing projects, entries, and agencies synced.");
      } else {
        alert("Spreadsheet ID override set successfully! Connecting a Google account will now synchronize directly to this sheet.");
      }
    } catch (err: any) {
      console.error('Failed to link custom spreadsheet:', err);
      setCustomSheetError(err.message || 'Verification failed. Make sure the spreadsheet exists and is accessible.');
      setSyncingState('error');
    }
  };

  // Initialize spreadsheet connections
  const initializeSpreadsheet = async (token: string, userObj?: User) => {
    setSyncingState('syncing');
    try {
      let sheetId = localStorage.getItem('timesheet_recorder_spreadsheet_id');
      if (!sheetId) {
        sheetId = await findSpreadsheet(token);
      }
      if (!sheetId) {
        sheetId = await createSpreadsheet(token);
      }
      if (sheetId) {
        localStorage.setItem('timesheet_recorder_spreadsheet_id', sheetId);
        setSpreadsheetId(sheetId);
        setSheetsUrl(`https://docs.google.com/spreadsheets/d/${sheetId}`);

        // Fetch latest data from the sheet (source of truth)
        const loaded = await loadDataFromSheet(token, sheetId);

        const localProjects = getProjects();
        const localEntries = getEntries();
        const localAgencies = getAgencies();

        // Get the last known sync timestamp from local storage (if any)
        const lastSyncIso = localStorage.getItem('timesheet_recorder_last_synced_iso');

        // Merge projects:
        // Start with the sheet's current projects as the base, preserving local scope/rate fields if sheet is missing them
        const mergedProjects = loaded.projects.map(sp => {
          const lp = localProjects.find(p => p.id === sp.id);
          if (!lp) return sp;
          return {
            ...sp,
            description: sp.description || lp.description,
            dayRate: sp.dayRate ?? lp.dayRate,
            hoursInDay: sp.hoursInDay ?? lp.hoursInDay
          };
        });
        
        // Find local projects not present on the sheet and retain them
        localProjects.forEach(localProj => {
          const existsOnSheet = loaded.projects.some(p => p.id === localProj.id);
          if (!existsOnSheet) {
            mergedProjects.push(localProj);
          }
        });

        // Merge entries:
        // Start with the sheet's current entries as the base
        const mergedEntries = [...loaded.entries];

        // Find local entries not present on the sheet and retain them
        localEntries.forEach(localEntry => {
          const existsOnSheet = loaded.entries.some(e => e.id === localEntry.id);
          if (!existsOnSheet) {
            mergedEntries.push(localEntry);
          }
        });

        // Merge agencies:
        const mergedAgencies = [...loaded.agencies];
        localAgencies.forEach(localAgency => {
          const existsOnSheet = loaded.agencies.some(a => a.id === localAgency.id);
          if (!existsOnSheet) {
            mergedAgencies.push(localAgency);
          }
        });

        // Sync the unified merged datasets back to the Google Sheet
        await syncDataToSheet(token, sheetId, mergedProjects, mergedEntries, mergedAgencies);

        // Update local state and storage
        setProjects(mergedProjects);
        saveProjects(mergedProjects);
        setEntries(mergedEntries);
        saveEntries(mergedEntries);
        setAgencies(mergedAgencies);
        saveAgencies(mergedAgencies);

        setSyncingState('synced');
        updateLastSyncedTime();
      } else {
        setSyncingState('error');
      }
    } catch (err) {
      console.error('Spreadsheet initialization error:', err);
      setSyncingState('error');
    }
  };

  const handleGoogleLogin = async (useRedirect = false) => {
    setSyncingState('syncing');
    try {
      const res = await googleSignIn(useRedirect);
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        await initializeSpreadsheet(res.accessToken, res.user);
      } else {
        if (!useRedirect) {
          setSyncingState('error');
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      setSyncingState('error');
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setAccessToken(null);
      setSpreadsheetId(null);
      setSheetsUrl(null);
      setSyncingState('idle');
      setLastSyncedTime(null);
      localStorage.removeItem('timesheet_recorder_spreadsheet_id');
      localStorage.removeItem('timesheet_recorder_last_synced_time');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const triggerSheetSync = async (projList?: Project[], entList?: TimeEntry[], agList?: Agency[]) => {
    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');
    if (!token || !sheetId) return;

    setSyncingState('syncing');
    try {
      const projs = projList || projects;
      const ents = entList || entries;
      const ags = agList || agencies;
      await syncDataToSheet(token, sheetId, projs, ents, ags);
      setSyncingState('synced');
      updateLastSyncedTime();
    } catch (err) {
      console.error('Auto-sync failed:', err);
      setSyncingState('error');
    }
  };

  const safeSyncRefresh = async () => {
    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');
    if (!token || !sheetId) {
      alert("No active Google connection detected.");
      return;
    }
    setSyncingState('syncing');
    try {
      const loaded = await loadDataFromSheet(token, sheetId);
      const currentLocalProjects = getProjects();
      const currentLocalEntries = getEntries();
      const currentLocalAgencies = getAgencies();

      const mergedProjects = loaded.projects.map(sp => {
        const lp = currentLocalProjects.find(p => p.id === sp.id);
        if (!lp) return sp;
        return {
          ...sp,
          description: sp.description || lp.description,
          dayRate: sp.dayRate ?? lp.dayRate,
          hoursInDay: sp.hoursInDay ?? lp.hoursInDay
        };
      });
      currentLocalProjects.forEach(lp => {
        if (!mergedProjects.some(p => p.id === lp.id)) {
          mergedProjects.push(lp);
        }
      });

      const mergedEntries = [...loaded.entries];
      currentLocalEntries.forEach(le => {
        if (!mergedEntries.some(e => e.id === le.id)) {
          mergedEntries.push(le);
        }
      });

      const mergedAgencies = [...loaded.agencies];
      currentLocalAgencies.forEach(la => {
        if (!mergedAgencies.some(a => a.id === la.id)) {
          mergedAgencies.push(la);
        }
      });

      setProjects(mergedProjects);
      saveProjects(mergedProjects);
      setEntries(mergedEntries);
      saveEntries(mergedEntries);
      setAgencies(mergedAgencies);
      saveAgencies(mergedAgencies);
      setSyncingState('synced');
      updateLastSyncedTime();
    } catch (err: any) {
      console.error('Refresh sync failed:', err);
      setSyncingState('error');
      alert(`Sync refresh failed. This can happen if your internet connection is down or the spreadsheet has been deleted. Error: ${err.message || err}`);
    }
  };

  // Auto-dismiss toast notification after 7 seconds
  useEffect(() => {
    if (showToast && lastDeletedEntry) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showToast, lastDeletedEntry]);

  // Load state from localStorage and init Google Auth on mount
  useEffect(() => {
    setProjects(getProjects());
    setEntries(getEntries());
    setAlerts(getAlerts());
    setAgencies(getAgencies());
    
    const darkSetting = getDarkMode();
    setIsDarkMode(darkSetting);
    if (darkSetting) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const savedSheetId = localStorage.getItem('timesheet_recorder_spreadsheet_id');
    if (savedSheetId) {
      setSpreadsheetId(savedSheetId);
      setSheetsUrl(`https://docs.google.com/spreadsheets/d/${savedSheetId}`);
    }

    // Connect to Google session silently if available
    initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        initializeSpreadsheet(token, user);
      },
      () => {
        // Silent auth failed/none exists
      }
    );
  }, []);

  // Auto-refresh/polling Google Sheets data for multi-user collaboration
  useEffect(() => {
    if (!googleUser || !accessToken || !spreadsheetId) return;

    // Poll every 30 seconds to fetch other teammates' changes
    const interval = setInterval(async () => {
      // Only fetch if we are not currently writing/syncing
      if (syncingState === 'idle' || syncingState === 'synced') {
        try {
          const loaded = await loadDataFromSheet(accessToken, spreadsheetId);
          const currentLocalProjects = getProjects();
          const currentLocalEntries = getEntries();
          const currentLocalAgencies = getAgencies();

          const mergedProjects = loaded.projects.map(sp => {
            const lp = currentLocalProjects.find(p => p.id === sp.id);
            if (!lp) return sp;
            return {
              ...sp,
              description: sp.description || lp.description,
              dayRate: sp.dayRate ?? lp.dayRate,
              hoursInDay: sp.hoursInDay ?? lp.hoursInDay
            };
          });
          currentLocalProjects.forEach(lp => {
            if (!mergedProjects.some(p => p.id === lp.id)) {
              mergedProjects.push(lp);
            }
          });

          const mergedEntries = [...loaded.entries];
          currentLocalEntries.forEach(le => {
            if (!mergedEntries.some(e => e.id === le.id)) {
              mergedEntries.push(le);
            }
          });

          const mergedAgencies = [...loaded.agencies];
          currentLocalAgencies.forEach(la => {
            if (!mergedAgencies.some(a => a.id === la.id)) {
              mergedAgencies.push(la);
            }
          });

          setProjects(mergedProjects);
          saveProjects(mergedProjects);
          setEntries(mergedEntries);
          saveEntries(mergedEntries);
          setAgencies(mergedAgencies);
          saveAgencies(mergedAgencies);
          updateLastSyncedTime();
        } catch (err) {
          console.warn('Silent collaboration background reload failed:', err);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [googleUser, accessToken, spreadsheetId, syncingState]);

  // Sync dark mode setting
  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    saveDarkMode(newVal);
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Check budget alert system hook
  const checkBudgetAlerts = (projectId: string, updatedEntries: TimeEntry[], projectsToUse: Project[] = projects) => {
    const project = projectsToUse.find(p => p.id === projectId);
    if (!project || project.isNonBillable) return;

    const budgetToUse = project.budget_hours !== undefined && project.budget_hours !== null ? project.budget_hours : project.estimatedHours;
    if (!budgetToUse || budgetToUse <= 0) return;

    const spent = updatedEntries.filter(e => e.projectId === projectId).reduce((acc, curr) => acc + curr.hours, 0);
    const percent = (spent / budgetToUse) * 100;

    const thresholds = project.alert_thresholds || [50, 75, 90, 100];
    const currentAlerts = getAlerts();

    let triggeredNewAlert = false;
    let nextAlerts = [...currentAlerts];

    thresholds.forEach(threshold => {
      if (percent >= threshold) {
        const alreadyAlerted = currentAlerts.some(a => a.projectId === projectId && a.threshold === threshold);
        if (!alreadyAlerted) {
          const newAlert: BudgetAlert = {
            id: `alert-${Date.now()}-${threshold}`,
            projectId,
            projectName: project.name,
            threshold,
            currentHours: spent,
            budgetHours: budgetToUse,
            percentage: percent,
            timestamp: new Date().toISOString(),
            dismissed: false
          };
          nextAlerts = [newAlert, ...nextAlerts];
          triggeredNewAlert = true;
        }
      }
    });

    if (triggeredNewAlert) {
      saveAlerts(nextAlerts);
      setAlerts(nextAlerts);
    }
  };

  // Transaction-safe, multi-user mutation coordinator for Google Sheets
  const applyMutation = async (
    mutation:
      | { type: 'addProject'; project: Project }
      | { type: 'editProject'; project: Project }
      | { type: 'deleteProject'; projectId: string }
      | { type: 'addEntry'; entry: TimeEntry }
      | { type: 'editEntry'; entry: TimeEntry }
      | { type: 'deleteEntry'; entryId: string }
  ) => {
    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');

    // If online (logged in & spreadsheet connected)
    if (token && sheetId) {
      setSyncingState('syncing');
      try {
        // 1. Fetch latest data from sheet to prevent overwriting other users' updates
        const loaded = await loadDataFromSheet(token, sheetId);
        
        const localProjs = getProjects();
        let updatedProjects = loaded.projects.map(sp => {
          const lp = localProjs.find(p => p.id === sp.id);
          if (!lp) return sp;
          return {
            ...sp,
            description: sp.description || lp.description,
            dayRate: sp.dayRate ?? lp.dayRate,
            hoursInDay: sp.hoursInDay ?? lp.hoursInDay
          };
        });
        let updatedEntries = [...loaded.entries];

        // 2. Apply mutation to the fresh database state
        if (mutation.type === 'addProject') {
          // Add createdBy name
          const projectWithCreator = {
            ...mutation.project,
            createdBy: googleUser?.displayName || googleUser?.email || 'Anonymous Teammate'
          };
          updatedProjects.push(projectWithCreator);
        } else if (mutation.type === 'editProject') {
          updatedProjects = updatedProjects.map(p => p.id === mutation.project.id ? mutation.project : p);
        } else if (mutation.type === 'deleteProject') {
          updatedProjects = updatedProjects.filter(p => p.id !== mutation.projectId);
          updatedEntries = updatedEntries.filter(e => e.projectId !== mutation.projectId);
        } else if (mutation.type === 'addEntry') {
          // Add loggedByName & loggedByEmail
          const entryWithUser = {
            ...mutation.entry,
            loggedByName: googleUser?.displayName || 'Anonymous Teammate',
            loggedByEmail: googleUser?.email || '',
            projectName: updatedProjects.find(p => p.id === mutation.entry.projectId)?.name || ''
          };
          updatedEntries.push(entryWithUser);
        } else if (mutation.type === 'editEntry') {
          updatedEntries = updatedEntries.map(e => e.id === mutation.entry.id ? {
            ...mutation.entry,
            projectName: updatedProjects.find(p => p.id === mutation.entry.projectId)?.name || ''
          } : e);
        } else if (mutation.type === 'deleteEntry') {
          updatedEntries = updatedEntries.filter(e => e.id !== mutation.entryId);
        }

        // 3. Sync merged data back to Google Sheet
        await syncDataToSheet(token, sheetId, updatedProjects, updatedEntries, agencies);

        // 4. Update state with merged results
        setProjects(updatedProjects);
        setEntries(updatedEntries);
        saveProjects(updatedProjects);
        saveEntries(updatedEntries);

        setSyncingState('synced');
        updateLastSyncedTime();

        // Run budget alerting if relevant
        if (mutation.type === 'addEntry') {
          checkBudgetAlerts(mutation.entry.projectId, updatedEntries, updatedProjects);
        } else if (mutation.type === 'editEntry') {
          checkBudgetAlerts(mutation.entry.projectId, updatedEntries, updatedProjects);
        }
      } catch (err) {
        console.error('Online transaction sync mutation failed:', err);
        setSyncingState('error');
        alert("Failed to write to Google Sheets. Your teammates might have lock files or there is a connection issue. Please retry.");
      }
    } else {
      // Offline/Demo/Fallback mode - apply only locally
      if (mutation.type === 'addProject') {
        const updated = [...projects, mutation.project];
        setProjects(updated);
        saveProjects(updated);
      } else if (mutation.type === 'editProject') {
        const updated = projects.map(p => p.id === mutation.project.id ? mutation.project : p);
        setProjects(updated);
        saveProjects(updated);
      } else if (mutation.type === 'deleteProject') {
        const updatedProjects = projects.filter(p => p.id !== mutation.projectId);
        const updatedEntries = entries.filter(e => e.projectId !== mutation.projectId);
        setProjects(updatedProjects);
        saveProjects(updatedProjects);
        setEntries(updatedEntries);
        saveEntries(updatedEntries);
      } else if (mutation.type === 'addEntry') {
        const updated = [...entries, mutation.entry];
        setEntries(updated);
        saveEntries(updated);
        checkBudgetAlerts(mutation.entry.projectId, updated, projects);
      } else if (mutation.type === 'editEntry') {
        const updated = entries.map(e => e.id === mutation.entry.id ? mutation.entry : e);
        setEntries(updated);
        saveEntries(updated);
        checkBudgetAlerts(mutation.entry.projectId, updated, projects);
      } else if (mutation.type === 'deleteEntry') {
        const updated = entries.filter(e => e.id !== mutation.entryId);
        setEntries(updated);
        saveEntries(updated);
      }
    }
  };

  // Add project handler
  const handleAddProject = async (newProj: Omit<Project, 'id' | 'createdAt'>) => {
    const project: Project = {
      ...newProj,
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    await applyMutation({ type: 'addProject', project });
  };

  // Edit project handler
  const handleEditProject = async (updatedProj: Project) => {
    await applyMutation({ type: 'editProject', project: updatedProj });
  };

  // Delete project handler (cascades to delete all entries for that project)
  const handleDeleteProject = async (projectId: string) => {
    await applyMutation({ type: 'deleteProject', projectId });
  };

  // Add agency handler
  const handleAddAgency = async (newAgency: Omit<Agency, 'id' | 'createdAt'>) => {
    const agency: Agency = {
      ...newAgency,
      id: `agency-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updated = [...agencies, agency];
    setAgencies(updated);
    saveAgencies(updated);

    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');
    if (token && sheetId) {
      try {
        await syncDataToSheet(token, sheetId, projects, entries, updated);
      } catch (err) {
        console.warn('Failed to sync added agency to sheet:', err);
      }
    }
  };

  // Delete agency handler
  const handleDeleteAgency = async (agencyId: string) => {
    const updated = agencies.filter(a => a.id !== agencyId);
    setAgencies(updated);
    saveAgencies(updated);

    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');
    if (token && sheetId) {
      try {
        await syncDataToSheet(token, sheetId, projects, entries, updated);
      } catch (err) {
        console.warn('Failed to sync deleted agency to sheet:', err);
      }
    }
  };

  // Edit agency handler
  const handleEditAgency = async (updatedAgency: Agency) => {
    const updated = agencies.map(a => a.id === updatedAgency.id ? updatedAgency : a);
    setAgencies(updated);
    saveAgencies(updated);

    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');
    if (token && sheetId) {
      try {
        await syncDataToSheet(token, sheetId, projects, entries, updated);
      } catch (err) {
        console.warn('Failed to sync edited agency to sheet:', err);
      }
    }
  };

  const handleDismissAlert = (alertId: string) => {
    const updated = alerts.map(a => a.id === alertId ? { ...a, dismissed: true } : a);
    setAlerts(updated);
    saveAlerts(updated);
  };

  // Add timesheet entry
  const handleAddEntry = async (newEntry: Omit<TimeEntry, 'id' | 'createdAt'>) => {
    const entry: TimeEntry = {
      ...newEntry,
      id: `entry-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    await applyMutation({ type: 'addEntry', entry });
  };

  // Edit timesheet entry
  const handleEditEntry = async (updatedEntry: TimeEntry) => {
    await applyMutation({ type: 'editEntry', entry: updatedEntry });
  };

  // Delete timesheet entry
  const handleDeleteEntry = async (entryId: string) => {
    const entryToDelete = entries.find(e => e.id === entryId);
    if (entryToDelete) {
      setLastDeletedEntry(entryToDelete);
      setShowToast(true);
    }
    await applyMutation({ type: 'deleteEntry', entryId });
  };

  // Undo timesheet entry deletion
  const handleUndoDelete = async () => {
    if (!lastDeletedEntry) return;
    await applyMutation({ type: 'addEntry', entry: lastDeletedEntry });
    setShowToast(false);
    setLastDeletedEntry(null);
  };

  // Witty data wipe (The Corporate Shredder)
  const handleClearAllData = () => {
    const confirmation1 = window.confirm(
      "CONFIDENTIAL INCIDENT: You are about to invoke the 'Emergency Document Shredder'. This action wipes ALL projects, timelines, and logged effort history from cookies and cache. Proceed?"
    );
    if (!confirmation1) return;

    const confirmation2 = window.confirm(
      "AUDITOR BLOCKER: Are you absolutely certain? This will result in 100% loss of evidence. Senior Management will assume you spent the last 3 months doing absolutely nothing (which may be accurate)."
    );
    if (!confirmation2) return;

    setProjects([]);
    setEntries([]);
    saveProjects([]);
    saveEntries([]);
    alert("Shredder completed. The workspace is pristine. Please begin fabricating your next milestones immediately.");
  };

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 font-sans relative ${isDarkMode ? 'bg-[#191919] text-[#E0E0E0]' : 'bg-zinc-50 text-zinc-800'}`}>
        {/* Ambient background decoration */}
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.01] pointer-events-none" />
        
        {/* Floating Top-Right Theme Switcher */}
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] hover:bg-zinc-100 dark:hover:bg-[#2F2F2F] bg-white/95 dark:bg-[#1A1A1A]/95 text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors shadow-sm"
            title={isDarkMode ? "Enable Caffeine Light Mode" : "Enable Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-zinc-600" />}
          </button>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md p-6 sm:p-8 rounded-2xl border border-zinc-200/80 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-xl relative overflow-hidden font-mono"
        >
          {/* Decorative Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-500 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-800" />

          <div className="space-y-6 text-center">
            {/* Notion-style Icon */}
            <div className="inline-block text-5xl p-4 bg-zinc-50 dark:bg-[#191919] rounded-2xl border border-zinc-200/60 dark:border-[#2F2F2F] shadow-sm select-none transform hover:scale-105 transition-transform">
              🗄️
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                Timesheet Recorder V4.83
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Your high-precision logs companion
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500">
                  Secured Workspace Passcode
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 dark:text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-zinc-50 dark:bg-[#191919] text-zinc-850 dark:text-[#E0E0E0] placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-750 font-mono text-center tracking-widest text-lg transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Toggle */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-[#2F2F2F] text-zinc-600 focus:ring-0 cursor-pointer bg-zinc-50 dark:bg-[#191919]"
                  />
                  <span>Remember me on this laptop</span>
                </label>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {loginError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-xs flex items-start space-x-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-md flex items-center justify-center space-x-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Timesheets</span>
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-zinc-50 dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] transition-colors duration-300 pb-16 font-sans`}>
      {/* Visual Notion-like Top Banner Cover */}
      <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-300 dark:from-[#252525] dark:via-[#1F1F1F] dark:to-[#252525] border-b border-zinc-200/60 dark:border-[#2F2F2F] relative overflow-hidden print:hidden">
        {/* Subtle grid accent */}
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.01]" />
        
        {/* Controls Area (moved here from header below) */}
        <div className="absolute bottom-3 right-4 sm:right-6 flex items-center space-x-2 sm:space-x-3 z-20">
          {/* Offline Mode Indicator Badge */}
          <button
            onClick={() => setShowOfflineModal(true)}
            className="group flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-mono px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/45 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-400 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Click to learn about Offline Mode"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden xs:inline">Offline Mode</span>
            <span className="xs:hidden">Offline</span>
            <Info className="w-3 h-3 text-emerald-600/70 dark:text-emerald-400/70 group-hover:text-emerald-750 dark:group-hover:text-emerald-350 transition-colors" />
          </button>

          {/* Google Sheets Sync Controller */}
          <div className="flex items-center space-x-1">
            {googleUser === null ? (
              <button
                onClick={() => setShowSyncPanel(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-250 dark:border-[#2F2F2F]/85 bg-white/95 dark:bg-[#1A1A1A]/95 hover:bg-zinc-50 dark:hover:bg-[#252525] text-zinc-700 dark:text-[#E0E0E0] cursor-pointer text-[11px] sm:text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                title="Open Google Sheets Cloud Sync Panel"
              >
                <Database className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                <span className="hidden sm:inline">Sync Google Sheets</span>
                <span className="sm:hidden">Sync</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1">
                {/* Spreadsheet Quick Link */}
                {sheetsUrl && (
                  <a
                    href={sheetsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg border border-zinc-250 dark:border-[#2F2F2F]/85 hover:bg-zinc-100 dark:hover:bg-[#2F2F2F] bg-white/95 dark:bg-[#1A1A1A]/95 text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors shadow-sm"
                    title="Open Database in Google Sheets"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                  </a>
                )}

                {/* Sync Status Badge */}
                <button
                  onClick={() => setShowSyncPanel(true)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] sm:text-xs font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm ${
                    syncingState === 'syncing'
                      ? 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                      : syncingState === 'error'
                      ? 'bg-rose-50/95 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
                      : 'bg-emerald-50/95 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {syncingState === 'syncing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : syncingState === 'error' ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span className="hidden sm:inline">
                    {syncingState === 'syncing' ? 'Syncing...' : syncingState === 'error' ? 'Sync Error' : 'Synced'}
                  </span>
                  <span className="sm:hidden">
                    {syncingState === 'syncing' ? 'Syncing' : syncingState === 'error' ? 'Error' : 'Synced'}
                  </span>
                </button>
              </div>
            )}

            {/* Explanation I-Icon for the sync option */}
            <button
              onClick={() => setShowSyncInfoModal(true)}
              className="p-1.5 rounded-lg border border-zinc-250 dark:border-[#2F2F2F]/85 hover:bg-zinc-100 dark:hover:bg-[#2D2D2D] bg-white/95 dark:bg-[#1A1A1A]/95 text-zinc-500 dark:text-zinc-450 cursor-pointer transition-colors shadow-sm"
              title="How does Google Sheets Sync work?"
            >
              <Info className="w-3.5 h-3.5 text-blue-500" />
            </button>
          </div>

          {/* Theme Selector (Dark mode switcher) */}
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg border border-zinc-250 dark:border-[#2F2F2F]/85 hover:bg-zinc-100 dark:hover:bg-[#2F2F2F] bg-white/95 dark:bg-[#1A1A1A]/95 text-zinc-500 dark:text-gray-400 cursor-pointer transition-colors shadow-sm"
            title={isDarkMode ? "Enable Caffeine Light Mode" : "Enable Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-zinc-600" />}
          </button>


        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-10 sm:-mt-14 relative z-10">
        
        {/* Notion-style Header Avatar & Details */}
        <header className="space-y-4 mb-6 print:hidden">
          <div className="flex items-end justify-between">
            {/* Notion Icon */}
            <div className="text-5xl sm:text-6xl p-3 bg-white dark:bg-[#1F1F1F] rounded-2xl border border-zinc-200/80 dark:border-[#2F2F2F] shadow-md select-none transform hover:scale-105 transition-transform">
              🗄️
            </div>
          </div>

          {/* App description and header info - now with MORE SPACE for title */}
          <div className="space-y-1.5 pt-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white font-mono">
              Timesheet Recorder V4.83
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono max-w-2xl">
              Your high-precision logs companion
            </p>
          </div>

          {/* Navigation Tabs (Notion style simple bottom border lines) */}
          <nav className="flex items-center space-x-1 border-b border-zinc-200 dark:border-[#2F2F2F] pt-3">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-mono font-bold border-b-2 -mb-px transition-all cursor-pointer rounded-t-lg ${
                activeTab === 'timesheet'
                  ? 'border-orange-500 dark:border-orange-400 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 hover:bg-orange-100/40 dark:hover:bg-orange-950/30'
                  : 'border-transparent text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50/30 dark:hover:bg-orange-950/10'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Record Hours</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-mono font-bold border-b-2 -mb-px transition-all cursor-pointer rounded-t-lg ${
                activeTab === 'projects'
                  ? 'border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/40 dark:hover:bg-emerald-950/30'
                  : 'border-transparent text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Project Backlogs</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-mono font-bold border-b-2 -mb-px transition-all cursor-pointer rounded-t-lg ${
                activeTab === 'reports'
                  ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/40 dark:hover:bg-purple-950/30'
                  : 'border-transparent text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-950/10'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Weekly Reports</span>
            </button>
          </nav>
        </header>

        {/* Tab Body Renderings */}
        <main className="min-h-[400px]">
          {/* Active Budget Alerts */}
          {alerts.filter(a => !a.dismissed).length > 0 && (
            <div className="mb-6 space-y-2">
              {alerts.filter(a => !a.dismissed).map(alert => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-rose-200/50 dark:border-rose-950/40 bg-rose-50/70 dark:bg-rose-950/10 text-xs text-rose-800 dark:text-rose-200 font-mono shadow-sm"
                >
                  <div className="flex items-center space-x-2.5">
                    <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>
                      ⚠️ <strong>BURN ALERT:</strong> Project <strong className="underline">{alert.projectName}</strong> has crossed its <strong>{alert.threshold}%</strong> threshold! ({Math.round(alert.percentage)}% consumed: {alert.currentHours}h logged against {alert.budgetHours}h budget)
                    </span>
                  </div>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="text-[10px] text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 underline font-bold cursor-pointer shrink-0 ml-3"
                  >
                    Acknowledge
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'timesheet' && (
            <div className="space-y-6">
              {/* Full Width Log Effort Ledger first */}
              <div className="print:hidden">
                <TimesheetForm
                  projects={projects}
                  onAddEntry={handleAddEntry}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                />
              </div>
              
              {/* Timesheet list below */}
              <div>
                <TimesheetList
                  entries={entries}
                  projects={projects}
                  onDeleteEntry={handleDeleteEntry}
                  onEditEntry={handleEditEntry}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                />
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="animate-in fade-in duration-200">
              <ProjectManager
                projects={projects}
                entries={entries}
                onAddProject={handleAddProject}
                onEditProject={handleEditProject}
                onDeleteProject={handleDeleteProject}
                agencies={agencies}
                onAddAgency={handleAddAgency}
                onEditAgency={handleEditAgency}
                onDeleteAgency={handleDeleteAgency}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="animate-in fade-in duration-200">
              <WeeklyReport
                entries={entries}
                projects={projects}
              />
            </div>
          )}
        </main>

        {/* Daily humor quotes & caffeine tracker moved here to bottom */}
        {activeTab === 'timesheet' && (
          <div className="mt-12 print:hidden">
            <HumorBanner />
          </div>
        )}

        {/* Corporate footer */}
        <footer className="mt-16 pt-6 border-t border-zinc-200 dark:border-[#2F2F2F] text-center space-y-2 print:hidden">
          <p className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            Timesheet Ledger Protocol v4.83 • Client-Side Cookies Approved
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-lg mx-auto leading-normal italic">
            "Disclaimer: Logging hours does not guarantee promotion. Any similarity between recorded tasks and actual productive output is strictly coincidental. Powered by caffeine, temporary variables, and corporate anxiety."
          </p>
        </footer>
      </div>

      {/* Undo Toast Notification */}
        <AnimatePresence>
          {showToast && lastDeletedEntry && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 right-6 z-50 flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-xl max-w-sm w-[calc(100vw-3rem)] sm:w-96 font-mono text-xs text-zinc-800 dark:text-[#E0E0E0] print:hidden"
            >
              <div className="flex items-start space-x-3 pr-2">
                <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#191919] text-zinc-500 shrink-0 text-base">🗑️</span>
                <div className="space-y-1">
                  <p className="font-bold text-zinc-900 dark:text-white uppercase tracking-wider text-[10px] flex items-center space-x-1">
                    <span>Entry Sanitized</span>
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
                    Logged <span className="font-bold text-zinc-850 dark:text-zinc-100">{lastDeletedEntry.hours}h</span> for <span className="italic">"{projects.find(p => p.id === lastDeletedEntry.projectId)?.name || 'Unknown Project'}"</span> was shredded.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 shrink-0 border-l border-zinc-200 dark:border-[#2F2F2F] pl-3">
                <button
                  onClick={handleUndoDelete}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-blue-600 text-white font-bold text-[10px] hover:bg-zinc-850 dark:hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
                <button
                  onClick={() => setShowToast(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Offline Mode Details Modal */}
        <AnimatePresence>
          {showOfflineModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowOfflineModal(false)}
                className="absolute inset-0 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-md"
              />

              {/* Modal Content Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                className="relative bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-[#2D2D2D] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden z-10 font-sans text-zinc-800 dark:text-[#E0E0E0] p-6 space-y-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                      <WifiOff className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-mono text-zinc-900 dark:text-white uppercase tracking-wider">
                        Offline Protocol Mode
                      </h3>
                      <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 uppercase">
                        100% Local-First Architecture
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOfflineModal(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                    title="Close Dialog"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body Explanation */}
                <div className="space-y-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                  <p>
                    Your <strong className="text-zinc-900 dark:text-white">Timesheet Recorder</strong> operates under an uncompromising, privacy-respecting offline directive. No server, no APIs, no tracking cookies.
                  </p>

                  <div className="space-y-3.5 pt-1">
                    {/* Key 1: LocalStorage */}
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 mt-0.5 border border-blue-100 dark:border-blue-900/10 shrink-0">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-[11px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                          Client-Side Database Storage
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                          All logged timesheets, project configurations, hourly rates, tags, and caffeine stats are written directly to your web browser's physical storage memory (<code className="font-mono bg-zinc-100 dark:bg-[#252525] px-1 py-0.5 rounded text-[10px]">localStorage</code>).
                        </p>
                      </div>
                    </div>

                    {/* Key 2: Absolute Privacy */}
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 mt-0.5 border border-purple-100 dark:border-purple-900/10 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-[11px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                          Structurally Guaranteed Privacy
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                          Your records never leave this machine. No analytical pings, zero tracking agents, and no external servers can access or read what you write.
                        </p>
                      </div>
                    </div>

                    {/* Key 3: Instantaneous Speed */}
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 mt-0.5 border border-amber-100 dark:border-amber-900/10 shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-[11px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                          Zero Latency Execution
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
                          Edits, additions, and metric compilations execute in real-time, completely offline. The application remains fully functional even in deep signal dead zones.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Warning / Caveat Banner */}
                  <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/20 rounded-xl space-y-1.5">
                    <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-400">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      <h5 className="font-bold font-mono text-[10px] uppercase tracking-wider">Compliance Advisory</h5>
                    </div>
                    <p className="text-[10.5px] text-amber-700/85 dark:text-amber-400/85 leading-relaxed">
                      Clearing your browser's site cookies or application storage cache will wipe your saved timesheets. To prevent data loss, we strongly recommend syncing your account with <strong className="text-amber-800 dark:text-amber-300">Google Sheets</strong> to back up your records in real-time. You can also print or capture your <strong className="text-amber-800 dark:text-amber-300">Weekly Reports</strong> regularly to preserve evidence of your corporate service.
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowOfflineModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold text-xs font-mono transition-all cursor-pointer shadow-md active:scale-95 hover:shadow-lg"
                  >
                    Acknowledge Directive
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Google Sheets Sync Panel Modal */}
        <AnimatePresence>
          {showSyncPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-md print:hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md p-6 bg-white dark:bg-[#1C1C1C] rounded-2xl border border-zinc-200/80 dark:border-[#2F2F2F] shadow-2xl space-y-5"
              >
                {/* Modal Title Header */}
                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-[#2D2D2D] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/10">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-zinc-950 dark:text-white font-mono">
                        Google Sheets Cloud Sync
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        Real-time spreadsheet synchronization
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSyncPanel(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                    title="Close Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Account Details & Status */}
                <div className="space-y-4 text-xs">
                  {!googleUser ? (
                    <div className="space-y-4">
                      {/* Step 1: Link Shared Spreadsheet */}
                      <div className="p-4 bg-zinc-50 dark:bg-[#1E1E1E] border border-zinc-200 dark:border-[#2D2D2D] rounded-xl space-y-3">
                        <div className="flex items-center space-x-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px]">
                            1
                          </span>
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide text-[10px] font-mono">
                            Link Team Spreadsheet (Optional)
                          </h4>
                        </div>
                        
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono">
                          If your Team Lead shared a Google Sheet with you, paste its URL or ID below so your timesheets sync directly into it. Otherwise, we will automatically create one in your Drive.
                        </p>

                        <form onSubmit={handleConnectCustomSheet} className="flex gap-1.5">
                          <input
                            type="text"
                            value={customSheetInput}
                            onChange={(e) => setCustomSheetInput(e.target.value)}
                            placeholder="Paste shared Google Sheet URL or ID"
                            className="flex-1 bg-white dark:bg-[#151515] border border-zinc-200 dark:border-[#2D2D2D] rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-mono font-bold text-[11px] rounded-lg transition-all cursor-pointer shrink-0"
                          >
                            Link
                          </button>
                        </form>
                        
                        {customSheetError && (
                          <p className="text-[10px] text-rose-500 font-mono leading-tight">{customSheetError}</p>
                        )}

                        {spreadsheetId && (
                          <div className="flex items-center space-x-2 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-bold">Linked:</span>
                            <span className="truncate max-w-[170px]">{spreadsheetId}</span>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Sign In / Authorize */}
                      <div className="p-4 bg-zinc-50 dark:bg-[#1E1E1E] border border-zinc-200 dark:border-[#2D2D2D] rounded-xl space-y-3">
                        <div className="flex items-center space-x-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono font-bold text-[10px]">
                            2
                          </span>
                          <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide text-[10px] font-mono">
                            Authorize with Google Account
                          </h4>
                        </div>

                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono">
                          Connect your Google Account to grant write access to sheets and enable real-time backup.
                        </p>

                        <div className="space-y-2.5">
                          <button
                            onClick={() => handleGoogleLogin(false)}
                            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md active:scale-95"
                          >
                            <Database className="w-4 h-4 text-white animate-pulse" />
                            <span>Connect Google Account</span>
                          </button>

                          <div className="pt-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleGoogleLogin(true)}
                              className="text-[10.5px] text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dashed font-mono cursor-pointer"
                              title="If popup closes too quickly or is blocked, use redirect login method."
                            >
                              💡 Popup blocked or closes instantly? Try Redirect Login
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3.5 bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-[#2D2D2D] rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400 font-mono font-bold uppercase text-[9px] tracking-wide">
                            Connected Account
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
                            Active
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          {googleUser.photoURL ? (
                            <img
                              src={googleUser.photoURL}
                              alt={googleUser.displayName || "Google User"}
                              className="w-9 h-9 rounded-full border border-zinc-200 dark:border-[#2F2F2F] shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300">
                              {googleUser.displayName?.charAt(0) || "G"}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-zinc-800 dark:text-zinc-200">
                              {googleUser.displayName || "Google Workspace User"}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {googleUser.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Sync Engine Status */}
                      <div className="p-3.5 bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-[#2D2D2D] rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400 font-mono font-bold uppercase text-[9px] tracking-wide block">
                            Sync Engine Status
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            syncingState === 'syncing' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15' :
                            syncingState === 'error' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/15 animate-pulse' :
                            syncingState === 'synced' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15' :
                            'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/15'
                          }`}>
                            {syncingState === 'syncing' ? 'Syncing...' :
                             syncingState === 'error' ? 'Sync Error' :
                             syncingState === 'synced' ? 'Synced' : 'Idle'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-zinc-500 dark:text-zinc-400">
                            Last successful sync:
                          </span>
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">
                            {lastSyncedTime ? lastSyncedTime : 'Never'}
                          </span>
                        </div>

                        {/* Informative Warning on Error */}
                        {syncingState === 'error' && (
                          <div className="p-2.5 bg-rose-500/5 border border-rose-500/20 rounded-lg space-y-1">
                            <p className="text-[10px] text-rose-600 dark:text-rose-400 leading-normal font-mono font-bold flex items-center gap-1">
                              <AlertOctagon className="w-3 h-3 shrink-0" />
                              <span>Sync credentials expired or network offline.</span>
                            </p>
                            <p className="text-[9.5px] text-zinc-500 dark:text-zinc-400 leading-normal font-mono">
                              Click <strong className="text-blue-600 dark:text-blue-400">Reconnect</strong> to authenticate again, or <strong className="text-emerald-600 dark:text-emerald-400">Sync Now</strong> to retry.
                            </p>
                          </div>
                        )}

                        {/* Safe Collaboration Actions */}
                        <div className="flex gap-2 pt-1 border-t border-zinc-200/40 dark:border-zinc-800/40">
                          <button
                            onClick={safeSyncRefresh}
                            disabled={syncingState === 'syncing'}
                            className="flex-1 py-1.5 px-2.5 bg-white dark:bg-[#1A1A1A] hover:bg-zinc-100 dark:hover:bg-[#2A2A2A] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#2D2D2D] rounded-lg font-mono font-bold text-[10px] flex items-center justify-center space-x-1 transition-all hover:border-emerald-500/40 active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Fetch other teammates' logs and force refresh"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingState === 'syncing' ? 'animate-spin text-amber-500' : 'text-emerald-500'}`} />
                            <span>Sync Now</span>
                          </button>
                          
                          <button
                            onClick={() => handleGoogleLogin(false)}
                            disabled={syncingState === 'syncing'}
                            className="flex-1 py-1.5 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-mono font-bold text-[10px] flex items-center justify-center space-x-1 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Reconnect to Google Account and refresh API credentials"
                          >
                            <Database className="w-3 h-3 text-white" />
                            <span>Reconnect</span>
                          </button>
                        </div>
                      </div>

                      {/* Active Spreadsheet details */}
                      <div className="p-3.5 bg-zinc-50 dark:bg-[#222] border border-zinc-200 dark:border-[#2D2D2D] rounded-xl space-y-2.5">
                        <span className="text-zinc-500 dark:text-zinc-400 font-mono font-bold uppercase text-[9px] tracking-wide block">
                          Target Spreadsheet Database
                        </span>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="font-bold text-zinc-800 dark:text-zinc-200">
                              {spreadsheetId ? 'Custom linked spreadsheet' : 'Timesheet Recorder Database'}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[210px]">
                              {spreadsheetId ? `ID: ${spreadsheetId.substring(0, 16)}...` : 'Files reside in Google Drive'}
                            </p>
                          </div>
                          {sheetsUrl && (
                            <a
                              href={sheetsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-[11px] font-mono font-bold rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
                            >
                              <span>Open Sheet</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-zinc-200/50 dark:border-[#2D2D2D]/50 space-y-2">
                          <p className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase">
                            Switch/Override Spreadsheet URL / ID
                          </p>
                          <form onSubmit={handleConnectCustomSheet} className="flex gap-1.5">
                            <input
                              type="text"
                              value={customSheetInput}
                              onChange={(e) => setCustomSheetInput(e.target.value)}
                              placeholder="Paste different Google Sheet URL or ID"
                              className="flex-1 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-[#2D2D2D] rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <button
                              type="submit"
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              Link
                            </button>
                          </form>
                          {customSheetError && (
                            <p className="text-[10px] text-rose-500 font-mono leading-tight">{customSheetError}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer and Sign Out */}
                <div className="flex items-center justify-between border-t border-zinc-150 dark:border-[#2D2D2D] pt-3 pb-1 text-xs">
                  {googleUser ? (
                    <button
                      onClick={handleGoogleLogout}
                      className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold font-mono transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect Google</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    onClick={() => setShowSyncPanel(false)}
                    className="px-4 py-1.5 bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-bold font-mono text-[11px] rounded-lg cursor-pointer transition-all active:scale-95"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Google Sheets Sync Information Modal */}
        <AnimatePresence>
          {showSyncInfoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-md print:hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-lg p-6 bg-white dark:bg-[#1C1C1C] rounded-2xl border border-zinc-200/80 dark:border-[#2F2F2F] shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]"
              >
                {/* Modal Title Header */}
                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-[#2D2D2D] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/10">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-zinc-950 dark:text-white font-mono">
                        Google Sheets Cloud Sync
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        How your cloud database works
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSyncInfoModal(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
                    title="Close Info Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Explanation Details */}
                <div className="space-y-4 text-xs">
                  <div className="space-y-3.5">
                    {/* Item 1 */}
                    <div className="flex gap-3">
                      <div className="p-1.5 h-fit rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 border border-indigo-100 dark:border-indigo-900/15 mt-0.5">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          Secure Cloud Integration
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          By linking your Google account, the app automatically provisions a spreadsheet called <span className="font-bold text-zinc-750 dark:text-zinc-350">"Timesheet Recorder Database"</span> directly inside your Google Drive. No server hosts your records; everything stays securely in your personal Google account.
                        </p>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex gap-3">
                      <div className="p-1.5 h-fit rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 border border-emerald-100 dark:border-emerald-900/15 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          Offline-First Protection
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Your records continue to save instantly inside your web browser's local cache. If your internet drops or you are working in remote spots, the app operates uninterrupted.
                        </p>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex gap-3">
                      <div className="p-1.5 h-fit rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-500 border border-amber-100 dark:border-amber-900/15 mt-0.5">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          Live Real-time Syncing
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Whenever you add a timesheet, create a new project, or log cup counts, the app debounces and pushes updates up to Google Sheets within 1.5 seconds. Changes synchronize smoothly.
                        </p>
                      </div>
                    </div>

                    {/* Item 4 */}
                    <div className="flex gap-3">
                      <div className="p-1.5 h-fit rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-500 border border-purple-100 dark:border-purple-900/15 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          Cross-Device Restore
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          Switched browsers or cleared your cookies? Simply log in with Google, open the Sync Panel status badge, and select <span className="font-bold text-zinc-750 dark:text-zinc-350">"Force Restore"</span>. This grabs all records from your Drive sheet and fully restores your workspace in a single click!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end border-t border-zinc-150 dark:border-[#2D2D2D] pt-3 text-xs">
                  <button
                    onClick={() => setShowSyncInfoModal(false)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold font-mono text-[11px] rounded-lg cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    Understood
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

    </div>
  );
}
