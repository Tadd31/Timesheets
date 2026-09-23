/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, TimeEntry, Agency } from '../types';

export interface SheetDataPayload {
  projects: Project[];
  entries: TimeEntry[];
  agencies: Agency[];
}

/**
 * Pure, deterministic utility function to resolve data received from the database (Google Sheets).
 * The connected cloud database is the single source of truth. If the sheet contains data,
 * it is authoritative. If the sheet is brand-new and empty, initial data is seeded.
 */
export function mergeSheetAndLocalData(
  loaded: SheetDataPayload,
  local: SheetDataPayload
): SheetDataPayload {
  // If the cloud database sheet already has projects, entries, or agencies,
  // the cloud database is the absolute source of truth.
  if (loaded.projects.length > 0 || loaded.entries.length > 0 || loaded.agencies.length > 0) {
    return loaded;
  }

  // Only if the database sheet is completely blank (e.g. freshly created empty sheet),
  // seed from initial local state:
  return local;
}

/**
 * Compares two payloads to determine if they contain identical data.
 * Used by background polling to prevent unnecessary React re-renders when data hasn't changed.
 */
export function isDataEqual(a: SheetDataPayload, b: SheetDataPayload): boolean {
  if (
    a.projects.length !== b.projects.length ||
    a.entries.length !== b.entries.length ||
    a.agencies.length !== b.agencies.length
  ) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
