/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Project, TimeEntry, Agency } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets and Drive permissions
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  let unsubscribe: (() => void) | null = null;

  // Retrieve cached token if exists
  const savedToken = localStorage.getItem('timesheet_recorder_google_access_token');
  if (savedToken) {
    cachedAccessToken = savedToken;
  }

  // Check for redirect result first (useful in standard tabs or PWA mode)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('timesheet_recorder_google_access_token', credential.accessToken);
          if (result.user && onAuthSuccess) {
            onAuthSuccess(result.user, credential.accessToken);
          }
        }
      }
    })
    .catch((error) => {
      console.error('Error handling redirect result:', error);
    })
    .finally(() => {
      // Set up onAuthStateChanged observer after redirect check completes
      unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          // If we have a user but no access token, check local storage again
          const token = cachedAccessToken || localStorage.getItem('timesheet_recorder_google_access_token');
          if (token) {
            cachedAccessToken = token;
            if (onAuthSuccess) onAuthSuccess(user, token);
          } else if (!isSigningIn) {
            cachedAccessToken = null;
            if (onAuthFailure) onAuthFailure();
          }
        } else {
          cachedAccessToken = null;
          localStorage.removeItem('timesheet_recorder_google_access_token');
          if (onAuthFailure) onAuthFailure();
        }
      });
    });

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

export const googleSignIn = async (useRedirect = false): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    if (useRedirect) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      localStorage.setItem('timesheet_recorder_google_access_token', credential.accessToken);
      return { user: result.user, accessToken: cachedAccessToken };
    }
    return null;
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('timesheet_recorder_google_access_token');
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('timesheet_recorder_google_access_token');
};

// Spreadsheet API interactions

export async function findSpreadsheet(accessToken: string): Promise<string | null> {
  const url = `https://www.googleapis.com/drive/v3/files?q=name='Timesheet Recorder Database' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name)`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Error finding spreadsheet:', err);
      return null;
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (e) {
    console.error('Find spreadsheet fetch failed:', e);
    return null;
  }
}

export async function ensureAgenciesSheet(accessToken: string, spreadsheetId: string): Promise<void> {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      const titles = (data.sheets || []).map((s: any) => s.properties?.title);
      if (!titles.includes('Registered Agencies')) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: 'Registered Agencies' }
              }
            }]
          })
        });
      }
    }
  } catch (e) {
    console.warn('Failed to ensure Registered Agencies sheet tab:', e);
  }
}

export async function createSpreadsheet(accessToken: string): Promise<string> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Timesheet Recorder Database'
      },
      sheets: [
        {
          properties: {
            title: 'Projects'
          }
        },
        {
          properties: {
            title: 'Timesheet Entries'
          }
        },
        {
          properties: {
            title: 'Registered Agencies'
          }
        }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create spreadsheet: ${err}`);
  }
  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;

  // Now, let's write the headers to the sheets using batchUpdate
  await writeHeaders(accessToken, spreadsheetId);

  return spreadsheetId;
}

export async function writeHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  await ensureAgenciesSheet(accessToken, spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: 'Projects!A1:O1',
          values: [['ID', 'Name', 'Agency Name', 'Brand Name', 'Rate ($)', 'Estimated Hours', 'Budget Hours', 'Start Date', 'End Date', 'Is Non-Billable', 'Created By', 'Created At', 'Description', 'Day Rate', 'Hours in Day']]
        },
        {
          range: 'Timesheet Entries!A1:K1',
          values: [['ID', 'Project ID', 'Project Name', 'Date', 'Hours', 'Comment', 'Coffees Logged', 'Tag IDs', 'Logged By Name', 'Logged By Email', 'Created At']]
        },
        {
          range: 'Registered Agencies!A1:G1',
          values: [['ID', 'Name', 'Address', 'URL', 'Contact Email', 'Finance Email', 'Created At']]
        }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Failed to write headers:', err);
  }
}

export async function syncDataToSheet(
  accessToken: string,
  spreadsheetId: string,
  projects: Project[],
  entries: TimeEntry[],
  agencies: Agency[] = []
): Promise<void> {
  await ensureAgenciesSheet(accessToken, spreadsheetId);

  // First clear any existing rows below row 1
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
  const clearRes = await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ranges: ['Projects!A2:O10000', 'Timesheet Entries!A2:K10000', 'Registered Agencies!A2:G10000']
    })
  });
  if (!clearRes.ok) {
    const err = await clearRes.text();
    console.warn('Clear sheets failed, proceeding with update anyway:', err);
  }

  // Then write the new values
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  
  const projectRows = projects.map(p => [
    p.id,
    p.name,
    p.agencyName || "",
    p.brandName || "",
    p.rate !== undefined && p.rate !== null ? p.rate : "",
    p.estimatedHours !== undefined && p.estimatedHours !== null ? p.estimatedHours : 0,
    p.budget_hours !== undefined && p.budget_hours !== null ? p.budget_hours : "",
    p.startDate || "",
    p.endDate || "",
    p.isNonBillable ? "TRUE" : "FALSE",
    p.createdBy || "",
    p.createdAt || "",
    p.description || "",
    p.dayRate !== undefined && p.dayRate !== null ? p.dayRate : "",
    p.hoursInDay !== undefined && p.hoursInDay !== null ? p.hoursInDay : ""
  ]);

  const entryRows = entries.map(e => {
    const projName = e.projectName || projects.find(p => p.id === e.projectId)?.name || "";
    return [
      e.id,
      e.projectId,
      projName,
      e.date,
      e.hours,
      e.comment || "",
      e.coffees !== undefined && e.coffees !== null ? e.coffees : 0,
      e.tagIds ? e.tagIds.join(",") : "",
      e.loggedByName || "",
      e.loggedByEmail || "",
      e.createdAt || ""
    ];
  });

  const agencyRows = agencies.map(a => [
    a.id,
    a.name || "",
    a.address || "",
    a.url || "",
    a.contactEmail || "",
    a.financeEmail || "",
    a.createdAt || ""
  ]);

  const data: any[] = [];
  if (projectRows.length > 0) {
    data.push({
      range: `Projects!A2:O${projectRows.length + 1}`,
      values: projectRows
    });
  } else {
    data.push({
      range: `Projects!A2:O2`,
      values: [["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]]
    });
  }
  if (entryRows.length > 0) {
    data.push({
      range: `Timesheet Entries!A2:K${entryRows.length + 1}`,
      values: entryRows
    });
  } else {
    data.push({
      range: `Timesheet Entries!A2:K2`,
      values: [["", "", "", "", "", "", "", "", "", "", ""]]
    });
  }
  if (agencyRows.length > 0) {
    data.push({
      range: `Registered Agencies!A2:G${agencyRows.length + 1}`,
      values: agencyRows
    });
  } else {
    data.push({
      range: `Registered Agencies!A2:G2`,
      values: [["", "", "", "", "", "", ""]]
    });
  }

  const writeRes = await fetch(writeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: data
    })
  });

  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`Failed to write values to sheet: ${err}`);
  }
}

export async function loadDataFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{ projects: Project[]; entries: TimeEntry[]; agencies: Agency[] }> {
  await ensureAgenciesSheet(accessToken, spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Projects!A2:O10000&ranges=Timesheet%20Entries!A2:K10000&ranges=Registered%20Agencies!A2:G10000`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read data from sheet: ${err}`);
  }
  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  const projectRows = valueRanges[0]?.values || [];
  const entryRows = valueRanges[1]?.values || [];
  const agencyRows = valueRanges[2]?.values || [];

  const loadedProjects: Project[] = projectRows.map((row: any) => {
    if (!row || row.length === 0 || !row[0]) return null;
    return {
      id: row[0],
      name: row[1] || "Unnamed Project",
      agencyName: row[2] || undefined,
      brandName: row[3] || undefined,
      rate: row[4] !== undefined && row[4] !== "" ? Number(row[4]) : undefined,
      estimatedHours: row[5] !== undefined && row[5] !== "" ? Number(row[5]) : 0,
      budget_hours: row[6] !== undefined && row[6] !== "" ? Number(row[6]) : null,
      startDate: row[7] || "",
      endDate: row[8] || "",
      isNonBillable: row[9] === "TRUE",
      createdBy: row[10] || "",
      createdAt: row[11] || new Date().toISOString(),
      description: row[12] || undefined,
      dayRate: row[13] !== undefined && row[13] !== "" ? Number(row[13]) : undefined,
      hoursInDay: row[14] !== undefined && row[14] !== "" ? Number(row[14]) : undefined,
    };
  }).filter((p: any): p is Project => p !== null);

  const loadedEntries: TimeEntry[] = entryRows.map((row: any) => {
    if (!row || row.length === 0 || !row[0]) return null;
    return {
      id: row[0],
      projectId: row[1] || "",
      projectName: row[2] || "",
      date: row[3] || "",
      hours: row[4] !== undefined && row[4] !== "" ? Number(row[4]) : 0,
      comment: row[5] || "",
      coffees: row[6] !== undefined && row[6] !== "" ? Number(row[6]) : 0,
      tagIds: row[7] ? row[7].split(",").filter(Boolean) : [],
      loggedByName: row[8] || "",
      loggedByEmail: row[9] || "",
      createdAt: row[10] || new Date().toISOString(),
    };
  }).filter((e: any): e is TimeEntry => e !== null);

  const loadedAgencies: Agency[] = agencyRows.map((row: any) => {
    if (!row || row.length === 0 || !row[0]) return null;
    return {
      id: row[0],
      name: row[1] || "",
      address: row[2] || "",
      url: row[3] || "",
      contactEmail: row[4] || "",
      financeEmail: row[5] || "",
      createdAt: row[6] || new Date().toISOString(),
    };
  }).filter((a: any): a is Agency => a !== null);

  return { projects: loadedProjects, entries: loadedEntries, agencies: loadedAgencies };
}
