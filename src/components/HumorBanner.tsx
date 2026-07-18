/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RotateCw } from 'lucide-react';
import { getRandomQuote } from '../utils/humor';
import { HumorQuote } from '../types';

export default function HumorBanner() {
  const [quote, setQuote] = useState<HumorQuote>({ quote: '', author: '' });

  useEffect(() => {
    // Determine if it's Monday or Friday to seed appropriate humor
    const day = new Date().getDay();
    let trigger: 'monday' | 'friday' | 'general' = 'general';
    if (day === 1) trigger = 'monday';
    if (day === 5) trigger = 'friday';

    setQuote(getRandomQuote(trigger));
  }, []);

  const handleNewQuote = () => {
    setQuote(getRandomQuote());
  };

  return (
    <div id="humor-banner" className="mb-6 p-5 rounded-xl border border-zinc-200 dark:border-[#2F2F2F] bg-white dark:bg-[#1F1F1F] shadow-sm transition-all">
      {/* Dynamic Wisdom Box */}
      <div className="flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#2F2F2F] text-zinc-500 dark:text-[#E0E0E0] border border-zinc-200 dark:border-[#3F3F3F]">
              Daily Wisdom
            </span>
            <span className="text-xs text-zinc-400 dark:text-gray-500 font-mono">
              (Timesheet Compliance Department Approved)
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-800 dark:text-[#E0E0E0] italic leading-relaxed pt-1">
            "{quote.quote}"
          </p>
          <p className="text-xs text-zinc-500 dark:text-gray-400 text-right font-mono">
            — {quote.author}
          </p>
        </div>

        <button
          onClick={handleNewQuote}
          className="self-start flex items-center space-x-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-[#E0E0E0] transition-colors py-1 px-2 rounded hover:bg-zinc-50 dark:hover:bg-[#2F2F2F] border border-transparent hover:border-zinc-200 dark:hover:border-[#3F3F3F] cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Contemplate Another Insight</span>
        </button>
      </div>
    </div>
  );
}
