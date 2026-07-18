/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Project, TimeEntry } from '../types';
import { Download, Printer, Calendar, Clock, Sparkles, TrendingUp, HelpCircle, FileText, CheckCircle, Coffee } from 'lucide-react';

interface WeeklyReportProps {
  entries: TimeEntry[];
  projects: Project[];
}

interface DayTotal {
  dayName: string;
  dateStr: string;
  hours: number;
  comments: string[];
}

export default function WeeklyReport({ entries, projects }: WeeklyReportProps) {
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    // Default to the current week's Monday (based on current date 2026-07-17)
    const today = new Date('2026-07-17'); // Keep anchored to metadata date context
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  });

  // Generate list of the last 10 weeks for easy dropdown selection
  const weeksList = useMemo(() => {
    const list = [];
    const baseDate = new Date('2026-07-17');
    
    // Find Monday of the current week
    const day = baseDate.getDay();
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const currentMonday = new Date(baseDate.setDate(diff));

    for (let i = 0; i < 10; i++) {
      const mon = new Date(currentMonday);
      mon.setDate(currentMonday.getDate() - (i * 7));
      
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const monStr = mon.toISOString().split('T')[0];
      const sunStr = sun.toISOString().split('T')[0];

      const label = `Week of ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      list.push({ value: monStr, endValue: sunStr, label });
    }
    return list;
  }, []);

  // Selected week's date range
  const selectedWeekEnd = useMemo(() => {
    const start = new Date(selectedWeekStart);
    start.setDate(start.getDate() + 6);
    return start.toISOString().split('T')[0];
  }, [selectedWeekStart]);

  // Filter entries that fall within the selected week (Monday to Sunday)
  const weekEntries = useMemo(() => {
    const start = new Date(selectedWeekStart);
    const end = new Date(selectedWeekEnd);
    // Set hours to cover the entire day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= start && entryDate <= end;
    });
  }, [entries, selectedWeekStart, selectedWeekEnd]);

  // Calculate day-by-day totals for the bar chart
  const dailyBreakdown = useMemo((): DayTotal[] => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const breakdown: DayTotal[] = [];

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(selectedWeekStart);
      currentDay.setDate(currentDay.getDate() + i);
      const dateStr = currentDay.toISOString().split('T')[0];

      const dayEntries = weekEntries.filter(e => e.date === dateStr);
      const hours = dayEntries.reduce((sum, e) => sum + e.hours, 0);
      const comments = dayEntries.map(e => e.comment);

      breakdown.push({
        dayName: dayNames[i],
        dateStr,
        hours,
        comments
      });
    }

    return breakdown;
  }, [weekEntries, selectedWeekStart]);

  // Total weekly hours logged
  const totalWeeklyHours = useMemo(() => {
    return weekEntries.reduce((sum, e) => sum + e.hours, 0);
  }, [weekEntries]);

  const totalWeeklyCoffees = useMemo(() => {
    return weekEntries.reduce((sum, e) => sum + (e.coffees || 0), 0);
  }, [weekEntries]);

  const totalMonthlyCoffees = useMemo(() => {
    const selectedDateObj = new Date(selectedWeekStart);
    const year = selectedDateObj.getFullYear();
    const month = selectedDateObj.getMonth();

    return entries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).reduce((sum, e) => sum + (e.coffees || 0), 0);
  }, [entries, selectedWeekStart]);

  const totalAnnualCoffees = useMemo(() => {
    const selectedDateObj = new Date(selectedWeekStart);
    const year = selectedDateObj.getFullYear();

    return entries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year;
    }).reduce((sum, e) => sum + (e.coffees || 0), 0);
  }, [entries, selectedWeekStart]);

  // Average daily hours (across 5 working days)
  const avgDailyHours = useMemo(() => {
    const workDaysWithTime = dailyBreakdown.filter(d => d.hours > 0).length || 1;
    return (totalWeeklyHours / workDaysWithTime).toFixed(1);
  }, [totalWeeklyHours, dailyBreakdown]);

  // Calculate billable vs non-billable hours for the weekly selection
  const weeklyEffortSplit = useMemo(() => {
    let billable = 0;
    let nonBillable = 0;
    weekEntries.forEach(e => {
      const proj = projects.find(p => p.id === e.projectId);
      if (proj?.isNonBillable) {
        nonBillable += e.hours;
      } else {
        billable += e.hours;
      }
    });
    return { billable, nonBillable };
  }, [weekEntries, projects]);

  // Group by project code
  const projectContributions = useMemo(() => {
    const map: { [key: string]: number } = {};
    weekEntries.forEach(e => {
      map[e.projectId] = (map[e.projectId] || 0) + e.hours;
    });

    return Object.keys(map).map(pId => {
      const proj = projects.find(p => p.id === pId);
      const spent = map[pId];
      const percent = totalWeeklyHours > 0 ? (spent / totalWeeklyHours) * 100 : 0;
      return {
        id: pId,
        name: proj ? proj.name : 'Unlisted Sub-task',
        hours: spent,
        percent: percent.toFixed(0),
        budget: proj ? proj.estimatedHours : 0
      };
    });
  }, [weekEntries, projects, totalWeeklyHours]);

  // Export to CSV helper
  const handleExportCSV = () => {
    if (weekEntries.length === 0) {
      alert("No hours logged for this period. There is nothing to export except corporate silence.");
      return;
    }

    const escapeCSV = (val: string | number | boolean | undefined) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // CSV headers
    const headers = [
      "Date",
      "Agency Name",
      "Brand Client",
      "Project Name",
      "Hours Logged",
      "Hourly Rate (£)",
      "Amount (£)",
      "Coffees Consumed",
      "Billable Status",
      "Accomplishment Comment"
    ];

    const rows = [headers.join(",")];

    weekEntries.forEach(e => {
      const proj = projects.find(p => p.id === e.projectId);
      const agencyName = proj?.agencyName || "N/A";
      const brandName = proj?.brandName || "N/A";
      const projectName = proj?.name || "Unknown Project";
      const hours = e.hours;
      const isNonBillable = !!proj?.isNonBillable;
      const rate = isNonBillable ? 0 : (proj?.rate || 0);
      const amount = isNonBillable ? 0 : (hours * rate);
      const coffees = e.coffees || 0;
      const billableStatus = isNonBillable ? "Non-Billable" : "Billable";
      const comment = e.comment;

      const row = [
        escapeCSV(e.date),
        escapeCSV(agencyName),
        escapeCSV(brandName),
        escapeCSV(projectName),
        escapeCSV(hours),
        escapeCSV(rate),
        escapeCSV(amount),
        escapeCSV(coffees),
        escapeCSV(billableStatus),
        escapeCSV(comment)
      ];

      rows.push(row.join(","));
    });

    const csvString = rows.join("\r\n");
    // Use Blob with UTF-8 BOM so Excel opens special characters correctly
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `weekly_timesheet_report_${selectedWeekStart}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export as PDF / Trigger print dialog
  const handlePrintPDF = () => {
    window.print();
  };

  const maxDailyHours = Math.max(...dailyBreakdown.map(d => d.hours), 8);

  // Funny evaluation of total weekly hours
  const getWeeklyHumorReview = (hours: number) => {
    if (hours === 0) return { title: "Absolute Zen Mode", desc: "0 hours logged. You have reached complete nirvana. Or you are about to be fired.", rating: "★★★★★ (for work-life balance)" };
    if (hours < 20) return { title: "Stealth Slacking", desc: `${hours} hours logged. Highly strategic work distribution. No major damage reported yet.`, rating: "★★★☆☆ (Too safe)" };
    if (hours <= 40) return { title: "Model Employee", desc: `${hours} hours logged. Exactly what the handbook prescribed. Please accept this virtual firm handshake.`, rating: "★★★★☆ (Corporate Dream)" };
    if (hours <= 50) return { title: "Caffeine-Powered Overachiever", desc: `${hours} hours logged. Your dedication has been noticed. The reward is a slightly higher expectation next week!`, rating: "★★★★★ (Audit Alert)" };
    return { title: "Legendary Overtime Grind", desc: `${hours} hours logged! You are single-handedly carrying the department. We have alerted the exhaustion response team.`, rating: "💀💀💀💀💀 (Cardiac Event Pending)" };
  };

  const review = getWeeklyHumorReview(totalWeeklyHours);

  return (
    <div id="weekly-report-container" className="space-y-6">
      {/* Selection Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm print:hidden">
        <div className="space-y-1">
          <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400 flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>Select Billing Period</span>
          </label>
          <select
            value={selectedWeekStart}
            onChange={e => setSelectedWeekStart(e.target.value)}
            className="text-sm font-mono py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-zinc-50 dark:bg-[#191919] text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {weeksList.map(week => (
              <option key={week.value} value={week.value}>
                {week.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Export to CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 py-2 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] hover:bg-zinc-50 dark:hover:bg-[#2F2F2F] text-zinc-700 dark:text-[#E0E0E0] text-xs font-bold font-mono transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Export to PDF Button */}
          <button
            onClick={handlePrintPDF}
            className="flex items-center space-x-1.5 py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-850 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold font-mono transition-colors shadow cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* --- REPORT LAYOUT --- */}
      {/* This section is styled beautifully for screen AND printed vectors */}
      <div className="p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm space-y-6 print:border-0 print:shadow-none print:p-0">
        
        {/* Printable Header Letterhead */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-zinc-200 dark:border-[#2F2F2F]">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-400 dark:text-zinc-500">Corporate Effort Dispatch</span>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white font-mono tracking-tight">Timesheet Report Card</h1>
            <p className="text-xs text-zinc-500 dark:text-gray-400 font-mono flex items-center space-x-1.5">
              <span>Period: <strong>{selectedWeekStart}</strong> to <strong>{selectedWeekEnd}</strong></span>
            </p>
          </div>
          
          <div className="text-left sm:text-right font-mono space-y-1">
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-[#252525] border border-zinc-200 dark:border-[#2F2F2F] text-zinc-500 dark:text-[#E0E0E0]">
              STRICTLY CONFIDENTIAL
            </span>
            <p className="text-[10px] text-zinc-400 dark:text-gray-500 mt-2">Compiled at: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Weekly Evaluation Widget */}
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#252525] border border-zinc-100 dark:border-[#2F2F2F] grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center space-x-1.5 text-zinc-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] uppercase tracking-wider font-mono font-bold">Auditor Review</span>
            </div>
            <h3 className="text-sm font-bold text-zinc-850 dark:text-zinc-100 font-mono">{review.title}</h3>
            <p className="text-xs text-zinc-500 dark:text-gray-400 italic">"{review.desc}"</p>
          </div>
          <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-zinc-200 dark:border-[#2F2F2F] pt-3 md:pt-0 md:pl-4 font-mono space-y-0.5">
            <span className="text-[10px] text-zinc-400">Performance Index</span>
            <span className="text-xs font-bold text-zinc-880 dark:text-[#E0E0E0]">{review.rating}</span>
          </div>
        </div>

        {/* Key Metrics Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
          <div className="p-3 border border-zinc-150 dark:border-[#2F2F2F] rounded-lg space-y-1 bg-zinc-50/10 dark:bg-zinc-950/10">
            <span className="text-[10px] uppercase font-mono text-zinc-400 dark:text-zinc-500">Weekly Effort</span>
            <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">{totalWeeklyHours} hrs</p>
          </div>
          <div className="p-3 border border-emerald-150 dark:border-emerald-950 rounded-lg space-y-1 bg-emerald-500/5">
            <span className="text-[10px] uppercase font-mono text-emerald-650 dark:text-emerald-400 font-bold">Billable Effort</span>
            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-450">{weeklyEffortSplit.billable} hrs</p>
          </div>
          <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg space-y-1 bg-zinc-100/10 dark:bg-zinc-800/10">
            <span className="text-[10px] uppercase font-mono text-zinc-500 dark:text-zinc-400 font-bold">Non-Billable</span>
            <p className="text-lg font-bold font-mono text-zinc-650 dark:text-zinc-350">{weeklyEffortSplit.nonBillable} hrs</p>
          </div>
          <div className="p-3 border border-zinc-150 dark:border-[#2F2F2F] rounded-lg space-y-1">
            <span className="text-[10px] uppercase font-mono text-zinc-400 dark:text-zinc-500">Day Avg (Logged)</span>
            <p className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">{avgDailyHours} hrs</p>
          </div>
        </div>



        {/* Modern Bar Chart block */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-500 dark:text-gray-400">
              Hourly distribution across days
            </h3>
            <span className="text-[10px] text-zinc-400 dark:text-gray-500 font-mono italic">
              Scale auto-calibrated to coffee supply
            </span>
          </div>

          <div className="flex flex-col space-y-3 border border-zinc-150 dark:border-[#2F2F2F] rounded-xl p-4 bg-zinc-50/30 dark:bg-[#191919]">
            {dailyBreakdown.map(day => {
              const spentPercent = maxDailyHours > 0 ? (day.hours / maxDailyHours) * 100 : 0;
              return (
                <div key={day.dateStr} className="grid grid-cols-10 gap-2 items-center">
                  {/* Day label */}
                  <div className="col-span-2 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-300 truncate">
                    {day.dayName}
                  </div>
                  {/* Bar indicator */}
                  <div className="col-span-6 h-4 bg-zinc-100 dark:bg-[#252525] rounded-sm relative overflow-hidden border border-zinc-200/30 dark:border-[#2F2F2F]/30 flex items-center">
                    <div
                      className={`h-full rounded-sm transition-all duration-300 ${
                        day.hours > 8
                          ? 'bg-amber-600 dark:bg-amber-500'
                          : day.hours > 0
                          ? 'bg-zinc-800 dark:bg-blue-500'
                          : 'bg-transparent'
                      }`}
                      style={{ width: `${spentPercent}%` }}
                    />
                    {day.hours > 0 && (
                      <span className="absolute left-2 text-[9px] font-mono font-bold text-zinc-400 mix-blend-difference">
                        {day.hours}h
                      </span>
                    )}
                  </div>
                  {/* Summary commentary line */}
                  <div className="col-span-2 text-[10px] text-zinc-400 dark:text-gray-500 truncate italic text-right">
                    {day.hours === 0 ? (
                      <span>Pure Slacking</span>
                    ) : day.hours > 8 ? (
                      <span>Productivity Spike</span>
                    ) : (
                      <span>Nominal effort</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Project Contributions Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3">
          <div className="space-y-3">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-500 dark:text-gray-400">
              Effort split by Project Code
            </h3>
            <div className="border border-zinc-200 dark:border-[#2F2F2F] rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-[#2F2F2F]">
              {projectContributions.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400 dark:text-gray-500 font-mono">
                  No billing records logged for this period.
                </div>
              ) : (
                projectContributions.map(proj => (
                  <div key={proj.id} className="p-3 bg-white dark:bg-[#1F1F1F] flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold font-mono text-zinc-850 dark:text-zinc-200 truncate">
                        {proj.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        Global budget: {proj.budget}h
                      </p>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{proj.hours} hrs</p>
                      <p className="text-[10px] text-zinc-500 dark:text-gray-400 font-semibold">{proj.percent}% share</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bulleted Narrative logs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-500 dark:text-gray-400">
              Narrative Log Digest
            </h3>
            <div className="p-4 border border-zinc-200 dark:border-[#2F2F2F] rounded-xl bg-zinc-50/20 dark:bg-[#191919] max-h-[220px] overflow-y-auto space-y-2.5">
              {weekEntries.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-gray-500 italic text-center py-4 font-mono">
                  Corporate logs are completely vacant. Silence implies compliance.
                </p>
              ) : (
                weekEntries.map(e => (
                  <div key={e.id} className="text-[11px] leading-relaxed border-l-2 border-zinc-300 dark:border-[#3F3F3F] pl-2.5">
                    <span className="font-mono text-zinc-400 font-bold mr-1">[{e.date}]</span>
                    <span className="text-zinc-700 dark:text-zinc-300 italic">"{e.comment}"</span>
                  </div>
                ))
              )}
            </div>

            {/* Caffeine Audit Counters */}
            <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 dark:border-amber-500/20 rounded-xl p-3.5 space-y-2.5 print:hidden">
              <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-500">
                <Coffee className="w-3.5 h-3.5" />
                <h4 className="text-[10px] font-bold font-mono uppercase tracking-wider">Caffeine Consumed Counter</h4>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div className="p-2 bg-zinc-50 dark:bg-[#191919] border border-zinc-200 dark:border-[#2F2F2F] rounded-lg space-y-0.5">
                  <span className="text-[8px] uppercase text-zinc-400">Weekly</span>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-500">{totalWeeklyCoffees} cups</p>
                </div>
                <div className="p-2 bg-zinc-50 dark:bg-[#191919] border border-zinc-200 dark:border-[#2F2F2F] rounded-lg space-y-0.5">
                  <span className="text-[8px] uppercase text-zinc-400">Monthly</span>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-500">{totalMonthlyCoffees} cups</p>
                </div>
                <div className="p-2 bg-zinc-50 dark:bg-[#191919] border border-zinc-200 dark:border-[#2F2F2F] rounded-lg space-y-0.5">
                  <span className="text-[8px] uppercase text-zinc-400">Annual</span>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-500">{totalAnnualCoffees} cups</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Printable Footer Disclaimer */}
        <div className="hidden print:block pt-12 text-center text-[10px] font-mono text-zinc-400 uppercase tracking-widest border-t border-dashed border-zinc-200 dark:border-[#2F2F2F]">
          * This timesheet is self-attested and certified by the local coffee machine. *
        </div>

      </div>
    </div>
  );
}
