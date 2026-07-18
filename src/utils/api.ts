/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tag } from '../types';
import { getTags, saveTags } from './storage';

const COLOR_POOL = [
  'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/25',
  'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/25',
  'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/25',
  'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25',
  'bg-pink-500/15 text-pink-600 border-pink-500/30 dark:text-pink-400 dark:bg-pink-500/10 dark:border-pink-500/25',
  'bg-cyan-500/15 text-cyan-600 border-cyan-500/30 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/25',
  'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/25',
  'bg-indigo-500/15 text-indigo-600 border-indigo-500/30 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/25',
  'bg-teal-500/15 text-teal-600 border-teal-500/30 dark:text-teal-400 dark:bg-teal-500/10 dark:border-teal-500/25'
];

/**
 * Endpoint simulator to fetch all existing tags so the frontend can pre-load or cache them.
 */
export async function fetchTagsEndpoint(): Promise<Tag[]> {
  // Simulate minor network delay (e.g. 100ms) for architectural realism
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getTags());
    }, 100);
  });
}

/**
 * Idempotent "find or create" endpoint.
 * When a user submits a time entry with a tag name, checks if it exists globally.
 * If it exists, returns it; if it doesn't, creates it on the fly and returns it.
 */
export async function findOrCreateTagEndpoint(tagName: string): Promise<Tag> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sanitized = tagName.trim();
      const tags = getTags();
      
      // Case-insensitive search
      const existing = tags.find(t => t.name.toLowerCase() === sanitized.toLowerCase());
      if (existing) {
        resolve(existing);
        return;
      }

      // Generate a new Tag
      const randomColor = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
      const newTag: Tag = {
        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: sanitized,
        colorCode: randomColor
      };

      const updatedTags = [...tags, newTag];
      saveTags(updatedTags);
      resolve(newTag);
    }, 120);
  });
}

/**
 * Endpoint simulator to delete a tag by ID.
 */
export async function deleteTagEndpoint(tagId: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const tags = getTags();
      const updatedTags = tags.filter(t => t.id !== tagId);
      saveTags(updatedTags);
      resolve(true);
    }, 100);
  });
}

/**
 * Endpoint simulator to update/rename a tag by ID.
 */
export async function updateTagEndpoint(tagId: string, newName: string): Promise<Tag | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const sanitized = newName.trim();
      if (!sanitized) {
        resolve(null);
        return;
      }
      const tags = getTags();
      const existing = tags.find(t => t.name.toLowerCase() === sanitized.toLowerCase() && t.id !== tagId);
      if (existing) {
        // Name already taken by another tag
        resolve(null);
        return;
      }
      let updatedTag: Tag | null = null;
      const updatedTags = tags.map(t => {
        if (t.id === tagId) {
          updatedTag = { ...t, name: sanitized };
          return updatedTag;
        }
        return t;
      });
      if (updatedTag) {
        saveTags(updatedTags);
      }
      resolve(updatedTag);
    }, 120);
  });
}

