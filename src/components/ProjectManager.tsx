/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Project, TimeEntry } from '../types';
import { Calendar, Plus, Trash2, Clock, CheckCircle2, ChevronRight, AlertTriangle, Info, Coffee, Pencil, BarChart3, TrendingDown, ChevronDown, ChevronUp, X, AlertOctagon } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectManagerProps {
  projects: Project[];
  entries: TimeEntry[];
  onAddProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export default function ProjectManager({ projects, entries, onAddProject, onEditProject, onDeleteProject }: ProjectManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    return future.toISOString().split('T')[0];
  });
  const [agencyName, setAgencyName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [rate, setRate] = useState('');
  const [description, setDescription] = useState('');
  const [isNonBillable, setIsNonBillable] = useState(false);
  const [error, setError] = useState('');

  const [budgetHours, setBudgetHours] = useState('');
  const [alertThresholds, setAlertThresholds] = useState('50, 75, 90, 100');

  // Chart configuration state
  const [selectedChartProjectId, setSelectedChartProjectId] = useState<string>('all');
  const [isChartExpanded, setIsChartExpanded] = useState(true);
  const [showResourceInsight, setShowResourceInsight] = useState(false);
  const [showBurnTimelineInsight, setShowBurnTimelineInsight] = useState(false);

  // Inline Project Editing state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editBrandName, setEditBrandName] = useState('');
  const [editEstimatedHours, setEditEstimatedHours] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsNonBillable, setEditIsNonBillable] = useState(false);
  const [editBudgetHours, setEditBudgetHours] = useState('');
  const [editAlertThresholds, setEditAlertThresholds] = useState('');
  const [editError, setEditError] = useState('');

  // Custom delete confirmation modal state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const handleStartEditProject = (proj: Project) => {
    setEditingProjectId(proj.id);
    setEditName(proj.name);
    setEditAgencyName(proj.agencyName || '');
    setEditBrandName(proj.brandName || '');
    setEditEstimatedHours(String(proj.estimatedHours));
    setEditRate(String(proj.rate ?? ''));
    setEditStartDate(proj.startDate);
    setEditEndDate(proj.endDate);
    setEditDescription(proj.description || '');
    setEditIsNonBillable(!!proj.isNonBillable);
    setEditBudgetHours(proj.budget_hours !== undefined && proj.budget_hours !== null ? String(proj.budget_hours) : '');
    setEditAlertThresholds(proj.alert_thresholds ? proj.alert_thresholds.join(', ') : '50, 75, 90, 100');
    setEditError('');
  };

  const handleSaveProject = (id: string) => {
    setEditError('');
    if (!editName.trim()) {
      setEditError('Project Title is mandatory.');
      return;
    }
    if (!editAgencyName.trim()) {
      setEditError('Agency Name is mandatory.');
      return;
    }
    if (!editBrandName.trim()) {
      setEditError('Brand Client is mandatory.');
      return;
    }
    if (!editEstimatedHours.trim()) {
      setEditError('Estimated Hours (Budget) is mandatory.');
      return;
    }
    if (!editRate.trim()) {
      setEditError('Hourly Rate is mandatory.');
      return;
    }
    if (!editDescription.trim()) {
      setEditError('Scope Description is mandatory.');
      return;
    }

    const hours = parseFloat(editEstimatedHours);
    if (isNaN(hours) || hours <= 0) {
      setEditError('Estimated hours must be greater than zero.');
      return;
    }

    const numericRate = parseFloat(editRate);
    if (isNaN(numericRate) || numericRate < 0) {
      setEditError('Hourly rate must be a non-negative number.');
      return;
    }

    if (new Date(editStartDate) > new Date(editEndDate)) {
      setEditError('The start date cannot be after the end date.');
      return;
    }

    const original = projects.find(p => p.id === id);
    if (!original) return;

    let budgetVal: number | null = null;
    if (editBudgetHours.trim()) {
      budgetVal = parseFloat(editBudgetHours);
      if (isNaN(budgetVal) || budgetVal <= 0) {
        setEditError('Budget hours must be greater than zero.');
        return;
      }
    }

    let thresholdsVal: number[] = [50, 75, 90, 100];
    if (editAlertThresholds.trim()) {
      thresholdsVal = editAlertThresholds
        .split(',')
        .map(t => parseFloat(t.trim()))
        .filter(t => !isNaN(t) && t > 0);
      if (thresholdsVal.length === 0) {
        setEditError('Alert thresholds must be a comma-separated list of positive percentages.');
        return;
      }
    }

    onEditProject({
      ...original,
      name: editName.trim(),
      agencyName: editAgencyName.trim() || undefined,
      brandName: editBrandName.trim() || undefined,
      estimatedHours: hours,
      rate: numericRate,
      startDate: editStartDate,
      endDate: editEndDate,
      description: editDescription.trim() || undefined,
      isNonBillable: editIsNonBillable,
      budget_hours: budgetVal,
      alert_thresholds: thresholdsVal
    });

    setEditingProjectId(null);
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project Title is mandatory. Even "Operation Survive" is acceptable.');
      return;
    }
    if (!agencyName.trim()) {
      setError('Agency Name is mandatory. Middle management needs to know who to blame.');
      return;
    }
    if (!brandName.trim()) {
      setError('Brand Client is mandatory. Senior management requires target brand logos.');
      return;
    }
    if (!estimatedHours.trim()) {
      setError('Estimated Hours (Budget) is mandatory. We must track resource constraints.');
      return;
    }
    if (!rate.trim()) {
      setError('Hourly Rate is mandatory. (Enter 0 if this project is completely non-revenue).');
      return;
    }
    if (!description.trim()) {
      setError('Scope Description is mandatory. Auditing requires at least some witty justification.');
      return;
    }

    const hours = parseFloat(estimatedHours);
    if (isNaN(hours) || hours <= 0) {
      setError('Estimated hours must be greater than zero. Infinite budgets are still pending board approval.');
      return;
    }

    const numericRate = parseFloat(rate);
    if (isNaN(numericRate) || numericRate < 0) {
      setError('Hourly rate must be a non-negative number. Free labor requires a signed waiver.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('The start date cannot be in the future of the end date. We have not mastered time-travel physics.');
      return;
    }

    let budgetVal: number | null = null;
    if (budgetHours.trim()) {
      budgetVal = parseFloat(budgetHours);
      if (isNaN(budgetVal) || budgetVal <= 0) {
        setError('Budget hours must be greater than zero.');
        return;
      }
    }

    let thresholdsVal: number[] = [50, 75, 90, 100];
    if (alertThresholds.trim()) {
      thresholdsVal = alertThresholds
        .split(',')
        .map(t => parseFloat(t.trim()))
        .filter(t => !isNaN(t) && t > 0);
      if (thresholdsVal.length === 0) {
        setError('Alert thresholds must be a comma-separated list of positive percentages.');
        return;
      }
    }

    onAddProject({
      name: name.trim(),
      estimatedHours: hours,
      startDate,
      endDate,
      description: description.trim() || undefined,
      agencyName: agencyName.trim() || undefined,
      brandName: brandName.trim() || undefined,
      rate: numericRate,
      isNonBillable,
      budget_hours: budgetVal,
      alert_thresholds: thresholdsVal
    });

    // Reset fields
    setName('');
    setEstimatedHours('');
    setAgencyName('');
    setBrandName('');
    setRate('');
    setDescription('');
    setIsNonBillable(false);
    setBudgetHours('');
    setAlertThresholds('50, 75, 90, 100');
    setShowForm(false);
  };

  // Calculate total hours logged for each project
  const getProjectStats = (projectId: string) => {
    const projectEntries = entries.filter(e => e.projectId === projectId);
    const totalSpent = projectEntries.reduce((sum, e) => sum + e.hours, 0);
    return totalSpent;
  };

  const getMonday = (dateStr: string): string => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    return mon.toISOString().split('T')[0];
  };

  const projectRates = useMemo(() => {
    const ratesMap: Record<string, number> = {};
    projects.forEach(p => {
      ratesMap[p.id] = p.rate || 0;
    });
    return ratesMap;
  }, [projects]);

  const nonBillableProjectIds = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.isNonBillable) set.add(p.id);
    });
    return set;
  }, [projects]);

  // Financial aggregates (strictly excluding non-billable projects)
  const totalActualRevenue = useMemo(() => {
    return entries.reduce((sum, e) => {
      if (nonBillableProjectIds.has(e.projectId)) return sum;
      const rateVal = projectRates[e.projectId] || 0;
      return sum + (e.hours * rateVal);
    }, 0);
  }, [entries, projectRates, nonBillableProjectIds]);

  const totalPotentialRevenue = useMemo(() => {
    return projects.reduce((sum, p) => {
      if (p.isNonBillable) return sum;
      return sum + (p.estimatedHours * (p.rate || 0));
    }, 0);
  }, [projects]);

  // Non-billable work tracker
  const totalNonBillableHours = useMemo(() => {
    return entries.reduce((sum, e) => {
      if (nonBillableProjectIds.has(e.projectId)) {
        return sum + e.hours;
      }
      return sum;
    }, 0);
  }, [entries, nonBillableProjectIds]);

  // Cumulative Coffee drank overall
  const cumulativeCoffees = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.coffees || 0), 0);
  }, [entries]);

  // Earnings grouped by week (Monday as week starting)
  const weeklyEarnings = useMemo(() => {
    const groups: Record<string, { weekStart: string; weekEnd: string; hours: number; earnings: number }> = {};
    entries.forEach(e => {
      if (nonBillableProjectIds.has(e.projectId)) return;
      const rateVal = projectRates[e.projectId] || 0;
      const weekStartStr = getMonday(e.date);
      
      const mon = new Date(weekStartStr);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const weekEndStr = sun.toISOString().split('T')[0];

      if (!groups[weekStartStr]) {
        groups[weekStartStr] = { weekStart: weekStartStr, weekEnd: weekEndStr, hours: 0, earnings: 0 };
      }
      groups[weekStartStr].hours += e.hours;
      groups[weekStartStr].earnings += e.hours * rateVal;
    });
    return Object.values(groups).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [entries, projectRates, nonBillableProjectIds]);

  // Earnings grouped by calendar month
  const monthlyEarnings = useMemo(() => {
    const groups: Record<string, { monthKey: string; label: string; hours: number; earnings: number }> = {};
    entries.forEach(e => {
      if (nonBillableProjectIds.has(e.projectId)) return;
      const rateVal = projectRates[e.projectId] || 0;
      const d = new Date(e.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      if (!groups[monthKey]) {
        groups[monthKey] = { monthKey, label, hours: 0, earnings: 0 };
      }
      groups[monthKey].hours += e.hours;
      groups[monthKey].earnings += e.hours * rateVal;
    });
    return Object.values(groups).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [entries, projectRates, nonBillableProjectIds]);

  // Calculations for Recharts Project Burn-down Chart
  const overviewChartData = useMemo(() => {
    return projects.map(p => {
      const projectEntries = entries.filter(e => e.projectId === p.id);
      const spent = projectEntries.reduce((sum, e) => sum + e.hours, 0);
      const budgetToUse = p.budget_hours !== undefined && p.budget_hours !== null ? p.budget_hours : p.estimatedHours;
      const remaining = Math.max(0, budgetToUse - spent);
      return {
        id: p.id,
        name: p.name,
        'Hours Logged': parseFloat(spent.toFixed(1)),
        'Remaining Budget': parseFloat(remaining.toFixed(1)),
        'Total Budget': budgetToUse,
        shortName: p.name.length > 15 ? p.name.slice(0, 12) + '...' : p.name,
      };
    });
  }, [projects, entries]);

  const burnDownChartData = useMemo(() => {
    if (selectedChartProjectId === 'all') return [];
    const project = projects.find(p => p.id === selectedChartProjectId);
    if (!project) return [];

    const projectEntries = entries
      .filter(e => e.projectId === selectedChartProjectId)
      .sort((a, b) => a.date.localeCompare(b.date));

    const budgetToUse = project.budget_hours !== undefined && project.budget_hours !== null ? project.budget_hours : project.estimatedHours;

    // Group entries by date
    const entriesByDate: Record<string, number> = {};
    projectEntries.forEach(e => {
      entriesByDate[e.date] = (entriesByDate[e.date] || 0) + e.hours;
    });

    const uniqueDates = Object.keys(entriesByDate).sort();

    const data = [];
    
    // Day 0: Start of project
    data.push({
      date: project.startDate,
      label: 'Start',
      'Remaining Budget': budgetToUse,
      'Hours Logged': 0,
      'Ideal Burn': budgetToUse,
    });

    let cumulativeSpent = 0;
    const startTs = new Date(project.startDate).getTime();
    const endTs = new Date(project.endDate).getTime();
    const totalDuration = endTs - startTs;

    uniqueDates.forEach(date => {
      cumulativeSpent += entriesByDate[date];
      const remaining = Math.max(0, budgetToUse - cumulativeSpent);

      // Ideal burn calculation
      const currentTs = new Date(date).getTime();
      let idealRemaining = budgetToUse;
      if (totalDuration > 0) {
        const elapsedFraction = Math.min(1, Math.max(0, (currentTs - startTs) / totalDuration));
        idealRemaining = Math.max(0, budgetToUse * (1 - elapsedFraction));
      } else {
        idealRemaining = 0;
      }

      data.push({
        date,
        label: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        'Remaining Budget': parseFloat(remaining.toFixed(1)),
        'Hours Logged': parseFloat(cumulativeSpent.toFixed(1)),
        'Ideal Burn': parseFloat(idealRemaining.toFixed(1)),
      });
    });

    // Add end date point if it's after the last entry and has duration
    const lastEntryDate = uniqueDates[uniqueDates.length - 1];
    if (!lastEntryDate || lastEntryDate < project.endDate) {
      data.push({
        date: project.endDate,
        label: 'Deadline',
        'Remaining Budget': parseFloat(Math.max(0, budgetToUse - cumulativeSpent).toFixed(1)),
        'Hours Logged': parseFloat(cumulativeSpent.toFixed(1)),
        'Ideal Burn': 0,
      });
    }

    return data;
  }, [selectedChartProjectId, projects, entries]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 bg-white dark:bg-[#1E1E1E] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-md font-mono text-xs text-zinc-800 dark:text-[#E0E0E0]">
          <p className="font-bold text-zinc-950 dark:text-white mb-1.5">{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center justify-between space-x-4 text-[11px] leading-relaxed">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color || p.fill }} />
                <span className="text-zinc-500 dark:text-zinc-400">{p.name}:</span>
              </div>
              <span className="font-bold text-zinc-900 dark:text-white">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}h</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const activeProjectsCount = projects.length;
  const totalEstimatedHours = projects.reduce((sum, p) => sum + p.estimatedHours, 0);
  const totalSpentAll = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div id="project-manager" className="space-y-6">
      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Projects */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#252525] shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-gray-400">Total Projects</span>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-[#E0E0E0]">{activeProjectsCount}</p>
          </div>
          <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-500 text-sm">📂</span>
        </div>

        {/* Cumu. Estimate */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#252525] shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-gray-400">Cumu. Estimate</span>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-[#E0E0E0]">{totalEstimatedHours}h</p>
          </div>
          <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-500 text-sm">⏱️</span>
        </div>

        {/* Total Hours Worked (Total Effort) */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#252525] shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-gray-400">Total Effort</span>
            <p className="text-xl font-bold font-mono text-zinc-900 dark:text-[#E0E0E0]">{totalSpentAll}h</p>
          </div>
          <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-500 text-sm">🕒</span>
        </div>

        {/* Total Coffee Drank (Fuel) */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#252525] shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-gray-400">Coffee Fuel</span>
            <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-500">{cumulativeCoffees} cups</p>
          </div>
          <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-500 text-sm">☕</span>
        </div>

        {/* Actual Revenue in £ */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#252525] shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-gray-400">Actual Revenue</span>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">£{totalActualRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-500 text-sm">💰</span>
        </div>

        {/* Non-Billable Work */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#252525] shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 dark:text-gray-400">Non-Billable</span>
            <p className="text-xl font-bold font-mono text-zinc-600 dark:text-zinc-350">{totalNonBillableHours} hrs</p>
          </div>
          <span className="p-2 rounded-lg bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-500 text-sm">🛡️</span>
        </div>
      </div>

      {/* Overall Financial Ledger breakdown */}
      <div className="p-5 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-150 dark:border-[#2F2F2F] pb-3">
          <div>
            <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-900 dark:text-white flex items-center space-x-1.5">
              <span>📊 Agency Revenue Ledger</span>
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-gray-405 font-mono">Actual earnings aggregated from logged hours multiplied by each project's rate.</p>
          </div>
          <div className="text-right font-mono text-xs text-zinc-400">
            Pipeline Potential: <strong className="text-amber-500">£{totalPotentialRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Weekly Ledger */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-500 dark:text-gray-400">
              <span>WEEKLY ACTUAL BILLING</span>
              <span className="text-[10px] text-zinc-400">Sorted by newest</span>
            </div>
            
            <div className="border border-zinc-200 dark:border-[#2F2F2F] rounded-lg divide-y divide-zinc-100 dark:divide-[#2F2F2F] max-h-[220px] overflow-y-auto bg-zinc-50/20 dark:bg-[#191919]/40">
              {weeklyEarnings.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400 font-mono italic">
                  No actual timesheets logged for any week.
                </div>
              ) : (
                weeklyEarnings.map(group => (
                  <div key={group.weekStart} className="p-3 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-0.5">
                      <p className="font-bold text-zinc-800 dark:text-[#E0E0E0]">Week of {new Date(group.weekStart).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</p>
                      <p className="text-[10px] text-zinc-400">{group.hours} actual hours logged</p>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      £{group.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Monthly Ledger */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-500 dark:text-gray-400">
              <span>MONTHLY ACTUAL BILLING</span>
              <span className="text-[10px] text-zinc-400">Sorted by calendar month</span>
            </div>
            
            <div className="border border-zinc-200 dark:border-[#2F2F2F] rounded-lg divide-y divide-zinc-100 dark:divide-[#2F2F2F] max-h-[220px] overflow-y-auto bg-zinc-50/20 dark:bg-[#191919]/40">
              {monthlyEarnings.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400 font-mono italic">
                  No actual timesheets logged for any month.
                </div>
              ) : (
                monthlyEarnings.map(group => (
                  <div key={group.monthKey} className="p-3 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-0.5">
                      <p className="font-bold text-zinc-800 dark:text-[#E0E0E0]">{group.label}</p>
                      <p className="text-[10px] text-zinc-400">{group.hours} actual hours logged</p>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      £{group.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📉 Project Burn-down Chart Section */}
      <div className="p-5 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-150 dark:border-[#2F2F2F] pb-3">
          <div className="flex items-center space-x-2.5">
            <TrendingDown className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-zinc-900 dark:text-white">
                📉 Project Burn-down Ledger
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-gray-400 font-mono">
                Visual remaining budget vs. actual efforts logged.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Project dropdown select */}
            <select
              value={selectedChartProjectId}
              onChange={(e) => setSelectedChartProjectId(e.target.value)}
              className="py-1 px-2 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-zinc-50 dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none cursor-pointer"
            >
              <option value="all">📁 All Projects (Overview)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  📄 {p.name.length > 25 ? p.name.slice(0, 25) + '...' : p.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (selectedChartProjectId === 'all') {
                  setShowResourceInsight(!showResourceInsight);
                } else {
                  setShowBurnTimelineInsight(!showBurnTimelineInsight);
                }
              }}
              className={`p-1 rounded border transition-all cursor-pointer ${
                (selectedChartProjectId === 'all' ? showResourceInsight : showBurnTimelineInsight)
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                  : 'border-zinc-200 dark:border-[#2F2F2F] hover:bg-zinc-100 dark:hover:bg-[#252525] text-zinc-500'
              }`}
              title="Toggle Chart Information Guide"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsChartExpanded(!isChartExpanded)}
              className="p-1 rounded border border-zinc-200 dark:border-[#2F2F2F] hover:bg-zinc-100 dark:hover:bg-[#252525] text-zinc-500 transition-colors cursor-pointer"
              title={isChartExpanded ? "Collapse chart" : "Expand chart"}
            >
              {isChartExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isChartExpanded && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {projects.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-[#2F2F2F] rounded-lg bg-zinc-50/30 dark:bg-[#191919]/30 text-center text-xs font-mono text-zinc-400 italic">
                <span>No active projects to analyze. Initiate a project below to start tracking.</span>
              </div>
            ) : selectedChartProjectId === 'all' ? (
              /* Overview Portfolio Chart (Bar Chart) */
              <div className="space-y-3">
                <div className="h-64 sm:h-72 w-full font-mono text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={overviewChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" className="dark:stroke-zinc-800/40" />
                      <XAxis
                        dataKey="shortName"
                        stroke="#888888"
                        tickLine={false}
                        axisLine={false}
                        className="text-[10px]"
                      />
                      <YAxis
                        stroke="#888888"
                        tickLine={false}
                        axisLine={false}
                        unit="h"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                      />
                      <Bar
                        name="Hours Logged (Effort)"
                        dataKey="Hours Logged"
                        fill="#3B82F6"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={45}
                      />
                      <Bar
                        name="Remaining Budget"
                        dataKey="Remaining Budget"
                        fill="#F59E0B"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={45}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <AnimatePresence>
                  {showResourceInsight && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="p-3 bg-blue-50/30 dark:bg-blue-950/10 rounded-lg border border-blue-150/45 dark:border-blue-900/20 flex items-start justify-between space-x-2 text-[11.5px] font-mono text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        <div className="flex items-start space-x-2.5">
                          <span className="text-sm shrink-0">💡</span>
                          <p>
                            <strong>Resource Insight:</strong> Compare total logged effort against remaining budget across your projects. High <span className="text-blue-500 font-bold dark:text-blue-400">blue bars</span> represent substantial time investment, while <span className="text-amber-500 font-bold dark:text-amber-400">amber bars</span> show remaining hours. Keep track of remaining buffer to ensure your team delivers before the budget runs low.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowResourceInsight(false)}
                          className="text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-450 cursor-pointer p-0.5 shrink-0 transition-colors"
                          title="Close resource insight"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Specific Project Detailed Burn-down (Line Chart) */
              <div className="space-y-3">
                {(() => {
                  const project = projects.find(p => p.id === selectedChartProjectId);
                  if (!project) return null;
                  const totalSpent = getProjectStats(project.id);
                  const budgetToUse = project.budget_hours !== undefined && project.budget_hours !== null ? project.budget_hours : project.estimatedHours;
                  const remaining = Math.max(0, budgetToUse - totalSpent);
                  
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Metric widgets */}
                      <div className="p-3 rounded-lg border border-zinc-150 dark:border-[#2F2F2F] bg-zinc-50/50 dark:bg-[#191919]/50 font-mono space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400">Total Budget</p>
                        <p className="text-base font-bold text-zinc-800 dark:text-zinc-100">{budgetToUse}h</p>
                      </div>
                      <div className="p-3 rounded-lg border border-zinc-150 dark:border-[#2F2F2F] bg-zinc-50/50 dark:bg-[#191919]/50 font-mono space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400">Total Logged</p>
                        <p className="text-base font-bold text-blue-600 dark:text-blue-400">{totalSpent}h</p>
                      </div>
                      <div className="p-3 rounded-lg border border-zinc-150 dark:border-[#2F2F2F] bg-zinc-50/50 dark:bg-[#191919]/50 font-mono space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400">Remaining</p>
                        <p className="text-base font-bold text-amber-600 dark:text-amber-500">{remaining}h</p>
                      </div>
                      <div className="p-3 rounded-lg border border-zinc-150 dark:border-[#2F2F2F] bg-zinc-50/50 dark:bg-[#191919]/50 font-mono space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400">Ideal Velocity</p>
                        <p className="text-base font-bold text-slate-500 dark:text-slate-400">{(budgetToUse / Math.max(1, Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24)))).toFixed(1)}h/day</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="h-64 sm:h-72 w-full font-mono text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={burnDownChartData}
                      margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" className="dark:stroke-zinc-800/40" />
                      <XAxis
                        dataKey="label"
                        stroke="#888888"
                        tickLine={false}
                        axisLine={false}
                        className="text-[10px]"
                      />
                      <YAxis
                        stroke="#888888"
                        tickLine={false}
                        axisLine={false}
                        unit="h"
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                      />
                      <Line
                        name="Remaining Budget (Actual)"
                        type="monotone"
                        dataKey="Remaining Budget"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                        dot={{ r: 3 }}
                      />
                      <Line
                        name="Hours Logged (Effort)"
                        type="monotone"
                        dataKey="Hours Logged"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                        dot={{ r: 3 }}
                      />
                      <Line
                        name="Ideal Burn-down Vector"
                        type="monotone"
                        dataKey="Ideal Burn"
                        stroke="#94A3B8"
                        strokeWidth={1.5}
                        strokeDasharray="5 5"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <AnimatePresence>
                  {showBurnTimelineInsight && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="p-3 bg-blue-50/30 dark:bg-blue-950/10 rounded-lg border border-blue-150/45 dark:border-blue-900/20 flex items-start justify-between space-x-2 text-[11.5px] font-mono text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        <div className="flex items-start space-x-2.5">
                          <span className="text-sm shrink-0">📈</span>
                          <p>
                            <strong>Chronological Burn Timeline:</strong> Track your actual budget depletion against the ideal pace. The <span className="text-amber-600 font-bold dark:text-amber-450">amber line</span> shows remaining budget hours, while the <span className="text-zinc-500 font-bold dark:text-zinc-400 font-mono">dashed gray line</span> indicates the ideal linear burn rate to meet your deadline. Keep your actual line above the ideal pace to stay on track.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBurnTimelineInsight(false)}
                          className="text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-450 cursor-pointer p-0.5 shrink-0 transition-colors"
                          title="Close chronological burn timeline insight"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title & Action Panel */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Project Backlogs</h2>
          <p className="text-xs text-zinc-500 dark:text-gray-400 font-mono font-medium">Where deadlines loom and potential earnings become real.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-1.5 py-1.5 px-3 rounded-lg bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white text-xs font-semibold font-mono transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Initiate New Project</span>
          </button>
        )}
      </div>

      {/* Add Project Form Drawer/Card */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-xl border border-zinc-300 dark:border-[#2F2F2F] bg-zinc-50 dark:bg-[#1F1F1F] shadow-md space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-[#2F2F2F]">
            <h3 className="text-sm font-bold font-mono text-zinc-800 dark:text-[#E0E0E0]">New Scope Proposal</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-mono cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-lg flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-2 md:col-span-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Project Title</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Operation Coffee Repair"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Agency Name</label>
              <input
                type="text"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                placeholder="e.g. Sterling Cooper"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Brand Client</label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="e.g. Lucky Strike"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Estimated Hours (Budget)</label>
              <input
                type="number"
                value={estimatedHours}
                onChange={e => setEstimatedHours(e.target.value)}
                placeholder="e.g. 40"
                min="1"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Hourly Rate (£/hr)</label>
              <input
                type="number"
                value={rate}
                onChange={e => setRate(e.target.value)}
                placeholder="e.g. 100"
                min="0"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Official Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Impending Deadline (End Date)</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Budget Hours (Float, Nullable)</label>
              <input
                type="number"
                step="0.1"
                value={budgetHours}
                onChange={e => setBudgetHours(e.target.value)}
                placeholder="e.g. 50.5 (Defaults to Est. Hours)"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Burn Alert Thresholds (%)</label>
              <input
                type="text"
                value={alertThresholds}
                onChange={e => setAlertThresholds(e.target.value)}
                placeholder="e.g. 50, 75, 90, 100"
                className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 font-mono text-zinc-800 dark:text-[#E0E0E0]"
              />
            </div>

            <div className="flex items-center space-x-2 pt-5">
              <input
                type="checkbox"
                id="isNonBillable"
                checked={isNonBillable}
                onChange={e => setIsNonBillable(e.target.checked)}
                className="w-4 h-4 rounded text-blue-650 border-zinc-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="isNonBillable" className="text-xs font-mono font-medium text-zinc-700 dark:text-gray-300 cursor-pointer">
                Non-Billable Project
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono font-medium text-zinc-500 dark:text-gray-400">Scope Description (Witty justification)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe why this project will consume human capital and coffee."
              rows={2}
              className="w-full py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 text-zinc-800 dark:text-[#E0E0E0]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white text-xs font-bold font-mono transition-colors shadow cursor-pointer"
          >
            Deploy Project Plan to Production
          </button>
        </form>
      )}

      {/* Project Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-200 dark:border-[#2F2F2F] rounded-xl">
            <span className="text-4xl">📂</span>
            <h3 className="text-sm font-bold font-mono text-zinc-700 dark:text-zinc-300 mt-3">Zero Projects Identified</h3>
            <p className="text-xs text-zinc-400 dark:text-gray-500 mt-1">No tasks to track. Is this... pure freedom? Highly unlikely. Click "Initiate New Project" to start tracking.</p>
          </div>
        ) : (
          projects.map(project => {
            if (editingProjectId === project.id) {
              return (
                <div
                  key={project.id}
                  className="flex flex-col justify-between p-5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/10 dark:bg-blue-950/5 shadow-sm space-y-4 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-[#2F2F2F]">
                    <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">Edit Project Parameters</span>
                    <button
                      type="button"
                      onClick={() => setEditingProjectId(null)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-650 font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {editError && (
                    <p className="text-[10px] font-mono text-rose-500 bg-rose-50 dark:bg-rose-950/20 p-2 rounded border border-rose-200/50">
                      {editError}
                    </p>
                  )}

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500">Project Title</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full py-1 px-2.5 text-xs rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Agency Name</label>
                        <input
                          type="text"
                          value={editAgencyName}
                          onChange={e => setEditAgencyName(e.target.value)}
                          className="w-full py-1 px-2.5 text-xs rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Brand Client</label>
                        <input
                          type="text"
                          value={editBrandName}
                          onChange={e => setEditBrandName(e.target.value)}
                          className="w-full py-1 px-2.5 text-xs rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Est. Hours</label>
                        <input
                          type="number"
                          value={editEstimatedHours}
                          onChange={e => setEditEstimatedHours(e.target.value)}
                          className="w-full py-1 px-2.5 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Rate (£/hr)</label>
                        <input
                          type="number"
                          value={editRate}
                          onChange={e => setEditRate(e.target.value)}
                          className="w-full py-1 px-2.5 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Start Date</label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={e => setEditStartDate(e.target.value)}
                          className="w-full py-1 px-2.5 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Deadline</label>
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={e => setEditEndDate(e.target.value)}
                          className="w-full py-1 px-2.5 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-medium text-zinc-500">Scope Description</label>
                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full py-1 px-2.5 text-xs rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Budget Hours</label>
                        <input
                          type="number"
                          step="0.1"
                          value={editBudgetHours}
                          onChange={e => setEditBudgetHours(e.target.value)}
                          placeholder="Defaults to Est"
                          className="w-full py-1 px-2.5 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-medium text-zinc-500">Alert Thresholds (%)</label>
                        <input
                          type="text"
                          value={editAlertThresholds}
                          onChange={e => setEditAlertThresholds(e.target.value)}
                          placeholder="e.g. 50, 75, 90, 100"
                          className="w-full py-1 px-2.5 text-xs font-mono rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id={`edit-nonbillable-${project.id}`}
                        checked={editIsNonBillable}
                        onChange={e => setEditIsNonBillable(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor={`edit-nonbillable-${project.id}`} className="text-[10px] font-mono text-zinc-700 dark:text-gray-300 cursor-pointer">
                        Non-Billable Project
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSaveProject(project.id)}
                    className="w-full py-1.5 rounded bg-zinc-900 dark:bg-blue-600 text-white text-[11px] font-bold font-mono hover:bg-zinc-850 cursor-pointer"
                  >
                    Save Scope Parameters
                  </button>
                </div>
              );
            }

            const spent = getProjectStats(project.id);
            const budgetToUse = project.budget_hours !== undefined && project.budget_hours !== null ? project.budget_hours : project.estimatedHours;
            const remaining = Math.max(0, budgetToUse - spent);
            const percent = budgetToUse > 0 ? (spent / budgetToUse) * 100 : 0;

            const rateVal = project.rate ?? 0;
            const potentialEarnings = budgetToUse * rateVal;
            const actualEarnings = spent * rateVal;

            let progressColorClass = 'bg-emerald-300 dark:bg-emerald-300/80';
            if (percent >= 90) {
              progressColorClass = 'bg-rose-600';
            } else if (percent >= 75) {
              progressColorClass = 'bg-orange-600';
            } else if (percent >= 55) {
              progressColorClass = 'bg-amber-500';
            } else if (percent >= 25) {
              progressColorClass = 'bg-emerald-500';
            }

            // Date calculations
            const end = new Date(project.endDate);
            const start = new Date(project.startDate);
            const totalDuration = end.getTime() - start.getTime();
            const elapsed = Date.now() - start.getTime();
            const timePercent = Math.min(100, Math.max(0, totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0));
            
            return (
              <div
                key={project.id}
                className="flex flex-col justify-between p-5 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {/* Header */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      {/* Brand and Agency Client Tags */}
                      {(project.brandName || project.agencyName || project.isNonBillable) && (
                        <div className="flex items-center space-x-1.5 text-[10px] uppercase font-bold font-mono text-blue-600 dark:text-blue-400">
                          {project.isNonBillable && <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-350 px-1.5 py-0.5 rounded text-[9px] border border-zinc-200 dark:border-[#2F2F2F]">NON-BILLABLE</span>}
                          {project.isNonBillable && (project.brandName || project.agencyName) && <span className="text-zinc-300 dark:text-zinc-700">•</span>}
                          {project.agencyName && <span className="truncate max-w-[120px]">{project.agencyName}</span>}
                          {project.agencyName && project.brandName && <span className="text-zinc-300 dark:text-zinc-700">•</span>}
                          {project.brandName && <span className="truncate max-w-[120px]">{project.brandName}</span>}
                        </div>
                      )}
                      <h3 className="font-bold text-zinc-900 dark:text-white font-mono tracking-tight hover:underline cursor-pointer">
                        {project.name}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleStartEditProject(project)}
                        className="p-1 rounded text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                        title="Edit Project"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setProjectToDelete(project)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Terminate Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-zinc-500 dark:text-gray-400 leading-normal line-clamp-2 italic pt-1">
                      "{project.description}"
                    </p>
                  )}
                </div>

                {/* Potential Earnings Backlog & Rate Widget */}
                {project.isNonBillable ? (
                  <div className="p-3 bg-zinc-50/50 dark:bg-[#252525]/30 rounded-xl border border-zinc-100 dark:border-[#2F2F2F] my-3 text-center text-xs font-mono text-zinc-400 italic">
                    🛡️ Non-Revenue Compliant (Effort Ledger Only)
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50/50 dark:bg-[#252525]/30 rounded-xl border border-zinc-100 dark:border-[#2F2F2F] my-3">
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase tracking-wider font-mono text-zinc-400 dark:text-gray-500">Rate</p>
                      <p className="text-xs font-bold font-mono text-zinc-950 dark:text-white">£{rateVal}/hr</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[9px] uppercase tracking-wider font-mono text-zinc-400 dark:text-gray-500">Actual Earned</p>
                      <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">£{actualEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="col-span-2 border-t border-dashed border-zinc-200/60 dark:border-[#2F2F2F]/60 pt-2 space-y-0.5">
                      <p className="text-[9px] uppercase tracking-wider font-mono text-zinc-400 dark:text-gray-500">Potential Earnings</p>
                      <p className="text-xs font-bold font-mono text-amber-600 dark:text-amber-500">£{potentialEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}

                {/* Tracking Progress Bar */}
                <div className="mb-4 mt-2 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>Burn Rate: <strong className="text-zinc-700 dark:text-zinc-300">{spent}h</strong> / {budgetToUse}h</span>
                    </span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">{Math.round(percent)}%</span>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-zinc-100 dark:bg-[#191919] h-2 rounded-full overflow-hidden border border-zinc-200/50 dark:border-[#2F2F2F]/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progressColorClass}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>

                  {/* Date timelines */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-400 font-mono">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span className="truncate">Start: {project.startDate}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-400 font-mono justify-end">
                      <span className="truncate">Deadline: {project.endDate}</span>
                    </div>
                  </div>

                  {/* Project Timeline Burn Indicator */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1">
                    <span>Project Lifetime Spent:</span>
                    <span className="text-zinc-700 dark:text-[#E0E0E0]">{Math.round(timePercent)}%</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 🛑 Project Delete Confirmation Modal */}
      <AnimatePresence>
        {projectToDelete && (
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
                onClick={() => setProjectToDelete(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                title="Cancel deletion"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="p-3 rounded-full bg-rose-500/10 text-rose-650 dark:text-rose-400">
                  <AlertOctagon className="w-8 h-8 animate-pulse text-rose-500" />
                </div>
                <h2 className="text-lg font-bold font-mono tracking-tight text-zinc-950 dark:text-white uppercase">
                  ⚠️ Erase Project & Logs?
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-normal">
                  You are initiating a permanent project shredding action. This has immediate and irreversible consequences.
                </p>
              </div>

              {/* Warnings and audit stats box */}
              {(() => {
                const pSpent = getProjectStats(projectToDelete.id);
                const pRate = projectToDelete.rate ?? 0;
                const pEarnings = pSpent * pRate;
                
                return (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50/45 dark:bg-rose-950/10 rounded-xl border border-rose-100 dark:border-rose-950/30 text-xs leading-relaxed text-rose-800 dark:text-rose-350 font-medium">
                      <p className="mb-2 font-bold uppercase font-mono text-[10px] tracking-wider text-rose-700 dark:text-rose-400">⚠️ WARNING: DATA CASCADING PURGE</p>
                      Deleting <strong className="underline text-zinc-950 dark:text-white">{projectToDelete.name}</strong> will <strong className="underline font-bold text-rose-700 dark:text-rose-455 text-[12px]">permanently erase all {pSpent} recorded hours</strong> logged against it. This action cannot be undone and these time-log receipts will be shredded from your ledger history.
                    </div>

                    <div className="p-4 bg-zinc-50 dark:bg-[#151515] rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] leading-relaxed">
                      <div className="flex justify-between py-1 border-b border-zinc-150 dark:border-zinc-800/40">
                        <span className="text-zinc-400">PROJECT TITLE:</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">{projectToDelete.name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-zinc-150 dark:border-zinc-800/40">
                        <span className="text-zinc-400">TIME TO BE ERASED:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-450">{pSpent} hrs</span>
                      </div>
                      {!projectToDelete.isNonBillable && (
                        <div className="flex justify-between py-1">
                          <span className="text-zinc-400">BILLABLE REVENUE LOST:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-450">£{pEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setProjectToDelete(null)}
                  className="py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#252525] text-zinc-700 dark:text-zinc-350 text-xs font-bold font-mono hover:bg-zinc-50 dark:hover:bg-[#2D2D2D] transition-colors cursor-pointer text-center"
                >
                  Keep Project
                </button>
                <button
                  onClick={() => {
                    onDeleteProject(projectToDelete.id);
                    setProjectToDelete(null);
                  }}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono transition-colors shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Project</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
