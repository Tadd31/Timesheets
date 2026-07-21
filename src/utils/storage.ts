/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, TimeEntry, Tag, BudgetAlert, Agency } from '../types';

const PROJECTS_KEY = 'timesheet_recorder_projects_fresh_v2';
const ENTRIES_KEY = 'timesheet_recorder_entries_fresh_v2';
const DARK_MODE_KEY = 'timesheet_recorder_dark_mode';
const TAGS_KEY = 'timesheet_recorder_tags_fresh_v2';
const ALERTS_KEY = 'timesheet_recorder_alerts_fresh_v2';
const AGENCIES_KEY = 'timesheet_recorder_agencies_v1';

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

export function getProjects(): Project[] {
  const data = localStorage.getItem(PROJECTS_KEY);
  if (!data) {
    saveProjects(INITIAL_PROJECTS);
    return INITIAL_PROJECTS;
  }
  return JSON.parse(data);
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getEntries(): TimeEntry[] {
  const data = localStorage.getItem(ENTRIES_KEY);
  if (!data) {
    saveEntries(INITIAL_ENTRIES);
    return INITIAL_ENTRIES;
  }
  return JSON.parse(data);
}

export function saveEntries(entries: TimeEntry[]): void {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function getDarkMode(): boolean {
  const data = localStorage.getItem(DARK_MODE_KEY);
  return data ? JSON.parse(data) : true; // Default to dark mode because it fits the sleek look nicely, or support toggles
}

export function saveDarkMode(isDark: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, JSON.stringify(isDark));
}

export function getTags(): Tag[] {
  const data = localStorage.getItem(TAGS_KEY);
  if (!data) {
    saveTags(INITIAL_TAGS);
    return INITIAL_TAGS;
  }
  return JSON.parse(data);
}

export function saveTags(tags: Tag[]): void {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export function getAlerts(): BudgetAlert[] {
  const data = localStorage.getItem(ALERTS_KEY);
  if (!data) {
    saveAlerts(INITIAL_ALERTS);
    return INITIAL_ALERTS;
  }
  return JSON.parse(data);
}

export function saveAlerts(alerts: BudgetAlert[]): void {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function getAgencies(): Agency[] {
  const data = localStorage.getItem(AGENCIES_KEY);
  if (!data) {
    saveAgencies(INITIAL_AGENCIES);
    return INITIAL_AGENCIES;
  }
  const parsed = JSON.parse(data) as Agency[];
  const filtered = parsed.filter(
    (a) => a.name !== 'Aether Digital' && a.name !== 'Vanguard Creative'
  );
  if (filtered.length !== parsed.length) {
    saveAgencies(filtered);
    return filtered;
  }
  return parsed;
}

export function saveAgencies(agencies: Agency[]): void {
  localStorage.setItem(AGENCIES_KEY, JSON.stringify(agencies));
}

