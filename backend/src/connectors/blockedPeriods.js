/**
 * What a platform is allowed to learn about the calendar.
 *
 * The rule, and it is the whole point of this file: **only block times are
 * shared**. A platform learns that a period is not bookable and nothing else -
 * not why, not for whom, not whether it is a booking, an option or a holiday,
 * and not what the actor wrote in their notes.
 *
 * That is not a formatting preference. The Availability model carries `reason`
 * and `notes` in the actor's own words, and `type` distinguishes a firm
 * booking from a tentative option. Handing any of that to a casting platform
 * tells it who else is hiring this actor and how firmly - information the actor
 * kept in their own calendar, not on someone's casting site. Every connector
 * therefore receives block times from here and never the raw entries.
 *
 * Merging is part of the rule, not a tidy-up. Five separate blocks in one month
 * say "five separate jobs"; one merged block says "not available". The merged
 * form is the one that answers the only question a platform needs answered.
 */

/**
 * Which availability states count as blocked.
 *
 * `unavailable` is obvious. `partially_available` is here because the calendar
 * exists to stop double bookings: a day the actor cannot freely take is not a
 * day to advertise as free. It costs a little availability and prevents the
 * failure the block time is for. Change this and the meaning of every sync
 * changes with it, so it is one named list rather than a condition spread
 * across the connectors.
 */
export const BLOCKING_TYPES = Object.freeze(['unavailable', 'partially_available']);

/**
 * The booking and option states that do *not* block a date.
 *
 * A booking or an option blocks by existing - that is what it is. What does not
 * block is one that was called off: a cancelled booking, an option that was
 * declined or that has run out. Everything else, `pending` included, holds the
 * date. A pending option is precisely the period somebody is holding open, and
 * advertising it as free is the double booking this calendar exists to prevent.
 */
export const NON_BLOCKING_STATUSES = Object.freeze(['cancelled', 'declined', 'expired']);

/**
 * Does this calendar entry hold a date, whatever kind of entry it is?
 *
 * The three collections converge here: an Availability entry says whether it
 * blocks with its `type`, a Booking or an Option with its `status`, and only
 * Availability has a `type` at all - which is what tells them apart. Every
 * caller can therefore hand over the whole calendar in one list and let this
 * file decide, rather than each one reimplementing "which of these count".
 */
export const blocksCalendar = (entry) => {
  if (!entry) return false;
  if (entry.type !== undefined) return BLOCKING_TYPES.includes(entry.type);

  return !NON_BLOCKING_STATUSES.includes(entry.status);
};

/** A day in milliseconds - the gap below which two blocks are treated as one. */
const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Combine a date with an optional "HH:MM" time.
 * Without a time, a start is the beginning of its day and an end is the end of
 * it - a block that says 5.-7. means those days whole, not until midnight of
 * the 5th.
 */
const at = (date, time, edge) => {
  const base = date instanceof Date ? new Date(date) : new Date(String(date));
  if (Number.isNaN(base.getTime())) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  if (match) {
    base.setHours(Number(match[1]), Number(match[2]), 0, 0);

    return base;
  }

  if (edge === 'end') base.setHours(23, 59, 59, 999);
  else base.setHours(0, 0, 0, 0);

  return base;
};

/**
 * Reduce the app's availability entries to the block times a platform may see.
 *
 * @param {Array} entries - Availability, Booking and Option documents in
 *   one list (or plain objects of the same shape).
 * @param {{ now?: Date }} options
 * @returns {Array<{start: Date, end: Date}>} merged, sorted, nothing else on
 *   them. The absence of any other field is deliberate: a connector cannot leak
 *   what it was never handed.
 */
export const toBlockedPeriods = (entries, { now = new Date() } = {}) => {
  const periods = [];

  for (const entry of entries || []) {
    if (!blocksCalendar(entry)) continue;

    const start = at(entry.startDate, entry.startTime, 'start');
    const end = at(entry.endDate || entry.startDate, entry.endTime, 'end');
    if (!start || !end || end < start) continue;

    // A period that is entirely over tells a platform where this actor has
    // been, which is history, not availability.
    if (end < now) continue;

    periods.push({ start, end });
  }

  periods.sort((a, b) => a.start - b.start);

  const merged = [];
  for (const period of periods) {
    const last = merged[merged.length - 1];
    // Overlapping, touching, or separated by less than a day: one block. The
    // gap between "until Friday evening" and "from Saturday morning" is not
    // availability anybody can book.
    if (last && period.start - last.end <= ONE_DAY) {
      if (period.end > last.end) last.end = period.end;
      continue;
    }
    merged.push({ start: period.start, end: period.end });
  }

  return merged;
};

/**
 * The same block times in the shape the existing connectors' form fillers
 * expect - `startDate`/`endDate` and nothing else.
 *
 * `fillAvailabilityForm` in the platform connectors reads `item.notes` and
 * `item.status` when they are there. They are not there. The fields stay in
 * those connectors because a platform may one day have a legitimate use for a
 * status; what changes is that nothing reaches them to write.
 */
export const toBlockedFormItems = (entries, options) => toBlockedPeriods(entries, options).map(({ start, end }) => ({
  startDate: start,
  endDate: end
}));

export default {
  BLOCKING_TYPES, NON_BLOCKING_STATUSES, blocksCalendar, toBlockedPeriods, toBlockedFormItems
};
