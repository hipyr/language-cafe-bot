import client from '../../client/index.js';
import Tracker from '../../models/tracker.js';
import channelLog, { generateSystemLogContent } from './channel-log.js';

// Cell state emojis
export const CELL_EMOJIS = {
  MISSING: '⬜',
  FINAL_MISS: '❌',
  DONE: '✅',
  BREAK: '🟨',
  BEFORE_JOIN: '🔘',
};

/**
 * Get the start of day for a given date
 */
export function getStartOfDay(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Calculate which tracker week a date falls into
 * @param {Date} date - The date to check
 * @param {Date} trackerStartDate - When the tracker started
 * @returns {number} - Week number (0-based)
 */
export function getTrackerWeek(date, trackerStartDate) {
  const startOfDay = getStartOfDay(date);
  const startOfTracker = getStartOfDay(trackerStartDate);
  const diffTime = startOfDay.getTime() - startOfTracker.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
}

/**
 * Get the start date of a specific tracker week
 * @param {number} weekNumber - Week number (0-based)
 * @param {Date} trackerStartDate - When the tracker started
 * @returns {Date} - Start date of that week
 */
export function getTrackerWeekStart(weekNumber, trackerStartDate) {
  const startOfTracker = getStartOfDay(trackerStartDate);
  const weekStart = new Date(startOfTracker);
  weekStart.setDate(weekStart.getDate() + weekNumber * 7);
  return weekStart;
}

/**
 * Check if a date is within the tracker period
 * @param {Date} date - Date to check
 * @param {Date} startDate - Tracker start date
 * @param {Date} endDate - Tracker end date
 * @returns {boolean}
 */
export function isDateInTrackerPeriod(date, startDate, endDate) {
  const checkDate = getStartOfDay(date);
  const start = getStartOfDay(startDate);
  const end = getStartOfDay(endDate);
  return checkDate >= start && checkDate <= end;
}

/**
 * Fetch a tracker's channel. If the channel no longer exists on Discord
 * (Unknown Channel), deactivate the tracker so schedules stop retrying it.
 */
export async function fetchTrackerChannel(tracker) {
  try {
    return await client.channels.fetch(tracker.threadId);
  } catch (error) {
    if (error.code === 10003) {
      // Matching on isActive makes every call after the first a no-op, so we log once per tracker.
      const { modifiedCount } = await Tracker.updateOne(
        { threadId: tracker.threadId, isActive: true },
        { isActive: false },
      );

      if (modifiedCount > 0) {
        channelLog(
          generateSystemLogContent('Tracker Deactivated', {
            tracker: `<#${tracker.threadId}>`,
            name: tracker.displayName || 'unnamed',
            reason: 'channel no longer exists',
          }),
        );
      }

      return null;
    }
    throw error;
  }
}

/**
 * Validate channel is a thread (any type)
 * @param {Object} channel - Discord channel object
 * @returns {boolean}
 */
export function isForumThread(channel) {
  // Accept any thread type: PublicThread (11), PrivateThread (12), or forum threads
  // Thread types: 10 (AnnouncementThread), 11 (PublicThread), 12 (PrivateThread)
  return channel && channel.isThread();
}
