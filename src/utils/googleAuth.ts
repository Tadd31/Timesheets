/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Project, TimeEntry } from '../types';

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
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
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
          range: 'Projects!A1:K1',
          values: [['ID', 'Name', 'Agency Name', 'Brand Name', 'Rate ($)', 'Estimated Hours', 'Budget Hours', 'Start Date', 'End Date', 'Is Non-Billable', 'Created At']]
        },
        {
          range: 'Timesheet Entries!A1:H1',
          values: [['ID', 'Project ID', 'Date', 'Hours', 'Comment', 'Coffees Logged', 'Tag IDs', 'Created At']]
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
  entries: TimeEntry[]
): Promise<void> {
  // First clear any existing rows below row 1
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
  const clearRes = await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ranges: ['Projects!A2:K10000', 'Timesheet Entries!A2:H10000']
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
    p.createdAt || ""
  ]);

  const entryRows = entries.map(e => [
    e.id,
    e.projectId,
    e.date,
    e.hours,
    e.comment || "",
    e.coffees !== undefined && e.coffees !== null ? e.coffees : 0,
    e.tagIds ? e.tagIds.join(",") : "",
    e.createdAt || ""
  ]);

  const data: any[] = [];
  if (projectRows.length > 0) {
    data.push({
      range: `Projects!A2:K${projectRows.length + 1}`,
      values: projectRows
    });
  } else {
    data.push({
      range: `Projects!A2:K2`,
      values: [["", "", "", "", "", "", "", "", "", "", ""]]
    });
  }
  if (entryRows.length > 0) {
    data.push({
      range: `Timesheet Entries!A2:H${entryRows.length + 1}`,
      values: entryRows
    });
  } else {
    data.push({
      range: `Timesheet Entries!A2:H2`,
      values: [["", "", "", "", "", "", "", ""]]
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
): Promise<{ projects: Project[]; entries: TimeEntry[] }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Projects!A2:K10000&ranges=Timesheet%20Entries!A2:H10000`;
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
      createdAt: row[10] || new Date().toISOString(),
    };
  }).filter((p: any): p is Project => p !== null);

  const loadedEntries: TimeEntry[] = entryRows.map((row: any) => {
    if (!row || row.length === 0 || !row[0]) return null;
    return {
      id: row[0],
      projectId: row[1] || "",
      date: row[2] || "",
      hours: row[3] !== undefined && row[3] !== "" ? Number(row[3]) : 0,
      comment: row[4] || "",
      coffees: row[5] !== undefined && row[5] !== "" ? Number(row[5]) : 0,
      tagIds: row[6] ? row[6].split(",").filter(Boolean) : [],
      createdAt: row[7] || new Date().toISOString(),
    };
  }).filter((e: any): e is TimeEntry => e !== null);

  return { projects: loadedProjects, entries: loadedEntries };
}
