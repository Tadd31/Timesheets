/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Project, TimeEntry } from '../types';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  AlertCircle, 
  Check, 
  Info,
  ClipboardCheck,
  ShieldCheck,
  Coffee,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateProjectSpend, getProjectRateLabel } from '../utils/formatters';

interface WeeklyTimesheetMatrixProps {
  projects: Project[];
  entries: TimeEntry[];
  onBatchUpdateEntries: (params: { toAdd: TimeEntry[]; toEdit: TimeEntry[]; toDeleteIds: string[] }) => Promise<void>;
  isConnected?: boolean;
  isReauthNeeded?: boolean;
  onConnectDatabase?: () => void;
  currentUserEmail?: string | null;
  currentUserName?: string | null;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function WeeklyTimesheetMatrix({
  projects,
  entries,
  onBatchUpdateEntries,
  isConnected = true,
  isReauthNeeded = false,
  onConnectDatabase,
  currentUserEmail,
  currentUserName,
  selectedDate,
  onSelectDate
}: WeeklyTimesheetMatrixProps) {
  // Current reference date for navigating weeks
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentWeekRefDate, setCurrentWeekRefDate] = useState<string>(selectedDate || todayStr);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeCellEdit, setActiveCellEdit] = useState<{ projectId: string; date: string; value: string } | null>(null);
  const [showReceipt, setShowReceipt] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate Monday to Sunday days for currentWeekRefDate
  const weekInfo = useMemo(() => {
    const [y, m, d] = currentWeekRefDate.split('-').map(Number);
    const ref = new Date(Date.UTC(y, m - 1, d));
    const day = ref.getUTCDay(); // 0 = Sun, 1 = Mon ...
    const diffToMonday = (day + 6) % 7;

    const monday = new Date(ref);
    monday.setUTCDate(ref.getUTCDate() - diffToMonday);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setUTCDate(monday.getUTCDate() + i);
      const dateIso = current.toISOString().split('T')[0];
      const dayNumber = current.getUTCDate();
      const monthName = MONTH_NAMES[current.getUTCMonth()];
      const isToday = dateIso === todayStr;

      days.push({
        dateStr: dateIso,
        dayShort: DAY_NAMES[i],
        dateDisplay: `${dayNumber} ${monthName}`,
        isToday,
        isWeekend: i === 5 || i === 6
      });
    }

    const startDay = days[0];
    const endDay = days[6];
    const year = startDay.dateStr.slice(0, 4);

    return {
      days,
      startIso: startDay.dateStr,
      endIso: endDay.dateStr,
      weekDisplay: `${startDay.dateDisplay} - ${endDay.dateDisplay} ${year}`
    };
  }, [currentWeekRefDate, todayStr]);

  // Navigate weeks
  const handlePrevWeek = () => {
    const [y, m, d] = currentWeekRefDate.split('-').map(Number);
    const current = new Date(Date.UTC(y, m - 1, d));
    current.setUTCDate(current.getUTCDate() - 7);
    const newDate = current.toISOString().split('T')[0];
    setCurrentWeekRefDate(newDate);
    if (onSelectDate) onSelectDate(newDate);
  };

  const handleNextWeek = () => {
    const [y, m, d] = currentWeekRefDate.split('-').map(Number);
    const current = new Date(Date.UTC(y, m - 1, d));
    current.setUTCDate(current.getUTCDate() + 7);
    const newDate = current.toISOString().split('T')[0];
    setCurrentWeekRefDate(newDate);
    if (onSelectDate) onSelectDate(newDate);
  };

  const handleThisWeek = () => {
    setCurrentWeekRefDate(todayStr);
    if (onSelectDate) onSelectDate(todayStr);
  };

  // Map entries for the current week into a fast lookup: projectId -> date -> TimeEntry[]
  // Single-user app: include all entries for this week directly
  const weekEntriesMap = useMemo(() => {
    const map: Record<string, Record<string, TimeEntry[]>> = {};
    const weekDatesSet = new Set(weekInfo.days.map(d => d.dateStr));

    entries.forEach(entry => {
      if (weekDatesSet.has(entry.date)) {
        if (!map[entry.projectId]) {
          map[entry.projectId] = {};
        }
        if (!map[entry.projectId][entry.date]) {
          map[entry.projectId][entry.date] = [];
        }
        map[entry.projectId][entry.date].push(entry);
      }
    });

    return map;
  }, [entries, weekInfo]);

  // Active projects for logging effort (Done projects are moved to Done Backlog and hidden from effort logging)
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status !== 'done');
  }, [projects]);

  // Calculate project hours and spends for the week
  const projectStats = useMemo(() => {
    const stats: Record<string, { totalHours: number; spend: number }> = {};
    let grandTotalHours = 0;
    let grandTotalSpend = 0;
    let activeProjectsCount = 0;

    activeProjects.forEach(project => {
      let pHours = 0;
      weekInfo.days.forEach(day => {
        const dayEntries = weekEntriesMap[project.id]?.[day.dateStr] || [];
        dayEntries.forEach(e => {
          pHours += e.hours;
        });
      });

      const pSpend = calculateProjectSpend(project, pHours);
      stats[project.id] = { totalHours: pHours, spend: pSpend };
      grandTotalHours += pHours;
      grandTotalSpend += pSpend;
      if (pHours > 0) {
        activeProjectsCount += 1;
      }
    });

    // Also calculate daily totals
    const dailyTotals: Record<string, number> = {};
    weekInfo.days.forEach(day => {
      let dHours = 0;
      activeProjects.forEach(project => {
        const dayEntries = weekEntriesMap[project.id]?.[day.dateStr] || [];
        dayEntries.forEach(e => {
          dHours += e.hours;
        });
      });
      dailyTotals[day.dateStr] = dHours;
    });

    return {
      stats,
      grandTotalHours,
      grandTotalSpend,
      dailyTotals,
      activeProjectsCount
    };
  }, [activeProjects, weekInfo, weekEntriesMap]);

  // Handler: Commit cell value change
  const handleCommitCell = async (projectId: string, date: string, rawValue: string) => {
    const val = rawValue.trim();
    const newHours = val === '' || val === '-' ? 0 : parseFloat(val);

    if (isNaN(newHours) || newHours < 0) {
      setActiveCellEdit(null);
      return;
    }

    const dayEntries = weekEntriesMap[projectId]?.[date] || [];
    const existing = dayEntries[0];

    const toAdd: TimeEntry[] = [];
    const toEdit: TimeEntry[] = [];
    const toDeleteIds: string[] = [];

    if (existing) {
      if (newHours === 0) {
        // Delete this entry and any duplicate entries for this cell
        dayEntries.forEach(e => toDeleteIds.push(e.id));
      } else {
        toEdit.push({
          ...existing,
          hours: Number(newHours.toFixed(2))
        });
        // If there were duplicate entries on same day, delete extra ones
        for (let i = 1; i < dayEntries.length; i++) {
          toDeleteIds.push(dayEntries[i].id);
        }
      }
    } else if (newHours > 0) {
      const proj = projects.find(p => p.id === projectId);
      toAdd.push({
        id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        projectId,
        date,
        hours: Number(newHours.toFixed(2)),
        comment: '',
        coffees: 0,
        createdAt: new Date().toISOString(),
        loggedByName: currentUserName || currentUserEmail || 'Author',
        loggedByEmail: currentUserEmail || '',
        projectName: proj?.name || ''
      });
    }

    setActiveCellEdit(null);

    if (toAdd.length > 0 || toEdit.length > 0 || toDeleteIds.length > 0) {
      try {
        setIsSubmitting(true);
        await onBatchUpdateEntries({ toAdd, toEdit, toDeleteIds });
      } catch (err) {
        console.error('Failed to update matrix entry:', err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handler: Clear all hours for project in this week
  const handleClearProjectWeek = async (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    const toDeleteIds: string[] = [];

    weekInfo.days.forEach(day => {
      const dayEntries = weekEntriesMap[projectId]?.[day.dateStr] || [];
      dayEntries.forEach(e => toDeleteIds.push(e.id));
    });

    if (toDeleteIds.length === 0) return;

    const confirmed = window.confirm(`Clear all ${toDeleteIds.length} logged hour entries for "${proj?.name || 'Project'}" during this week?`);
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await onBatchUpdateEntries({ toAdd: [], toEdit: [], toDeleteIds });
    } catch (err) {
      console.error('Failed to clear project week:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit to Corporate Auditors
  const handleSubmitToAuditors = () => {
    setErrorMessage(null);

    if (!isConnected) {
      if (isReauthNeeded) {
        setErrorMessage('Authentication expired. Please re-authenticate your Google account to sync and record hours.');
      } else {
        setErrorMessage('Active Google Sheets database connection is required before submitting hours. Please connect your database above.');
      }
      return;
    }

    if (projectStats.grandTotalHours <= 0) {
      setErrorMessage('No hours have been logged for this week yet. Enter hours in the matrix cells.');
      return;
    }

    setShowReceipt(true);
  };

  return (
    <div className="rounded-2xl border-t-4 border-orange-500 border-x border-b border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-lg overflow-hidden transition-colors">
      {/* Top Header Section */}
      <div className="p-5 sm:p-6 border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Title & Tag */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold font-mono tracking-widest text-orange-600 dark:text-orange-400 uppercase">
              WEEKLY LOGGING
            </span>
            <div className="flex items-center space-x-2.5">
              <Calendar className="w-5 h-5 text-orange-500 shrink-0" />
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono tracking-tight">
                Weekly Timesheet Matrix
              </h2>
            </div>
          </div>

          {/* Week navigation controls */}
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
            {/* Week Navigation */}
            <div className="flex items-center space-x-1.5 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <button
                onClick={handlePrevWeek}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2.5 py-0.5 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 select-none">
                {weekInfo.weekDisplay}
              </span>

              <button
                onClick={handleNextWeek}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Jump to This Week Button */}
            <button
              onClick={handleThisWeek}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-mono font-bold transition-all shadow-sm cursor-pointer"
            >
              This Week
            </button>
          </div>
        </div>

        {/* Database Warning Banner */}
        {!isConnected && (
          <div className="mt-4 p-3 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {isReauthNeeded
                  ? 'Google authorization session expired. Re-authenticate to resume real-time sync directly to the spreadsheet.'
                  : 'Google Sheets not connected. Connect your Google account to sync timesheet logs directly to the spreadsheet.'}
              </span>
            </div>
            {onConnectDatabase && (
              <button
                onClick={onConnectDatabase}
                className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-mono font-bold text-xs shadow transition-all cursor-pointer shrink-0"
              >
                {isReauthNeeded ? 'Reconnect Google' : 'Connect Sheets'}
              </button>
            )}
          </div>
        )}

        {/* Validation / Error Notice if submit triggered without requirements */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 dark:text-rose-400 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* The Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/80 text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              <th className="py-3 px-4 min-w-[220px]">PROJECT</th>
              {weekInfo.days.map((day) => (
                <th
                  key={day.dateStr}
                  className={`py-3 px-2 text-center w-16 sm:w-20 ${
                    day.isToday
                      ? 'bg-orange-50/80 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-b-2 border-orange-500'
                      : ''
                  }`}
                >
                  <div className="text-[11px] font-extrabold">{day.dayShort}</div>
                  <div className="text-[10px] font-medium opacity-80">{day.dateDisplay}</div>
                </th>
              ))}
              <th className="py-3 px-3 text-center w-16 font-extrabold">TOTAL</th>
              <th className="py-3 px-3 text-center w-24 font-extrabold text-orange-600 dark:text-orange-400">SPEND (£)</th>
              <th className="py-3 px-3 text-center w-24 font-extrabold">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono text-xs">
            {activeProjects.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-zinc-400 dark:text-zinc-500 font-mono">
                  {projects.length > 0
                    ? "All projects are currently marked as Done. Reactivate a project in the Project Backlog to resume logging effort."
                    : "No active projects found. Create projects in Project Manager to start logging effort."}
                </td>
              </tr>
            ) : (
              activeProjects.map((project) => {
                const pStat = projectStats.stats[project.id] || { totalHours: 0, spend: 0 };
                const rateLabel = getProjectRateLabel(project);
                const isProjectCompleted = project.endDate && project.endDate < todayStr;

                return (
                  <tr
                    key={project.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/40 transition-colors group"
                  >
                    {/* Project Info: Title on top, status badge and rate underneath */}
                    <td className="py-2.5 px-4">
                      <div className="space-y-1">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-mono truncate" title={project.name}>
                          {project.name}
                        </div>
                        <div className="flex items-center space-x-2 text-[10.5px] font-mono leading-none">
                          {isProjectCompleted ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                              Done
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold">
                              Active
                            </span>
                          )}
                          {rateLabel && (
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {rateLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Monday - Sunday Days */}
                    {weekInfo.days.map((day) => {
                      const dayEntries = weekEntriesMap[project.id]?.[day.dateStr] || [];
                      const dayTotal = dayEntries.reduce((acc, curr) => acc + curr.hours, 0);
                      const isEditing = activeCellEdit?.projectId === project.id && activeCellEdit?.date === day.dateStr;

                      return (
                        <td
                          key={day.dateStr}
                          className={`py-2 px-1 text-center align-middle ${
                            day.isToday ? 'bg-orange-50/30 dark:bg-orange-950/10' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center">
                            {isEditing ? (
                              <input
                                autoFocus
                                type="number"
                                step="0.25"
                                min="0"
                                max="24"
                                value={activeCellEdit.value}
                                onChange={(e) => setActiveCellEdit({ ...activeCellEdit, value: e.target.value })}
                                onBlur={(e) => handleCommitCell(project.id, day.dateStr, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCommitCell(project.id, day.dateStr, (e.target as HTMLInputElement).value);
                                  } else if (e.key === 'Escape') {
                                    setActiveCellEdit(null);
                                  }
                                }}
                                className="w-14 sm:w-16 h-8 text-center font-mono font-bold text-xs rounded-xl border-2 border-orange-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-inner outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCellEdit({
                                    projectId: project.id,
                                    date: day.dateStr,
                                    value: dayTotal > 0 ? String(dayTotal) : ''
                                  });
                                }}
                                className={`w-14 sm:w-16 h-8 rounded-xl border transition-all flex items-center justify-center font-mono text-xs font-bold cursor-pointer select-none ${
                                  dayTotal > 0
                                    ? 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm hover:border-orange-500'
                                    : 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/60 text-zinc-400 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300'
                                }`}
                                title={`Click to log hours for ${project.name} on ${day.dayShort} ${day.dateDisplay}`}
                              >
                                {dayTotal > 0 ? dayTotal.toFixed(1) : '-'}
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Project Hours */}
                    <td className="py-3 px-3 text-center align-middle font-bold text-xs">
                      {pStat.totalHours > 0 ? (
                        <span className="text-zinc-900 dark:text-white">
                          {pStat.totalHours.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Spend (£) */}
                    <td className="py-3 px-3 text-center align-middle font-bold text-xs text-orange-600 dark:text-orange-400">
                      {pStat.spend > 0 ? (
                        <span>£{Math.round(pStat.spend).toLocaleString('en-GB')}</span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">-</span>
                      )}
                    </td>

                    {/* Actions: Clear week */}
                    <td className="py-3 px-3 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleClearProjectWeek(project.id)}
                          disabled={isSubmitting || pStat.totalHours === 0}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Clear this week's hours"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Table Footer: Daily Hours Logged */}
          <tfoot>
            <tr className="border-t-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">
              <td className="py-3.5 px-4 text-right uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pr-6">
                Daily Hours Logged:
              </td>
              {weekInfo.days.map((day) => {
                const dayHours = projectStats.dailyTotals[day.dateStr] || 0;
                return (
                  <td
                    key={day.dateStr}
                    className={`py-3.5 px-2 text-center ${
                      day.isToday ? 'bg-orange-50/70 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400' : ''
                    }`}
                  >
                    {dayHours > 0 ? (
                      <span className="font-extrabold">{dayHours.toFixed(1)}</span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600 font-normal">-</span>
                    )}
                  </td>
                );
              })}
              {/* Grand Total Hours */}
              <td className="py-3.5 px-3 text-center font-extrabold text-zinc-900 dark:text-white">
                {projectStats.grandTotalHours > 0 ? projectStats.grandTotalHours.toFixed(1) : '0.0'}
              </td>
              {/* Grand Total Spend */}
              <td className="py-3.5 px-3 text-center font-extrabold text-orange-600 dark:text-orange-400">
                £{Math.round(projectStats.grandTotalSpend).toLocaleString('en-GB')}
              </td>
              <td className="py-3.5 px-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Submit Button Section (From Single Entry Form) */}
      <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-zinc-700 dark:text-zinc-200">Total Week Effort:</span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-extrabold text-sm">
              {projectStats.grandTotalHours.toFixed(1)} hrs
            </span>
          </div>
          <span>•</span>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-zinc-700 dark:text-zinc-200">Billable Value:</span>
            <span className="px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-extrabold text-sm">
              £{Math.round(projectStats.grandTotalSpend).toLocaleString('en-GB')}
            </span>
          </div>
        </div>

        <div className="w-full sm:w-auto min-w-[280px]">
          <motion.button
            type="button"
            onClick={handleSubmitToAuditors}
            disabled={isSubmitting || projectStats.grandTotalHours === 0}
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.985 }}
            className="group w-full py-2.5 px-5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold font-mono transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardCheck className="w-4 h-4 text-zinc-400 group-hover:text-white dark:text-blue-200 dark:group-hover:text-white transition-all group-hover:rotate-6 group-hover:scale-110" />
            <span>Submit to Corporate Auditors</span>
          </motion.button>
        </div>
      </div>

      {/* Helpful Instructions Footer */}
      <div className="p-3.5 border-t border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span>
            <strong>Pro Tip:</strong> Click any cell pill to edit hours directly. Changes save automatically.
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          <span>Highlighted day is today ({weekInfo.days.find(d => d.isToday)?.dateDisplay || 'Today'})</span>
        </div>
      </div>

      {/* 🧾 Auditor Confirmation Modal / Receipt (Matches Single Entry Form) */}
      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-md p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] shadow-2xl space-y-5 text-zinc-800 dark:text-[#E0E0E0] relative"
            >
              {/* Close Button top-right */}
              <button
                onClick={() => setShowReceipt(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                title="Dismiss receipt"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-8 h-8 animate-pulse" />
                </div>
                <h2 className="text-lg font-bold font-mono tracking-tight text-zinc-950 dark:text-white uppercase">
                  🎉 Weekly Timesheet Submitted!
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
                  Your weekly effort ledger has been verified and recorded successfully.
                </p>
              </div>

              {/* Receipt Body */}
              <div className="p-4 bg-zinc-50 dark:bg-[#151515] rounded-xl border border-zinc-200 dark:border-zinc-850/80 font-mono text-[11px] leading-relaxed relative overflow-hidden">
                {/* Watermark background seal */}
                <div className="absolute -right-6 -bottom-6 text-zinc-200/40 dark:text-zinc-800/10 text-6xl font-black select-none pointer-events-none uppercase tracking-widest rotate-12">
                  SEAL
                </div>

                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">OFFICIAL LEDGER RECEIPT</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">CERTIFIED</span>
                </div>

                <div className="space-y-2 relative z-10">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">WEEK CYCLE:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{weekInfo.weekDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">TOTAL HOURS:</span>
                    <span className="font-bold text-zinc-950 dark:text-white text-xs bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                      {projectStats.grandTotalHours.toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">BILLABLE VALUE:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      £{Math.round(projectStats.grandTotalSpend).toLocaleString('en-GB')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">ACTIVE PROJECTS:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {projectStats.activeProjectsCount} projects
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">CAFFEINE METRIC:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1">
                      <Coffee className="w-3.5 h-3.5 text-amber-500 inline" />
                      <span>{Math.max(1, Math.round(projectStats.grandTotalHours / 3.5))} cups</span>
                    </span>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-2 mt-2">
                    <span className="text-zinc-400 dark:text-zinc-500 block mb-0.5">AUDIT MEMO:</span>
                    <p className="italic text-zinc-600 dark:text-zinc-350 text-[10px] bg-zinc-100/50 dark:bg-zinc-900 p-2 rounded border border-zinc-150 dark:border-zinc-800/40">
                      "Weekly cycle approved and synchronized with Google Sheets ledger database."
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <motion.button
                  onClick={() => setShowReceipt(false)}
                  whileHover={{ scale: 1.02, y: -0.5 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold font-mono shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Acknowledge & Back to Desk</span>
                </motion.button>
                <p className="text-[9px] text-center text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-wider">
                  Approved by corporate compliance authority
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
