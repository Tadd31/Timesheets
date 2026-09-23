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
import WeeklyTimesheetMatrix from './components/WeeklyTimesheetMatrix';

// Icon imports
import {
  Calendar,
  Clock,
  FolderOpen,
  FileSpreadsheet,
  FileText,
  Sun,
  Moon,
  Trash2,
  AlertOctagon,
  Sparkles,
  HelpCircle,
  RotateCcw,
  X,
  Database,
  ShieldCheck,
  Info,
  RefreshCw,
  ExternalLink,
  LogOut,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Link,
  LogIn,
  KeyRound,
  AlertTriangle
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
import { mergeSheetAndLocalData, isDataEqual } from './utils/syncUtils';

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
  const [reconnectedNotice, setReconnectedNotice] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [timesheetEntryMode, setTimesheetEntryMode] = useState<'matrix' | 'single'>(() => {
    const saved = localStorage.getItem('timesheet_entry_mode');
    return saved === 'single' ? 'single' : 'matrix';
  });

  const isFullyConnected = Boolean(spreadsheetId && (googleUser || accessToken) && syncingState !== 'error');
  const isReauthNeeded = syncingState === 'error' || Boolean(spreadsheetId && !googleUser && !accessToken);
  const isNotConnected = !spreadsheetId && !googleUser && !accessToken && !isReauthNeeded;

  const triggerReconnectedNotice = (msg = 'Google Sheets database reconnected & state synchronized!') => {
    setReconnectedNotice(msg);
  };

  useEffect(() => {
    if (reconnectedNotice) {
      const timer = setTimeout(() => setReconnectedNotice(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [reconnectedNotice]);

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
        const loaded = await loadDataFromSheet(token, id);
        let activeProjects = loaded.projects;
        let activeEntries = loaded.entries;
        let activeAgencies = loaded.agencies;

        // If the linked custom spreadsheet is empty, seed it once with existing state:
        if (activeProjects.length === 0 && activeEntries.length === 0 && activeAgencies.length === 0) {
          activeProjects = projects;
          activeEntries = entries;
          activeAgencies = agencies;
          if (activeProjects.length > 0 || activeEntries.length > 0 || activeAgencies.length > 0) {
            await syncDataToSheet(token, id, activeProjects, activeEntries, activeAgencies);
          }
        }

        setProjects(activeProjects);
        saveProjects(activeProjects);
        setEntries(activeEntries);
        saveEntries(activeEntries);
        setAgencies(activeAgencies);
        saveAgencies(activeAgencies);

        setSyncingState('synced');
        updateLastSyncedTime();
        triggerReconnectedNotice('Custom Google Sheet linked & state synchronized!');
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

        let activeProjects = loaded.projects;
        let activeEntries = loaded.entries;
        let activeAgencies = loaded.agencies;

        // Only if the database sheet is completely blank and newly created, seed initial data once:
        if (activeProjects.length === 0 && activeEntries.length === 0 && activeAgencies.length === 0) {
          const localProjects = getProjects();
          const localEntries = getEntries();
          const localAgencies = getAgencies();
          if (localProjects.length > 0 || localEntries.length > 0 || localAgencies.length > 0) {
            activeProjects = localProjects;
            activeEntries = localEntries;
            activeAgencies = localAgencies;
            await syncDataToSheet(token, sheetId, activeProjects, activeEntries, activeAgencies);
          }
        }

        // Set state directly from database
        setProjects(activeProjects);
        saveProjects(activeProjects);
        setEntries(activeEntries);
        saveEntries(activeEntries);
        setAgencies(activeAgencies);
        saveAgencies(activeAgencies);

        setSyncingState('synced');
        updateLastSyncedTime();
        triggerReconnectedNotice('Google Sheets Database Connected & State Synchronized');
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
    setAuthErrorMessage(null);
    try {
      const res = await googleSignIn(useRedirect);
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        setAuthErrorMessage(null);
        await initializeSpreadsheet(res.accessToken, res.user);
      } else {
        if (!useRedirect) {
          setSyncingState('error');
          setAuthErrorMessage('Google sign-in popup closed or did not return credentials.');
        }
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setSyncingState('error');
      setAuthErrorMessage(err?.message || 'Authentication error. Please check browser popups or try redirect login.');
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
      setAuthErrorMessage(null);
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

    const wasError = syncingState === 'error';
    setSyncingState('syncing');
    try {
      const projs = projList || projects;
      const ents = entList || entries;
      const ags = agList || agencies;
      await syncDataToSheet(token, sheetId, projs, ents, ags);
      setSyncingState('synced');
      setAuthErrorMessage(null);
      updateLastSyncedTime();
      if (wasError) {
        triggerReconnectedNotice('Database Reconnected — Changes saved to Google Sheets.');
      }
    } catch (err: any) {
      console.error('Auto-sync failed:', err);
      setSyncingState('error');
      const errStr = (err?.message || String(err)).toLowerCase();
      if (errStr.includes('401') || errStr.includes('unauthenticated') || errStr.includes('invalid credentials') || errStr.includes('token') || errStr.includes('permission')) {
        setAuthErrorMessage('Google session expired (401 Unauthenticated). Please reconnect your Google account.');
      } else {
        setAuthErrorMessage(err?.message || 'Failed to sync timesheets to Google Sheets.');
      }
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

      setProjects(loaded.projects);
      saveProjects(loaded.projects);
      setEntries(loaded.entries);
      saveEntries(loaded.entries);
      setAgencies(loaded.agencies);
      saveAgencies(loaded.agencies);
      setSyncingState('synced');
      setAuthErrorMessage(null);
      updateLastSyncedTime();
      triggerReconnectedNotice('Database Reconnected & Full State Refreshed!');
    } catch (err: any) {
      console.error('Refresh sync failed:', err);
      setSyncingState('error');
      const errStr = (err?.message || String(err)).toLowerCase();
      if (errStr.includes('401') || errStr.includes('unauthenticated') || errStr.includes('invalid credentials') || errStr.includes('token') || errStr.includes('permission')) {
        setAuthErrorMessage('Google session expired (401 Unauthenticated). Please reconnect your Google account.');
      } else {
        setAuthErrorMessage(err?.message || 'Sync refresh failed.');
      }
      alert(`Sync refresh failed. This can happen if your internet connection is down or credentials expired. Error: ${err.message || err}`);
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
        setAuthErrorMessage(null);
        initializeSpreadsheet(token, user);
      },
      () => {
        // Silent auth failed/none exists
        const savedSheetId = localStorage.getItem('timesheet_recorder_spreadsheet_id');
        if (savedSheetId) {
          setSyncingState('error');
          setAuthErrorMessage('Google session expired. Please re-authenticate to resume syncing.');
        }
      }
    );
  }, []);

  // Auto-refresh/polling Google Sheets data for multi-user collaboration
  useEffect(() => {
    if (!googleUser || !accessToken || !spreadsheetId) return;

    // Poll every 30 seconds to fetch database updates
    const interval = setInterval(async () => {
      // Only fetch if we are not currently writing/syncing
      if (syncingState === 'idle' || syncingState === 'synced') {
        try {
          const loaded = await loadDataFromSheet(accessToken, spreadsheetId);
          setProjects(prevProjects => {
            if (JSON.stringify(prevProjects) !== JSON.stringify(loaded.projects)) {
              saveProjects(loaded.projects);
              return loaded.projects;
            }
            return prevProjects;
          });
          setEntries(prevEntries => {
            if (JSON.stringify(prevEntries) !== JSON.stringify(loaded.entries)) {
              saveEntries(loaded.entries);
              return loaded.entries;
            }
            return prevEntries;
          });
          setAgencies(prevAgencies => {
            if (JSON.stringify(prevAgencies) !== JSON.stringify(loaded.agencies)) {
              saveAgencies(loaded.agencies);
              return loaded.agencies;
            }
            return prevAgencies;
          });
        } catch (err: any) {
          console.warn('Silent collaboration background reload failed:', err);
          const errStr = (err?.message || String(err)).toLowerCase();
          if (errStr.includes('401') || errStr.includes('unauthenticated') || errStr.includes('invalid credentials') || errStr.includes('token') || errStr.includes('permission')) {
            setSyncingState('error');
            setAuthErrorMessage('Google session expired. Re-authentication required to resume sync.');
          }
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
      | { type: 'batchUpdateEntries'; toAdd: TimeEntry[]; toEdit: TimeEntry[]; toDeleteIds: string[] }
  ) => {
    const token = accessToken || await getAccessToken();
    const sheetId = spreadsheetId || localStorage.getItem('timesheet_recorder_spreadsheet_id');

    // If online (logged in & spreadsheet connected)
    if (token && sheetId) {
      setSyncingState('syncing');
      try {
        // 1. Fetch latest data from sheet to prevent overwriting other users' updates
        const loaded = await loadDataFromSheet(token, sheetId);
        let updatedProjects = [...loaded.projects];
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
        } else if (mutation.type === 'batchUpdateEntries') {
          const deleteSet = new Set(mutation.toDeleteIds);
          if (deleteSet.size > 0) {
            updatedEntries = updatedEntries.filter(e => !deleteSet.has(e.id));
          }
          const editMap = new Map(mutation.toEdit.map(e => [e.id, e]));
          if (editMap.size > 0) {
            updatedEntries = updatedEntries.map(e => {
              const edited = editMap.get(e.id);
              if (edited) {
                return {
                  ...edited,
                  projectName: updatedProjects.find(p => p.id === edited.projectId)?.name || e.projectName || ''
                };
              }
              return e;
            });
          }
          mutation.toAdd.forEach(newEntry => {
            const entryWithUser = {
              ...newEntry,
              loggedByName: newEntry.loggedByName || googleUser?.displayName || 'Anonymous Teammate',
              loggedByEmail: newEntry.loggedByEmail || googleUser?.email || '',
              projectName: updatedProjects.find(p => p.id === newEntry.projectId)?.name || ''
            };
            updatedEntries.push(entryWithUser);
          });
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
        if (mutation.type === 'addEntry' || mutation.type === 'editEntry') {
          checkBudgetAlerts(mutation.entry.projectId, updatedEntries, updatedProjects);
        } else if (mutation.type === 'batchUpdateEntries') {
          const touchedProjectIds = new Set([
            ...mutation.toAdd.map(e => e.projectId),
            ...mutation.toEdit.map(e => e.projectId)
          ]);
          touchedProjectIds.forEach(pId => {
            checkBudgetAlerts(pId, updatedEntries, updatedProjects);
          });
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
      } else if (mutation.type === 'batchUpdateEntries') {
        let updated = [...entries];
        const deleteSet = new Set(mutation.toDeleteIds);
        if (deleteSet.size > 0) {
          updated = updated.filter(e => !deleteSet.has(e.id));
        }
        const editMap = new Map(mutation.toEdit.map(e => [e.id, e]));
        if (editMap.size > 0) {
          updated = updated.map(e => editMap.get(e.id) || e);
        }
        mutation.toAdd.forEach(newEntry => {
          updated.push(newEntry);
        });
        setEntries(updated);
        saveEntries(updated);
        const touchedProjectIds = new Set([
          ...mutation.toAdd.map(e => e.projectId),
          ...mutation.toEdit.map(e => e.projectId)
        ]);
        touchedProjectIds.forEach(pId => {
          checkBudgetAlerts(pId, updated, projects);
        });
      }
    }
  };

  // Add project handler
  const handleAddProject = async (newProj: Omit<Project, 'id' | 'createdAt'>) => {
    const project: Project = {
      status: 'active',
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

  // Batch update timesheet entries (for Matrix grid & quick fill)
  const handleBatchUpdateEntries = async (params: {
    toAdd: TimeEntry[];
    toEdit: TimeEntry[];
    toDeleteIds: string[];
  }) => {
    await applyMutation({ type: 'batchUpdateEntries', ...params });
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
          {/* Google Sheets Sync Controller */}
          <div className="flex items-center space-x-1">
            {isReauthNeeded ? (
              <button
                onClick={() => handleGoogleLogin(false)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50/95 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 cursor-pointer text-[11px] sm:text-xs font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-sm animate-pulse"
                title="Google session expired. Click to re-authenticate."
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">⚠️ Re-authenticate</span>
                <span className="sm:hidden">Reconnect</span>
              </button>
            ) : googleUser === null && !accessToken ? (
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
          {/* 1-Click Connection Hero Card & Status Banner */}
          {isReauthNeeded ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-5 sm:p-6 rounded-2xl border-2 border-rose-500/80 dark:border-rose-600 bg-rose-50/95 dark:bg-rose-950/40 shadow-xl print:hidden relative overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
                <div className="flex items-start space-x-3.5 max-w-2xl">
                  <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-sm sm:text-base font-extrabold font-mono text-rose-950 dark:text-rose-100 uppercase tracking-wider">
                        Google Sheets Disconnected — Re-Authentication Needed
                      </span>
                    </div>

                    <p className="text-xs text-rose-900/90 dark:text-rose-200/90 leading-relaxed font-sans">
                      Your Google authorization session has expired or the connection was interrupted. Real-time sync to your Google Sheets database is paused.
                    </p>

                    {/* Step-by-Step Guidance */}
                    <div className="mt-2.5 p-3 rounded-xl bg-white/80 dark:bg-black/40 border border-rose-200/70 dark:border-rose-900/40 text-xs font-mono space-y-1.5 text-zinc-800 dark:text-zinc-200">
                      <div className="font-bold text-[11px] uppercase tracking-wide text-rose-900 dark:text-rose-300 flex items-center space-x-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Steps to Restore Connection:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-700 dark:text-zinc-300 leading-normal pl-0.5">
                        <li>
                          <strong>Click "Reconnect Google (1-Click)"</strong> below to renew your authorization.
                        </li>
                        <li>
                          <strong>Zero data loss:</strong> All pending entries are safely preserved in browser cache and will automatically sync once signed in.
                        </li>
                        <li>
                          If permissions changed or you need a different sheet, click <strong>"Sync Settings"</strong> to update the sheet link.
                        </li>
                      </ol>
                    </div>

                    {authErrorMessage && (
                      <div className="text-[10px] font-mono text-rose-800/80 dark:text-rose-300/80 pt-0.5">
                        Status details: <code className="bg-rose-100 dark:bg-rose-900/50 px-1 py-0.5 rounded">{authErrorMessage}</code>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full lg:w-auto">
                  <button
                    onClick={() => handleGoogleLogin(false)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-mono font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Reconnect Google (1-Click)</span>
                  </button>
                  <button
                    onClick={() => safeSyncRefresh()}
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    title="Retry background synchronization"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingState === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Retry Sync</span>
                  </button>
                  <button
                    onClick={() => setShowSyncPanel(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/80 dark:bg-zinc-850 hover:bg-white dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-mono font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                    title="Configure Google Sheets integration settings"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>Sync Settings</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : isNotConnected ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-5 rounded-2xl border-2 border-amber-300 dark:border-amber-800/80 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-orange-500/15 dark:from-amber-950/40 dark:via-amber-950/20 dark:to-orange-950/40 shadow-xl print:hidden relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-start space-x-3.5">
                  <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/30 shrink-0 mt-0.5">
                    <Database className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                      <span className="text-sm sm:text-base font-extrabold font-mono text-amber-950 dark:text-amber-100 uppercase tracking-wider">
                        1-Click Google Sheets Database Setup
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed font-sans max-w-2xl">
                      Logging hours requires an active Google Sheets database connection to sync timesheets in real-time with your team and eliminate data loss.
                    </p>
                    <div className="pt-1 text-[11px] font-mono text-amber-950/80 dark:text-amber-300/80">
                      <strong>Quick Setup:</strong> Click "Connect Google Sheets" to authorize with 1-click. A structured team sheet will be linked automatically.
                    </div>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2.5 shrink-0 w-full md:w-auto">
                  <button
                    onClick={() => handleGoogleLogin(false)}
                    className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-mono font-bold text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Database className="w-4 h-4" />
                    <span>Connect Google Sheets (1-Click)</span>
                  </button>
                  <button
                    onClick={() => setShowSyncPanel(true)}
                    className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl bg-white/90 dark:bg-zinc-800/90 hover:bg-white dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono font-bold text-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>Paste Sheet Link</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
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
              {/* Timesheet Entry Mode Switcher (Matches user screenshot) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 shadow-sm print:hidden">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  TIMESHEET ENTRY MODE:
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setTimesheetEntryMode('single');
                      localStorage.setItem('timesheet_entry_mode', 'single');
                    }}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                      timesheetEntryMode === 'single'
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Single Entry Form</span>
                  </button>
                  <button
                    onClick={() => {
                      setTimesheetEntryMode('matrix');
                      localStorage.setItem('timesheet_entry_mode', 'matrix');
                    }}
                    className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
                      timesheetEntryMode === 'matrix'
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Monday–Sunday Matrix</span>
                  </button>
                </div>
              </div>

              {/* Active Entry Component */}
              <div className="print:hidden">
                {timesheetEntryMode === 'matrix' ? (
                  <WeeklyTimesheetMatrix
                    projects={projects}
                    entries={entries}
                    onBatchUpdateEntries={handleBatchUpdateEntries}
                    isConnected={isFullyConnected}
                    isReauthNeeded={isReauthNeeded}
                    onConnectDatabase={() => {
                      if (isReauthNeeded) {
                        handleGoogleLogin(false);
                      } else {
                        setShowSyncPanel(true);
                        if (!googleUser && !accessToken) {
                          handleGoogleLogin(false);
                        }
                      }
                    }}
                    currentUserEmail={googleUser?.email || null}
                    currentUserName={googleUser?.displayName || null}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                ) : (
                  <TimesheetForm
                    projects={projects}
                    onAddEntry={handleAddEntry}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    isConnected={isFullyConnected}
                    isReauthNeeded={isReauthNeeded}
                    onConnectDatabase={() => {
                      if (isReauthNeeded) {
                        handleGoogleLogin(false);
                      } else {
                        setShowSyncPanel(true);
                        if (!googleUser && !accessToken) {
                          handleGoogleLogin(false);
                        }
                      }
                    }}
                  />
                )}
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

        {/* Reconnected Toast Notification */}
        <AnimatePresence>
          {reconnectedNotice && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="fixed bottom-6 left-6 z-50 flex items-center justify-between p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/95 dark:bg-[#112419]/95 text-emerald-950 dark:text-emerald-100 shadow-2xl max-w-md w-[calc(100vw-3rem)] sm:w-96 font-mono text-xs backdrop-blur-md print:hidden"
            >
              <div className="flex items-start space-x-3 pr-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Database className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <p className="font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider text-[11px]">
                      Database Reconnected
                    </p>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed">
                    {reconnectedNotice}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center shrink-0 border-l border-emerald-200 dark:border-emerald-800/60 pl-3">
                <button
                  onClick={() => setReconnectedNotice(null)}
                  className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                  title="Dismiss Reconnected Notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
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
                        Google Sheets Cloud Database
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        Mandatory live team database connection
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
                      {/* Database Guard Notice */}
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 dark:text-amber-200 font-mono space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="font-bold text-[11px] uppercase tracking-wide">Database Guard Active</span>
                        </div>
                        <p className="text-[10.5px] text-amber-800 dark:text-amber-300 leading-relaxed font-sans">
                          Logging time entries requires an active Google Sheets database connection to prevent unbacked logs and guarantee team data integrity.
                        </p>
                      </div>

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
                          If your Team Lead shared a Google Sheet with you, paste its URL or ID below to join the team database. Otherwise, we will automatically create one in your Drive.
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
                          Connect your Google Account. Existing database records and local entries will be merged safely without wiping any data.
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
                              <span>Database connection paused or credentials expired.</span>
                            </p>
                            <p className="text-[9.5px] text-zinc-500 dark:text-zinc-400 leading-normal font-mono">
                              Click <strong className="text-blue-600 dark:text-blue-400">Reconnect</strong> to authenticate again, or <strong className="text-emerald-600 dark:text-emerald-400">Sync Now</strong> to retry. No data will be wiped.
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
                        Google Sheets Cloud Database
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        How team synchronization works
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
                          Mandatory Database Connection
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          To guarantee data integrity and multi-user sync, logging time entries requires an active Google Sheets database connection.
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
                          Non-Destructive State Merging
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          When joining a team sheet or logging in for the first time, existing sheet entries and local state are automatically combined. No records are ever wiped or lost.
                        </p>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex gap-3">
                      <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-500 border border-amber-100 dark:border-amber-900/15 mt-0.5">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                          30-Second Silent Team Synchronization
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          The app background-polls the Google Sheet every 30 seconds to fetch teammate updates without disturbing your current form edits or triggering unnecessary re-renders.
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
                          Seamless Reconnect
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          If authentication tokens expire or your connection drops, simply click <span className="font-bold text-zinc-750 dark:text-zinc-350">"Reconnect"</span> in the Sync Panel to refresh authorization and synchronize all pending changes instantly.
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
