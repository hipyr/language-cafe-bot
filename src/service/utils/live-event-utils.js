import { time } from 'discord.js';

// ─── Date / time helpers ──────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Parse a "YYYY-MM-DD" date string as a UTC midnight Date.
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDateUTC(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Format a Date as "YYYY-MM-DD" in UTC.
 * @param {Date} d
 * @returns {string}
 */
export function formatDateUTC(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a "HH:MM" time string into { hours, minutes }.
 * @param {string} timeStr
 * @returns {{ hours: number, minutes: number }}
 */
export function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Validate a "HH:MM" time string.
 * @param {string} timeStr
 * @returns {boolean}
 */
export function isValidTime(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const { hours, minutes } = parseTime(timeStr);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Validate a "YYYY-MM-DD" date string.
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = parseDateUTC(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return formatDateUTC(d) === dateStr;
}

/**
 * Given a "YYYY-MM-DD" date and "HH:MM" time (both UTC), return a Unix timestamp (seconds).
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {number}
 */
export function toUnixTimestamp(dateStr, timeStr) {
  const { hours, minutes } = parseTime(timeStr);
  const d = parseDateUTC(dateStr);
  d.setUTCHours(hours, minutes, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Return a Discord-localised timestamp string using discord.js time().
 * Default style 'f' = "DD Month YYYY HH:MM".
 * @param {string} dateStr
 * @param {string} timeStr
 * @param {string} [style='f']
 * @returns {string}
 */
export function discordTimestamp(dateStr, timeStr, style = 'f') {
  return time(toUnixTimestamp(dateStr, timeStr), style);
}

/**
 * Human-readable "Day HH:MM–HH:MM UTC" label for a schedule slot.
 * @param {{ dayOfWeek: number, startTime: string, endTime: string }} slot
 * @returns {string}
 */
export function formatSlot(slot) {
  return `${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime} UTC`;
}

// ─── Occurrence generation ────────────────────────────────────────────────────

/**
 * An occurrence represents a single scheduled live-event session.
 * @typedef {{ date: string, startTime: string, endTime: string }} Occurrence
 */

/**
 * Generate all occurrences for a LiveEventSchedule within the bounds of
 * [fromDate, toDate] (both inclusive, as Date objects at UTC midnight).
 *
 * Handles:
 * - One-time events → at most one occurrence
 * - Recurring events → one occurrence per (week × slot) combination
 * - Skipped occurrences are excluded
 * - Rescheduled occurrences: original slot is replaced by the replacement
 *
 * @param {object} schedule  — Mongoose LiveEventSchedule document (or plain object)
 * @param {Date}   fromDate  — lower bound (UTC midnight)
 * @param {Date}   toDate    — upper bound (UTC midnight, inclusive end-of-day)
 * @returns {Occurrence[]}   — sorted ascending by date then startTime
 */
export function generateOccurrences(schedule, fromDate, toDate) {
  /** @type {Occurrence[]} */
  const occurrences = [];

  // ── One-time event ────────────────────────────────────────────────────────
  if (schedule.scheduleType === 'one-time') {
    const { oneTimeDate, oneTimeStartTime, oneTimeEndTime } = schedule;
    if (!oneTimeDate || !oneTimeStartTime || !oneTimeEndTime) return [];

    const d = parseDateUTC(oneTimeDate);
    if (d >= fromDate && d <= toDate) {
      occurrences.push({
        date: oneTimeDate,
        startTime: oneTimeStartTime,
        endTime: oneTimeEndTime,
      });
    }
    return applyExceptions(occurrences, schedule, fromDate, toDate);
  }

  // ── Recurring event ───────────────────────────────────────────────────────
  if (!schedule.recurrenceStartDate || !schedule.recurrenceEndDate) return [];
  if (!schedule.slots || schedule.slots.length === 0) return [];

  const recStart = parseDateUTC(schedule.recurrenceStartDate);
  const recEnd = parseDateUTC(schedule.recurrenceEndDate);

  // Clamp the window to the recurrence period
  const windowStart = fromDate > recStart ? fromDate : recStart;
  const windowEnd = toDate < recEnd ? toDate : recEnd;

  if (windowStart > windowEnd) return [];

  // Walk day-by-day through the window
  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    const dow = cursor.getUTCDay();
    const dateStr = formatDateUTC(cursor);

    for (const slot of schedule.slots) {
      if (slot.dayOfWeek === dow) {
        occurrences.push({
          date: dateStr,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return applyExceptions(occurrences, schedule, fromDate, toDate);
}

/**
 * Remove skipped occurrences and substitute rescheduled ones.
 * @param {Occurrence[]} occurrences
 * @param {object} schedule
 * @param {Date} fromDate
 * @param {Date} toDate
 * @returns {Occurrence[]}
 */
function applyExceptions(occurrences, schedule, fromDate, toDate) {
  const skipped = new Set(
    (schedule.skippedOccurrences ?? []).map((s) => `${s.date}|${s.startTime}`),
  );

  // Map of originalKey → rescheduled record
  const rescheduled = new Map(
    (schedule.rescheduledOccurrences ?? []).map((r) => [
      `${r.originalDate}|${r.originalStartTime}`,
      r,
    ]),
  );

  const result = [];
  const originalKeys = new Set(occurrences.map((occ) => `${occ.date}|${occ.startTime}`));

  for (const occ of occurrences) {
    const key = `${occ.date}|${occ.startTime}`;

    if (skipped.has(key)) continue;

    if (rescheduled.has(key)) {
      const r = rescheduled.get(key);
      result.push({
        date: r.newDate,
        startTime: r.newStartTime,
        endTime: r.newEndTime,
        rescheduled: true,
        originalDate: r.originalDate,
        originalStartTime: r.originalStartTime,
      });
    } else {
      result.push(occ);
    }
  }

  // Include a replacement whose original date is outside the query window.
  // This is needed when a future occurrence is moved into today.
  for (const replacement of rescheduled.values()) {
    const originalKey = `${replacement.originalDate}|${replacement.originalStartTime}`;
    const replacementDate = parseDateUTC(replacement.newDate);
    if (
      !originalKeys.has(originalKey) &&
      !skipped.has(originalKey) &&
      isScheduledOccurrence(schedule, replacement.originalDate, replacement.originalStartTime) &&
      replacementDate >= fromDate &&
      replacementDate <= toDate
    ) {
      result.push({
        date: replacement.newDate,
        startTime: replacement.newStartTime,
        endTime: replacement.newEndTime,
        rescheduled: true,
        originalDate: replacement.originalDate,
        originalStartTime: replacement.originalStartTime,
      });
    }
  }

  const inWindow = result.filter((occ) => {
    const occurrenceDate = parseDateUTC(occ.date);
    return occurrenceDate >= fromDate && occurrenceDate <= toDate;
  });

  // Sort by date then startTime
  inWindow.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.startTime < b.startTime ? -1 : 1;
  });

  return inWindow;
}

// ─── Status computation ───────────────────────────────────────────────────────

/**
 * Compute the live-event status based on upcoming / current occurrences.
 *
 * Returns:
 *   'live'     — current time falls within an occurrence window
 *   'upcoming' — at least one future occurrence exists
 *   'ended'    — no remaining occurrences
 *
 * @param {object} schedule  — LiveEventSchedule document
 * @param {Date}   [now]     — defaults to new Date()
 * @returns {'live' | 'upcoming' | 'ended'}
 */
export function computeLiveEventStatus(schedule, now = new Date()) {
  const todayStr = formatDateUTC(now);
  const todayDate = parseDateUTC(todayStr);

  // Check if we are currently inside any occurrence window
  const todayOccurrences = generateOccurrences(schedule, todayDate, todayDate);
  for (const occ of todayOccurrences) {
    const startTs = toUnixTimestamp(occ.date, occ.startTime) * 1000;
    const endTs = toUnixTimestamp(occ.date, occ.endTime) * 1000;
    if (now.getTime() >= startTs && now.getTime() < endTs) {
      return 'live';
    }
  }

  // Check for any future occurrence (rest of today or beyond)
  const farFuture = new Date(Date.UTC(9999, 11, 31));
  const future = generateOccurrences(schedule, todayDate, farFuture);
  // Filter strictly in the future (start time hasn't passed)
  const hasUpcoming = future.some(
    (occ) => toUnixTimestamp(occ.date, occ.startTime) * 1000 > now.getTime(),
  );

  return hasUpcoming ? 'upcoming' : 'ended';
}

/**
 * Find the next occurrence after `now`.
 * @param {object} schedule
 * @param {Date}   [now]
 * @returns {Occurrence | null}
 */
export function getNextOccurrence(schedule, now = new Date()) {
  const todayStr = formatDateUTC(now);
  const todayDate = parseDateUTC(todayStr);
  const farFuture = new Date(Date.UTC(9999, 11, 31));

  const all = generateOccurrences(schedule, todayDate, farFuture);
  const nowMs = now.getTime();

  return all.find((occ) => toUnixTimestamp(occ.date, occ.startTime) * 1000 > nowMs) ?? null;
}

/**
 * Find the current occurrence (where now falls within start–end).
 * @param {object} schedule
 * @param {Date}   [now]
 * @returns {Occurrence | null}
 */
export function getCurrentOccurrence(schedule, now = new Date()) {
  const todayStr = formatDateUTC(now);
  const todayDate = parseDateUTC(todayStr);

  const todayOccs = generateOccurrences(schedule, todayDate, todayDate);
  const nowMs = now.getTime();

  return (
    todayOccs.find((occ) => {
      const startMs = toUnixTimestamp(occ.date, occ.startTime) * 1000;
      const endMs = toUnixTimestamp(occ.date, occ.endTime) * 1000;
      return nowMs >= startMs && nowMs < endMs;
    }) ?? null
  );
}

// ─── Occurrence validation helpers ───────────────────────────────────────────

/**
 * Check whether a given date+startTime corresponds to a valid scheduled
 * occurrence for this schedule (before exception processing).
 *
 * Used to validate skip / reschedule targets.
 *
 * @param {object} schedule
 * @param {string} dateStr      "YYYY-MM-DD"
 * @param {string} startTime    "HH:MM"
 * @returns {boolean}
 */
export function isScheduledOccurrence(schedule, dateStr, startTime) {
  const d = parseDateUTC(dateStr);

  if (schedule.scheduleType === 'one-time') {
    return schedule.oneTimeDate === dateStr && schedule.oneTimeStartTime === startTime;
  }

  if (!schedule.recurrenceStartDate || !schedule.recurrenceEndDate) return false;

  const recStart = parseDateUTC(schedule.recurrenceStartDate);
  const recEnd = parseDateUTC(schedule.recurrenceEndDate);
  if (d < recStart || d > recEnd) return false;

  const dow = d.getUTCDay();
  return (schedule.slots ?? []).some(
    (slot) => slot.dayOfWeek === dow && slot.startTime === startTime,
  );
}

/**
 * Check whether an occurrence is currently skipped.
 * @param {object} schedule
 * @param {string} dateStr
 * @param {string} startTime
 * @returns {boolean}
 */
export function isSkipped(schedule, dateStr, startTime) {
  return (schedule.skippedOccurrences ?? []).some(
    (s) => s.date === dateStr && s.startTime === startTime,
  );
}

/**
 * Check whether an occurrence is currently rescheduled.
 * @param {object} schedule
 * @param {string} dateStr
 * @param {string} startTime
 * @returns {boolean}
 */
export function isRescheduled(schedule, dateStr, startTime) {
  return (schedule.rescheduledOccurrences ?? []).some(
    (r) => r.originalDate === dateStr && r.originalStartTime === startTime,
  );
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

/**
 * Return all occurrences that fall on a specific calendar date (UTC).
 * Used by the event calendar to list live-event sessions per day.
 *
 * @param {object} schedule
 * @param {string} dateStr  "YYYY-MM-DD"
 * @returns {Occurrence[]}
 */
export function getOccurrencesOnDate(schedule, dateStr) {
  const d = parseDateUTC(dateStr);
  return generateOccurrences(schedule, d, d);
}

/**
 * Return all occurrences between two dates (inclusive), both as "YYYY-MM-DD" strings.
 * @param {object} schedule
 * @param {string} fromDateStr
 * @param {string} toDateStr
 * @returns {Occurrence[]}
 */
export function getOccurrencesBetween(schedule, fromDateStr, toDateStr) {
  return generateOccurrences(schedule, parseDateUTC(fromDateStr), parseDateUTC(toDateStr));
}

// ─── Parse helpers for command input ─────────────────────────────────────────

/**
 * Parse a day-of-week string (name or number) to 0–6.
 * Accepts: "monday", "mon", "1", 1, etc.
 * Returns null if invalid.
 * @param {string|number} input
 * @returns {number|null}
 */
export function parseDayOfWeek(input) {
  const map = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  if (typeof input === 'number') {
    return input >= 0 && input <= 6 ? input : null;
  }

  const key = String(input).toLowerCase().trim();
  if (key in map) return map[key];

  const n = parseInt(key, 10);
  if (!Number.isNaN(n) && n >= 0 && n <= 6) return n;

  return null;
}

/**
 * Build a human-readable schedule summary string for use in embeds.
 * @param {object} schedule  — LiveEventSchedule document
 * @returns {string}
 */
export function formatScheduleSummary(schedule) {
  if (schedule.scheduleType === 'one-time') {
    const ts = discordTimestamp(schedule.oneTimeDate, schedule.oneTimeStartTime, 'F');
    const endTs = discordTimestamp(schedule.oneTimeDate, schedule.oneTimeEndTime, 't');
    return `One-time · ${ts} – ${endTs}`;
  }

  const slots = (schedule.slots ?? [])
    .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}–${s.endTime} UTC`)
    .join('\n');

  const recStart = discordTimestamp(schedule.recurrenceStartDate, '00:00', 'D');
  const recEnd = discordTimestamp(schedule.recurrenceEndDate, '00:00', 'D');

  return `Recurring · ${recStart} → ${recEnd}\n${slots}`;
}

// ─── Schedule input parsers (shared by create and edit) ───────────────────────

/**
 * Parse one-time date + time slot from modal input.
 * @param {string} datesRaw   "YYYY-MM-DD"
 * @param {string} slotsRaw   "HH:MM-HH:MM"
 * @returns {{ date: string, startTime: string, endTime: string } | { error: string }}
 */
export function parseOneTimeScheduleInput(datesRaw, slotsRaw) {
  const date = datesRaw.trim();
  if (!isValidDate(date)) {
    return { error: 'Invalid date. Use format `YYYY-MM-DD` (e.g. `2026-08-28`).' };
  }

  const slotMatch = slotsRaw.trim().match(/^(\d{2}:\d{2})[–-](\d{2}:\d{2})$/);
  if (!slotMatch) {
    return { error: 'Invalid time slot. Use format `HH:MM-HH:MM` (e.g. `18:00-19:00`).' };
  }

  const [, startTime, endTime] = slotMatch;
  if (!isValidTime(startTime)) return { error: `Invalid start time: \`${startTime}\`.` };
  if (!isValidTime(endTime)) return { error: `Invalid end time: \`${endTime}\`.` };
  if (startTime >= endTime) return { error: 'Start time must be before end time.' };

  return { date, startTime, endTime };
}

/**
 * Parse recurring date range + time slots from modal input.
 * @param {string} datesRaw   "YYYY-MM-DD to YYYY-MM-DD"
 * @param {string} slotsRaw   newline-separated "DayName HH:MM-HH:MM"
 * @returns {{ recurrenceStartDate: string, recurrenceEndDate: string,
 *   slots: object[] } | { error: string }}
 */
export function parseRecurringScheduleInput(datesRaw, slotsRaw) {
  const dateMatch = datesRaw
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})\s+(?:to|[-–])\s+(\d{4}-\d{2}-\d{2})$/i);
  if (!dateMatch) {
    return {
      error:
        'Invalid recurrence range. Use `YYYY-MM-DD to YYYY-MM-DD` (e.g. `2026-08-01 to 2026-12-31`).',
    };
  }

  const [, recurrenceStartDate, recurrenceEndDate] = dateMatch;

  if (!isValidDate(recurrenceStartDate)) {
    return { error: `Invalid recurrence start date: \`${recurrenceStartDate}\`.` };
  }
  if (!isValidDate(recurrenceEndDate)) {
    return { error: `Invalid recurrence end date: \`${recurrenceEndDate}\`.` };
  }
  if (recurrenceEndDate <= recurrenceStartDate) {
    return { error: 'Recurrence end date must be after recurrence start date.' };
  }

  const lines = slotsRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { error: 'Recurring events must have at least one schedule slot.' };
  }

  const slots = [];
  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/);
    if (!match) {
      return {
        error:
          `Invalid slot format: \`${line}\`. Use \`DayName HH:MM-HH:MM\` ` +
          '(e.g. `Tuesday 18:00-19:00`).',
      };
    }

    const [, dayStr, startTime, endTime] = match;
    const dayOfWeek = parseDayOfWeek(dayStr);
    if (dayOfWeek === null) {
      return {
        error: `Unrecognised day: \`${dayStr}\`. Use a day name like \`Tuesday\` or \`Sat\`.`,
      };
    }
    if (!isValidTime(startTime)) return { error: `Invalid start time: \`${startTime}\`.` };
    if (!isValidTime(endTime)) return { error: `Invalid end time: \`${endTime}\`.` };
    if (startTime >= endTime) {
      return { error: `Start time must be before end time for slot: \`${line}\`.` };
    }

    slots.push({ dayOfWeek, startTime, endTime });
  }

  return { recurrenceStartDate, recurrenceEndDate, slots };
}
