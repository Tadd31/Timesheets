/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, TimeEntry, Tag } from '../types';
import { HelpCircle, Clock, Calendar, Folder, Check, AlertCircle, Coffee, ClipboardCheck, ShieldCheck, X, Plus, Info } from 'lucide-react';
import { fetchTagsEndpoint, findOrCreateTagEndpoint, deleteTagEndpoint, updateTagEndpoint } from '../utils/api';
import { motion, AnimatePresence } from 'motion/react';

interface TimesheetFormProps {
  projects: Project[];
  onAddEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt'>) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

export default function TimesheetForm({ projects, onAddEntry, selectedDate, setSelectedDate }: TimesheetFormProps) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [hours, setHours] = useState(''); // Initialized to empty as requested
  const [coffees, setCoffees] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submittedDetails, setSubmittedDetails] = useState<{
    projectName: string;
    hours: number;
    date: string;
    comment: string;
    coffees: number;
  } | null>(null);

  // Keyboard-first Tag State
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [globalTags, setGlobalTags] = useState<Tag[]>([]);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);
  const [showTagGuide, setShowTagGuide] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  // If projectId is empty but we have projects, auto-select the first one
  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  // Load global tags on mount
  useEffect(() => {
    fetchTagsEndpoint().then(tags => {
      setGlobalTags(tags);
    });
  }, []);

  // Update suggestions list
  useEffect(() => {
    if (!tagInput.trim()) {
      const available = globalTags.filter(gt => !selectedTags.some(st => st.id === gt.id));
      setSuggestions(available);
      setActiveSuggestionIdx(0);
      return;
    }
    const query = tagInput.toLowerCase().trim();
    const filtered = globalTags.filter(
      gt => gt.name.toLowerCase().includes(query) && !selectedTags.some(st => st.id === gt.id)
    );
    setSuggestions(filtered);
    setActiveSuggestionIdx(0);
  }, [tagInput, globalTags, selectedTags]);

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectSuggestion = (tag: Tag) => {
    setSelectedTags([...selectedTags, tag]);
    setTagInput('');
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter(t => t.id !== tagId));
  };

  const handleAddTagFromInput = async () => {
    const query = tagInput.trim();
    if (!query) return;

    if (showSuggestions && suggestions.length > 0 && activeSuggestionIdx >= 0 && activeSuggestionIdx < suggestions.length) {
      handleSelectSuggestion(suggestions[activeSuggestionIdx]);
    } else {
      const newOrExistingTag = await findOrCreateTagEndpoint(query);
      if (!selectedTags.some(t => t.id === newOrExistingTag.id)) {
        setSelectedTags([...selectedTags, newOrExistingTag]);
      }
      if (!globalTags.some(t => t.id === newOrExistingTag.id)) {
        setGlobalTags([...globalTags, newOrExistingTag]);
      }
      setTagInput('');
      setShowSuggestions(false);
    }
  };

  const handleToggleGlobalTag = (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleDeleteGlobalTag = async (tagId: string) => {
    await deleteTagEndpoint(tagId);
    setGlobalTags(prev => prev.filter(t => t.id !== tagId));
    setSelectedTags(prev => prev.filter(t => t.id !== tagId));
  };

  const handleRenameGlobalTag = async (tagId: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = await updateTagEndpoint(tagId, newName);
    if (updated) {
      setGlobalTags(prev => prev.map(t => t.id === tagId ? updated! : t));
      setSelectedTags(prev => prev.map(t => t.id === tagId ? updated! : t));
      setEditingTagId(null);
    } else {
      alert("Tag name must be unique and not empty.");
    }
  };

  const handleTagInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !tagInput && selectedTags.length > 0) {
      setSelectedTags(selectedTags.slice(0, -1));
      return;
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      await handleAddTagFromInput();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggestions(true);
      if (suggestions.length > 0) {
        setActiveSuggestionIdx((activeSuggestionIdx + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowSuggestions(true);
      if (suggestions.length > 0) {
        setActiveSuggestionIdx((activeSuggestionIdx - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Mandatory fields checks
    if (!projectId) {
      setError('Project selection is mandatory.');
      return;
    }

    if (!hours.trim()) {
      setError('Hours logged field cannot be empty.');
      return;
    }

    if (!comment.trim()) {
      setError('Accomplishment description is mandatory.');
      return;
    }

    const numericHours = parseFloat(hours);
    if (isNaN(numericHours) || numericHours <= 0) {
      setError('Hours must be greater than zero.');
      return;
    }

    if (numericHours > 24) {
      setError('Hours logged cannot exceed 24 in a single day.');
      return;
    }

    const numericCoffees = coffees.trim() === '' ? 0 : parseInt(coffees, 10);
    if (isNaN(numericCoffees) || numericCoffees < 0) {
      setError('Coffee consumed must be a non-negative integer.');
      return;
    }

    const currentProj = projects.find(p => p.id === projectId);
    const projName = currentProj ? currentProj.name : 'Unknown Project';

    onAddEntry({
      projectId,
      hours: numericHours,
      date: selectedDate,
      comment: comment.trim(),
      coffees: numericCoffees,
      tagIds: selectedTags.map(t => t.id)
    });

    setSubmittedDetails({
      projectName: projName,
      hours: numericHours,
      date: selectedDate,
      comment: comment.trim(),
      coffees: numericCoffees
    });

    // Reset hours, comment, tags and show success modal
    setHours(''); // Clear hours logged as requested
    setComment('');
    setCoffees('');
    setSelectedTags([]);
    setSuccess(true);
  };

  return (
    <div id="timesheet-form-card" className="p-5 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm transition-all">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100 dark:border-[#2F2F2F]">
        <h3 className="font-bold text-sm font-mono text-zinc-900 dark:text-white flex items-center space-x-1.5">
          <span>Log Effort Ledger</span>
        </h3>
      </div>

      {projects.length === 0 ? (
        <div className="p-4 bg-zinc-50 dark:bg-[#252525] rounded-lg border border-dashed border-zinc-200 dark:border-[#2F2F2F] text-center space-y-2">
          <Folder className="w-5 h-5 mx-auto text-zinc-400" />
          <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
            No active project codes.
          </p>
          <p className="text-[10.5px] text-zinc-400 dark:text-gray-500 leading-normal">
            You must create a project under the <strong>Projects</strong> tab before logging time. You can't charge your hours to the "Coffee Machine Maintenance" budget yet.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/35 text-rose-600 dark:text-rose-400 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/35 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-start space-x-2">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Timesheet submission accepted! Our digital auditing spiders are satisfied for now.</span>
            </div>
          )}

          {/* Grid fields */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Project dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400 flex items-center space-x-1">
                <Folder className="w-3 h-3" />
                <span>Project Code</span>
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full text-xs font-mono py-2 px-2.5 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Hours worked */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Hours Logged</span>
              </label>
              <input
                type="number"
                value={hours}
                onChange={e => setHours(e.target.value)}
                step="0.25"
                min="0.25"
                max="24"
                className="w-full text-xs font-mono py-1.5 px-2.5 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500"
              />
            </div>

            {/* Date Picker */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400 flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full text-xs font-mono py-1.5 px-2.5 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500"
              />
            </div>

            {/* Coffee Drank */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400 flex items-center space-x-1">
                <Coffee className="w-3 h-3 text-amber-500" />
                <span>Coffees Drank</span>
              </label>
              <input
                type="number"
                value={coffees}
                onChange={e => setCoffees(e.target.value)}
                min="0"
                max="50"
                className="w-full text-xs font-mono py-1.5 px-2.5 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Dynamic Keyboard-First Tags Input */}
          <div className="space-y-1 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400">
                Type tag to create
              </label>
              <button
                type="button"
                onClick={() => setShowTagGuide(!showTagGuide)}
                className={`flex items-center space-x-1 py-0.5 px-1.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  showTagGuide
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    : 'text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#252525] border border-transparent'
                }`}
                title="Toggle Tag Management Guide"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Guide</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] focus-within:ring-1 focus-within:ring-blue-500">
              {selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className={`inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 rounded border ${tag.colorCode}`}
                >
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="hover:text-rose-600 dark:hover:text-rose-400 focus:outline-none cursor-pointer font-bold text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Small delay to allow click on autocomplete item before it hides
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder={selectedTags.length === 0 ? "Type tag... [Enter] or [,] to add" : "Add more..."}
                className="flex-1 bg-transparent border-none text-xs font-mono focus:outline-none text-zinc-800 dark:text-[#E0E0E0] min-w-[120px] py-0.5"
              />
              {tagInput.trim() && (
                <button
                  type="button"
                  onClick={handleAddTagFromInput}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white text-[10px] font-bold font-mono transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1C1C1C] shadow-lg divide-y divide-zinc-100 dark:divide-[#2F2F2F]/60">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onMouseDown={(e) => {
                      // Prevent onBlur from hiding dropdown before click registered
                      e.preventDefault();
                    }}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors ${
                      idx === activeSuggestionIdx
                        ? 'bg-zinc-100 dark:bg-[#2F2F2F] text-zinc-950 dark:text-white font-bold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#252525]'
                    }`}
                  >
                    <span>{suggestion.name}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Select</span>
                  </button>
                ))}
              </div>
            )}

            {/* Quick-Toggle Preset Tags list with compound select/delete buttons */}
            {globalTags.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Quick Add:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {globalTags.map(tag => {
                    const isSelected = selectedTags.some(t => t.id === tag.id);
                    if (editingTagId === tag.id) {
                      return (
                        <div
                          key={tag.id}
                          className="inline-flex items-center text-[10px] font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#191919] p-0.5 space-x-1 animate-in fade-in zoom-in-95 duration-100"
                        >
                          <input
                            type="text"
                            value={editingTagName}
                            onChange={(e) => setEditingTagName(e.target.value)}
                            className="px-1.5 py-0.5 bg-zinc-50 dark:bg-[#151515] text-zinc-800 dark:text-zinc-100 text-[10px] font-mono border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded max-w-[85px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditingTagId(null);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRenameGlobalTag(tag.id, editingTagName);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameGlobalTag(tag.id, editingTagName)}
                            className="p-0.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded cursor-pointer"
                            title="Save tag name"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTagId(null)}
                            className="p-0.5 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={tag.id}
                        className={`inline-flex items-center text-[10px] font-mono rounded border transition-all ${
                          isSelected
                            ? `${tag.colorCode} font-bold ring-1 ring-offset-1 ring-zinc-400 dark:ring-offset-zinc-900`
                            : 'border-zinc-200 dark:border-zinc-850 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-[#E0E0E0] bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-[#252525]'
                        }`}
                        onDoubleClick={() => {
                          setEditingTagId(tag.id);
                          setEditingTagName(tag.name);
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleGlobalTag(tag)}
                          className="pl-2 pr-1.5 py-0.5 flex items-center space-x-1 cursor-pointer focus:outline-none"
                          title={`Toggle "${tag.name}" tag (Double-click to rename)`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{tag.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagToDelete(tag);
                          }}
                          className="pr-2 pl-1.5 py-0.5 hover:text-rose-600 dark:hover:text-rose-400 border-l border-zinc-200/50 dark:border-zinc-800/40 transition-colors focus:outline-none cursor-pointer"
                          title={`Delete "${tag.name}" permanently from presets`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confirmation Modal for deleting Quick Add Tag */}
            <AnimatePresence>
              {tagToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 dark:bg-black/75 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1A1A1A] p-6 shadow-2xl space-y-4 font-mono"
                  >
                    <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-500">
                      <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                          Delete Quick Add Tag
                        </h3>
                        <p className="text-[10px] text-zinc-400">Confirmation Required</p>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      Are you sure you want to delete the tag preset <strong className="text-zinc-900 dark:text-white font-bold">"{tagToDelete.name}"</strong>? This will permanently remove it from your Quick Add tags.
                    </p>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setTagToDelete(null)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteGlobalTag(tagToDelete.id);
                          setTagToDelete(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow cursor-pointer"
                      >
                        Delete Tag
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Collapsible Tag Management Guide */}
            {showTagGuide && (
              <div className="mt-2 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/20 bg-blue-50/30 dark:bg-blue-950/10 text-[10.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-mono flex items-start space-x-2">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Tag Management Guide:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-zinc-600 dark:text-zinc-400 text-[10px]">
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200">• Selection:</strong> Click a preset tag to toggle it on/off.
                    </div>
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200">• Keyboard:</strong> Press <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded text-[9px]">Enter</kbd> or <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded text-[9px]">,</kbd> to add custom tag.
                    </div>
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200">• Delete Pill:</strong> Click <span className="text-rose-600 dark:text-rose-400 font-bold">×</span> on a selected tag pill.
                    </div>
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200">• Rename Tag:</strong> Double-click any preset to edit & fix typos.
                    </div>
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200">• Delete Preset:</strong> Click <span className="text-rose-600 dark:text-rose-400 font-bold">×</span> on the right of any preset tag.
                    </div>
                    <div>
                      <strong className="text-zinc-800 dark:text-zinc-200">• Undo Last:</strong> Press <kbd className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded text-[9px]">Backspace</kbd> on empty text input.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comment description */}
          <div className="space-y-1">
            <label className="text-xs font-mono font-bold text-zinc-500 dark:text-gray-400">
              Accomplishment Description
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe what you achieved during these hours..."
              rows={3}
              className="w-full py-2 px-3 text-sm rounded-lg border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-zinc-800 dark:text-[#E0E0E0] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 placeholder-zinc-400 dark:placeholder-zinc-600"
            />
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.015, y: -1 }}
            whileTap={{ scale: 0.985 }}
            className="group w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold font-mono transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4 text-zinc-400 group-hover:text-white dark:text-blue-200 dark:group-hover:text-white transition-all group-hover:rotate-6 group-hover:scale-110" />
            <span>Submit to Corporate Auditors</span>
          </motion.button>
        </form>
      )}

      {/* 🧾 Auditor Confirmation Modal / Receipt */}
      <AnimatePresence>
        {success && submittedDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-md p-6 rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-[#1E1E1E] shadow-2xl space-y-5 text-zinc-800 dark:text-[#E0E0E0] relative"
            >
              {/* Close Button top-right */}
              <button
                onClick={() => setSuccess(false)}
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
                  🎉 Hours Logged Successfully!
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs">
                  Your timesheet has been logged and recorded successfully.
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
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-405 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">CERTIFIED</span>
                </div>

                <div className="space-y-2 relative z-10">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">PROJECT CODE:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate" title={submittedDetails.projectName}>
                      {submittedDetails.projectName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">HOURS LOGGED:</span>
                    <span className="font-bold text-zinc-950 dark:text-white text-xs bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                      {submittedDetails.hours} hrs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">DATE RECORDED:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{submittedDetails.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 dark:text-zinc-500">CAFFEINE METRIC:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1">
                      <Coffee className="w-3.5 h-3.5 text-amber-500 inline" />
                      <span>{submittedDetails.coffees} cups</span>
                    </span>
                  </div>
                  <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-2 mt-2">
                    <span className="text-zinc-400 dark:text-zinc-500 block mb-0.5">ACCOMPLISHMENT MEMO:</span>
                    <p className="italic text-zinc-600 dark:text-zinc-350 text-[10px] bg-zinc-100/50 dark:bg-zinc-900 p-2 rounded border border-zinc-150 dark:border-zinc-800/40 line-clamp-2">
                      "{submittedDetails.comment}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <motion.button
                  onClick={() => setSuccess(false)}
                  whileHover={{ scale: 1.02, y: -0.5 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2 rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold font-mono shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
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
