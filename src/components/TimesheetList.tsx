/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, TimeEntry, Tag } from '../types';
import { Trash2, Filter, Calendar, Folder, Clock, Hash, CheckSquare, Coffee, Pencil, Check, X } from 'lucide-react';
import { getTags } from '../utils/storage';
import { motion, AnimatePresence } from 'motion/react';
import { formatDateDMY } from '../utils/formatters';

interface TimesheetListProps {
  entries: TimeEntry[];
  projects: Project[];
  onDeleteEntry: (entryId: string) => void;
  onEditEntry: (entry: TimeEntry) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

export default function TimesheetList({ entries, projects, onDeleteEntry, onEditEntry, selectedDate, setSelectedDate }: TimesheetListProps) {
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [viewScope, setViewScope] = useState<'day' | 'all'>('all');
  const [allTags, setAllTags] = useState<Tag[]>([]);

  useEffect(() => {
    setAllTags(getTags());
  }, [entries]);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editCoffees, setEditCoffees] = useState('');
  const [editComment, setEditComment] = useState('');

  const handleStartEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditDate(entry.date);
    setEditProjectId(entry.projectId);
    setEditHours(String(entry.hours));
    setEditCoffees(String(entry.coffees || 0));
    setEditComment(entry.comment);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = (entry: TimeEntry) => {
    if (!editProjectId) {
      alert("You must assign this effort to a project. Floating work is highly frowned upon by senior management.");
      return;
    }

    const numericHours = parseFloat(editHours);
    if (isNaN(numericHours) || numericHours <= 0) {
      alert("Hours must be greater than zero. Working backwards in time is not yet a supported corporate benefit.");
      return;
    }

    if (numericHours > 24) {
      alert("An earth-day has 24 hours. Unless you are remote-working from Jupiter, please dial it back.");
      return;
    }

    const numericCoffees = parseInt(editCoffees, 10);
    if (isNaN(numericCoffees) || numericCoffees < 0) {
      alert("Coffee consumed must be a non-negative integer. Negative consumption violates laws of thermodynamics.");
      return;
    }

    if (!editComment.trim()) {
      alert("Please add a comment. Auditing requires at least some plausible-sounding letters.");
      return;
    }

    onEditEntry({
      ...entry,
      projectId: editProjectId,
      date: editDate,
      hours: numericHours,
      coffees: numericCoffees,
      comment: editComment.trim()
    });

    setEditingId(null);
  };

  const getProjectName = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    return proj ? proj.name : 'Unknown Operation';
  };

  const renderTeammateBadge = (entry: TimeEntry) => {
    if (!entry.loggedByName) return null;
    
    const name = entry.loggedByName;
    const email = entry.loggedByEmail || '';
    const parts = name.trim().split(/\s+/);
    let initials = '?';
    if (parts.length === 1) {
      initials = parts[0].substring(0, 2).toUpperCase();
    } else if (parts.length > 1) {
      initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    
    const colors = [
      'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30',
      'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30',
      'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
      'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
      'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-900/30',
      'bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 border-pink-100 dark:border-pink-900/30',
      'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30',
      'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorClass = colors[Math.abs(hash) % colors.length];

    return (
      <span 
        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono border ${colorClass} font-bold transition-all shadow-xs shrink-0 select-none`}
        title={`${name} (${email || 'No email registered'})`}
      >
        <span className="w-3.5 h-3.5 rounded-full bg-current/10 flex items-center justify-center text-[8.5px] font-extrabold tracking-tighter">
          {initials}
        </span>
        <span className="max-w-[100px] truncate">{name}</span>
      </span>
    );
  };

  // Filter logic
  const filteredEntries = entries.filter(entry => {
    // Project filter
    if (filterProjectId !== 'all' && entry.projectId !== filterProjectId) {
      return false;
    }
    // Date view scope filter
    if (viewScope === 'day' && entry.date !== selectedDate) {
      return false;
    }
    return true;
  });

  // Sort entries by date desc, then by createdAt desc
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  const totalFilteredHours = sortedEntries.reduce((sum, e) => sum + e.hours, 0);
  const totalFilteredCoffees = sortedEntries.reduce((sum, e) => sum + (e.coffees || 0), 0);

  return (
    <div id="timesheet-list-section" className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm">
        <div className="flex items-center space-x-2 text-zinc-700 dark:text-[#E0E0E0]">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-bold font-mono tracking-tight uppercase">Auditing Filters</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View scope toggle */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-[#2F2F2F] p-0.5 bg-zinc-50 dark:bg-[#191919] text-xs font-mono">
            <button
              onClick={() => setViewScope('day')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewScope === 'day'
                  ? 'bg-white dark:bg-[#2F2F2F] text-zinc-800 dark:text-[#E0E0E0] font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Selected Day Filter
            </button>
            <button
              onClick={() => setViewScope('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-white dark:bg-[#2F2F2F] text-zinc-800 dark:text-[#E0E0E0] font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              All Recorded History
            </button>
          </div>

          {viewScope === 'day' && (
            <div className="relative flex items-center bg-zinc-50 dark:bg-[#191919] rounded-lg border border-zinc-200 dark:border-[#2F2F2F] px-2.5 py-1 text-xs font-mono animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-zinc-400 dark:text-zinc-500 mr-1.5 font-bold uppercase text-[9px] tracking-wider shrink-0">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setViewScope('day');
                }}
                className="bg-transparent border-none text-zinc-700 dark:text-[#E0E0E0] text-xs font-mono focus:outline-none cursor-pointer w-[120px]"
              />
              <Calendar className="w-3.5 h-3.5 text-zinc-400 pointer-events-none ml-1 shrink-0" />
            </div>
          )}

          {/* Project dropdown filter */}
          <select
            value={filterProjectId}
            onChange={e => setFilterProjectId(e.target.value)}
            className="text-xs font-mono py-1.5 px-2.5 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-zinc-50 dark:bg-[#191919] text-zinc-700 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries List */}
      <div className="rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm overflow-hidden">
        {sortedEntries.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 font-mono space-y-1.5">
            <CheckSquare className="w-6 h-6 mx-auto text-zinc-300 dark:text-zinc-700" />
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Clean Slate</h4>
            <p className="text-[11px] max-w-sm mx-auto leading-normal">
              No effort logged matching the current filter. Either you are completely on top of things, or timesheet cooking hasn't begun yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-[#2F2F2F] bg-zinc-50/50 dark:bg-[#252525] text-[10px] font-mono text-zinc-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Project Scope</th>
                  <th className="py-2.5 px-4">Effort</th>
                  <th className="py-2.5 px-4">Fuel</th>
                  <th className="py-2.5 px-4 w-[40%]">Witty Accomplishment Log</th>
                  <th className="py-2.5 px-4 text-right">Sanitize</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-[#2F2F2F] text-xs text-zinc-800 dark:text-[#E0E0E0]">
                <AnimatePresence initial={false}>
                  {sortedEntries.map(entry => {
                    const isEditing = editingId === entry.id;
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={`transition-colors group ${
                          isEditing 
                            ? 'bg-blue-50/40 dark:bg-blue-950/10' 
                            : 'hover:bg-zinc-50/50 dark:hover:bg-[#252525]/40'
                        }`}
                      >
                      {/* Date */}
                      <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap text-zinc-500 dark:text-gray-400">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDate}
                            onChange={e => setEditDate(e.target.value)}
                            className="text-[11px] font-mono py-1 px-1.5 rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          formatDateDMY(entry.date)
                        )}
                      </td>

                      {/* Project */}
                      <td className="py-2.5 px-4">
                        {isEditing ? (
                          <select
                            value={editProjectId}
                            onChange={e => setEditProjectId(e.target.value)}
                            className="text-[11px] font-mono py-1 px-1.5 max-w-[150px] rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 font-mono text-[11px] font-bold text-zinc-700 dark:text-[#E0E0E0]">
                            <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                            <span className="truncate max-w-[150px]" title={getProjectName(entry.projectId)}>
                              {getProjectName(entry.projectId)}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Hours */}
                      <td className="py-2.5 px-4 font-mono text-zinc-900 dark:text-white font-bold whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            max="24"
                            value={editHours}
                            onChange={e => setEditHours(e.target.value)}
                            className="text-[11px] font-mono py-1 px-1.5 w-16 rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                          />
                        ) : (
                          `${entry.hours} hrs`
                        )}
                      </td>

                      {/* Coffees */}
                      <td className="py-2.5 px-4 font-mono text-amber-700 dark:text-amber-500 font-semibold whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={editCoffees}
                            onChange={e => setEditCoffees(e.target.value)}
                            className="text-[11px] font-mono py-1 px-1.5 w-12 rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="inline-flex items-center space-x-1">
                            <Coffee className="w-3.5 h-3.5 text-amber-500" />
                            <span>{entry.coffees || 0}</span>
                          </span>
                        )}
                      </td>

                      {/* Comment */}
                      <td className="py-2.5 px-4 italic leading-relaxed text-zinc-600 dark:text-gray-400">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editComment}
                            onChange={e => setEditComment(e.target.value)}
                            placeholder="Witty accomplishment"
                            className="text-[11px] py-1 px-1.5 w-full rounded border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <div>
                            <div>{entry.comment}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {renderTeammateBadge(entry)}
                              {entry.tagIds && entry.tagIds.length > 0 && entry.tagIds.map(tagId => {
                                const tagObj = allTags.find(t => t.id === tagId);
                                if (!tagObj) return null;
                                return (
                                  <span
                                    key={tagId}
                                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border leading-none ${tagObj.colorCode}`}
                                  >
                                    {tagObj.name}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleSave(entry)}
                              className="p-1 rounded text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
                              title="Save changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-[#E0E0E0] hover:bg-zinc-100 dark:hover:bg-[#2F2F2F] transition-all cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end space-x-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => handleStartEdit(entry)}
                              className="p-1 rounded text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all cursor-pointer"
                              title="Edit entry"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteEntry(entry.id)}
                              className="p-1 rounded text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
              {/* Footer row with stats */}
              <tfoot>
                <tr className="bg-zinc-50/20 dark:bg-[#252525]/30 border-t border-zinc-200 dark:border-[#2F2F2F] text-[11px] font-mono text-zinc-500 dark:text-gray-400 font-bold">
                  <td colSpan={2} className="py-2.5 px-4 text-left">
                    Total Filtered:
                  </td>
                  <td className="py-2.5 px-4 text-zinc-900 dark:text-white text-sm font-bold">
                    {totalFilteredHours} hrs
                  </td>
                  <td colSpan={3} className="py-2.5 px-4 text-left text-amber-750 dark:text-amber-500 text-sm font-bold">
                    <span className="inline-flex items-center space-x-1">
                      <Coffee className="w-4 h-4 text-amber-500" />
                      <span>{totalFilteredCoffees} cups</span>
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
