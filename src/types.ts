/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  name: string;
  estimatedHours: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description?: string;
  agencyName?: string;
  brandName?: string;
  rate?: number; // Hourly rate
  isNonBillable?: boolean;
  createdAt: string;
  budget_hours?: number | null; // Nullable float
  alert_thresholds?: number[]; // Array of percentages
}

export interface Tag {
  id: string;
  name: string; // unique
  colorCode: string; // e.g. #3B82F6 or Tailwind text/bg pairs
}

export interface TimeEntry {
  id: string;
  projectId: string; // References Project.id
  date: string; // YYYY-MM-DD
  hours: number;
  comment: string;
  coffees: number;
  createdAt: string;
  tagIds?: string[]; // References Tag.id
}

export interface BudgetAlert {
  id: string;
  projectId: string;
  projectName: string;
  threshold: number; // e.g. 50, 75, 90, 100
  currentHours: number;
  budgetHours: number;
  percentage: number;
  timestamp: string;
  dismissed: boolean;
}

export interface HumorQuote {
  quote: string;
  author: string;
  trigger?: 'monday' | 'friday' | 'overtime' | 'underworked' | 'general';
}
