import Availability from '../models/Availability.js';
import Booking from '../models/Booking.js';
import Option from '../models/Option.js';

/**
 * Everything in the user's calendar that can hold a date, in one list.
 *
 * The three collections are separate because they mean different things to the
 * actor - a booking is work, an option is a period somebody is holding, an
 * availability entry is the actor's own note about a week off. To a casting
 * platform they mean one thing: the date is taken. So they converge here, and
 * `blockedPeriods.js` reduces the merged list to block times before any
 * connector sees it.
 *
 * Before this, only Availability was ever synced, which meant a confirmed
 * booking in the manager blocked nothing anywhere - the one thing the calendar
 * sync exists to prevent.
 *
 * `.lean()` is safe here: none of these three carry encrypted fields. Platform
 * does, and is read through the model for exactly that reason.
 */
export const loadCalendarEntries = async (userId) => {
  const [availability, bookings, options] = await Promise.all([
    Availability.find({ user: userId }).lean(),
    Booking.find({ user: userId }).lean(),
    Option.find({ user: userId }).lean()
  ]);

  return [...availability, ...bookings, ...options];
};

export default { loadCalendarEntries };
