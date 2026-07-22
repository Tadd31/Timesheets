/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, TimeEntry, Tag, BudgetAlert, Agency } from '../types';

// Primary stable keys that will never change across versions
const PRIMARY_PROJECTS_KEY = 'timesheet_recorder_projects_data';
const PRIMARY_ENTRIES_KEY = 'timesheet_recorder_entries_data';
const PRIMARY_TAGS_KEY = 'timesheet_recorder_tags_data';
const PRIMARY_ALERTS_KEY = 'timesheet_recorder_alerts_data';
const PRIMARY_AGENCIES_KEY = 'timesheet_recorder_agencies_data';
const DARK_MODE_KEY = 'timesheet_recorder_dark_mode';

// Candidate keys from older/previous versions for backwards compatibility & auto-migration
const PROJECT_KEYS = [
  PRIMARY_PROJECTS_KEY,
  'timesheet_recorder_projects_fresh_v2',
  'timesheet_recorder_projects_fresh_v1',
  'timesheet_recorder_projects_fresh',
  'timesheet_recorder_projects_v2',
  'timesheet_recorder_projects_v1',
  'timesheet_recorder_projects',
  'timesheet_projects',
  'projects'
];

const ENTRY_KEYS = [
  PRIMARY_ENTRIES_KEY,
  'timesheet_recorder_entries_fresh_v2',
  'timesheet_recorder_entries_fresh_v1',
  'timesheet_recorder_entries_fresh',
  'timesheet_recorder_entries_v2',
  'timesheet_recorder_entries_v1',
  'timesheet_recorder_entries',
  'timesheet_entries',
  'entries'
];

const TAG_KEYS = [
  PRIMARY_TAGS_KEY,
  'timesheet_recorder_tags_fresh_v2',
  'timesheet_recorder_tags_fresh_v1',
  'timesheet_recorder_tags_v2',
  'timesheet_recorder_tags_v1',
  'timesheet_recorder_tags',
  'timesheet_tags',
  'tags'
];

const ALERT_KEYS = [
  PRIMARY_ALERTS_KEY,
  'timesheet_recorder_alerts_fresh_v2',
  'timesheet_recorder_alerts_fresh_v1',
  'timesheet_recorder_alerts_v2',
  'timesheet_recorder_alerts',
  'timesheet_alerts'
];

const AGENCY_KEYS = [
  PRIMARY_AGENCIES_KEY,
  'timesheet_recorder_agencies_v1',
  'timesheet_recorder_agencies',
  'agencies'
];

const INITIAL_PROJECTS: Project[] = [];
const INITIAL_ENTRIES: TimeEntry[] = [];
const INITIAL_TAGS: Tag[] = [
  { id: 'tag-1', name: 'Frontend', colorCode: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  { id: 'tag-2', name: 'Backend', colorCode: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  { id: 'tag-3', name: 'Design', colorCode: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  { id: 'tag-4', name: 'Meeting', colorCode: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  { id: 'tag-5', name: 'Research', colorCode: 'bg-pink-500/15 text-pink-600 border-pink-500/30' }
];
const INITIAL_ALERTS: BudgetAlert[] = [];
const INITIAL_AGENCIES: Agency[] = [];

// Helper to find non-empty array data across candidate keys
function loadFromCandidateKeys<T>(keys: string[]): T | null {
  for (const key of keys) {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as unknown as T;
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return null;
}

export function getProjects(): Project[] {
  const found = loadFromCandidateKeys<Project[]>(PROJECT_KEYS);
  if (found) {
    saveProjects(found); // migrate to primary + legacy keys
    return found;
  }
  return INITIAL_PROJECTS;
}

export function saveProjects(projects: Project[]): void {
  const json = JSON.stringify(projects);
  localStorage.setItem(PRIMARY_PROJECTS_KEY, json);
  localStorage.setItem('timesheet_recorder_projects_fresh_v2', json);
}

export function getEntries(): TimeEntry[] {
  const found = loadFromCandidateKeys<TimeEntry[]>(ENTRY_KEYS);
  if (found) {
    saveEntries(found); // migrate to primary + legacy keys
    return found;
  }
  return INITIAL_ENTRIES;
}

export function saveEntries(entries: TimeEntry[]): void {
  const json = JSON.stringify(entries);
  localStorage.setItem(PRIMARY_ENTRIES_KEY, json);
  localStorage.setItem('timesheet_recorder_entries_fresh_v2', json);
}

export function getDarkMode(): boolean {
  const data = localStorage.getItem(DARK_MODE_KEY);
  return data ? JSON.parse(data) : true;
}

export function saveDarkMode(isDark: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDark));
}

export function getTags(): Tag[] {
  const found = loadFromCandidateKeys<Tag[]>(TAG_KEYS);
  if (found) {
    saveTags(found);
    return found;
  }
  saveTags(INITIAL_TAGS);
  return INITIAL_TAGS;
}

export function saveTags(tags: Tag[]): void {
  const json = JSON.stringify(tags);
  localStorage.setItem(PRIMARY_TAGS_KEY, json);
  localStorage.setItem('timesheet_recorder_tags_fresh_v2', json);
}

export function getAlerts(): BudgetAlert[] {
  const found = loadFromCandidateKeys<BudgetAlert[]>(ALERT_KEYS);
  if (found) {
    saveAlerts(found);
    return found;
  }
  return INITIAL_ALERTS;
}

export function saveAlerts(alerts: BudgetAlert[]): void {
  const json = JSON.stringify(alerts);
  localStorage.setItem(PRIMARY_ALERTS_KEY, json);
  localStorage.setItem('timesheet_recorder_alerts_fresh_v2', json);
}

export function getAgencies(): Agency[] {
  const found = loadFromCandidateKeys<Agency[]>(AGENCY_KEYS);
  const parsed = found || INITIAL_AGENCIES;
  const filtered = parsed.filter(
    (a) => a.name !== 'Aether Digital' && a.name !== 'Vanguard Creative'
  );
  if (filtered.length > 0) {
    saveAgencies(filtered);
    return filtered;
  }
  return INITIAL_AGENCIES;
}

export function saveAgencies(agencies: Agency[]): void {
  const json = JSON.stringify(agencies);
  localStorage.setItem(PRIMARY_AGENCIES_KEY, json);
  localStorage.setItem('timesheet_recorder_agencies_v1', json);
}
