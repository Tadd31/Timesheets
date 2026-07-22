/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats date strings into DD-MM-YY format (e.g. 25-07-26)
 */
export function formatDateDMY(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  
  // Match YYYY-MM-DD pattern at start of string
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year.slice(-2)}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }

  return dateStr;
}
