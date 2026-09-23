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

/**
 * Calculates billable spend for a project given hours logged
 */
export function calculateProjectSpend(project: any | undefined, hours: number): number {
  if (!project || project.isNonBillable || hours <= 0) return 0;
  if (project.dayRate && project.dayRate > 0) {
    const hoursInDay = project.hoursInDay || 7.5;
    return (hours / hoursInDay) * project.dayRate;
  }
  if (project.rate && project.rate > 0) {
    return hours * project.rate;
  }
  return 0;
}

/**
 * Formats rate label for project (e.g. £800/d or £100/h)
 */
export function getProjectRateLabel(project: any | undefined): string {
  if (!project) return '';
  if (project.isNonBillable) return 'Non-billable';
  if (project.dayRate && project.dayRate > 0) return `£${project.dayRate}/d`;
  if (project.rate && project.rate > 0) return `£${project.rate}/h`;
  return '';
}
