/**
 * Reconciling credits across platforms.
 *
 * Every platform keeps the same career in its own words: Filmmakers reads it
 * out of a vita list, JobWork out of a GraphQL repeater, and both call the
 * columns something different. This module answers one question and does it in
 * one place, so that the answer is the same wherever it is asked: given what we
 * hold and what a platform holds, which credits does that platform not have?
 *
 * The hard part is deciding when two entries are the same credit. It has to be
 * strict, because the failure modes are not symmetric: treating two credits as
 * one loses a job from someone's CV quietly, and treating one credit as two
 * writes a duplicate onto a public profile that the actor then has to go and
 * delete by hand. Both are bad, and duplicates are the one people see.
 *
 * This account has the case that decides it - "GZSZ" appears twice in the same
 * year with two different roles ("Komparse - Besucher" and "Kinobesitzer").
 * Those are two jobs. Production alone cannot be the identity; role has to be
 * part of it.
 */

/**
 * A value reduced to what can be compared across platforms.
 *
 * Case, punctuation and spacing differ freely between sites that were typed
 * into by hand at different times - "GZSZ - Das Maß ist Voll" and
 * "GZSZ – Das Maß ist voll" are the same credit typed twice. Accents are kept:
 * "Dünentod" and "Dunentod" being folded together would be a guess, and German
 * titles carry those letters deliberately.
 */
export const canonical = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[\u2010-\u2015]/g, '-')      // the dash family, all spelled '-'
  .replace(/[^\p{L}\p{N}]+/gu, ' ')      // punctuation is noise, letters are not
  .trim()
  .replace(/\s+/g, ' ');

/** The production a credit is for, whichever field the platform put it in. */
export const productionOf = (entry) => entry?.production || entry?.title || '';

/** The first year of a credit, from a year, a range, or a date. */
export const yearOf = (entry) => {
  const raw = String(entry?.year ?? entry?.startYear ?? '');
  return (raw.match(/\d{4}/) || [''])[0];
};

/**
 * The identity of a credit.
 *
 * Production and role together, plus the year when both sides have one. A
 * platform that does not record the year still matches - dropping the year from
 * the key when either side lacks it is what lets a Filmmakers entry recognise
 * itself in a JobWork entry - but two credits that differ in year are never
 * merged.
 */
export const identityOf = (entry) => ({
  production: canonical(productionOf(entry)),
  role: canonical(entry?.role),
  year: yearOf(entry)
});

/** Whether two entries are the same credit. */
export const isSameCredit = (a, b) => {
  const x = identityOf(a);
  const y = identityOf(b);
  if (!x.production || !y.production) return false;
  if (x.production !== y.production) return false;
  // A role on both sides must agree. A role on one side only is not evidence of
  // a different credit: Filmmakers prints the role inside a block of prose and
  // some entries do not name one at all, while JobWork always has a field for
  // it. Requiring equality there made every credit look missing on both
  // platforms at once - the first real run matched none of 23 against 10.
  if (x.role && y.role && x.role !== y.role) return false;
  // A year on both sides must agree. A year on one side only is not evidence
  // of a different credit, and refusing to match on it would write a duplicate.
  if (x.year && y.year && x.year !== y.year) return false;
  return true;
};

/**
 * What `theirs` is missing from `ours`.
 *
 * @returns {{missing: Array, shared: Array, theirsOnly: Array}}
 *   `missing` is what would be added to the platform, `theirsOnly` is what the
 *   platform has and we do not - which is an import, not a push, and is
 *   reported rather than acted on here.
 */
export const diffWorkHistory = (ours = [], theirs = []) => {
  const missing = [];
  const shared = [];
  const matched = new Set();

  for (const entry of ours) {
    if (!productionOf(entry)) continue;
    const index = theirs.findIndex((other, i) => !matched.has(i) && isSameCredit(entry, other));
    if (index === -1) missing.push(entry);
    else { matched.add(index); shared.push(entry); }
  }

  const theirsOnly = theirs.filter((_, i) => !matched.has(i));
  return { missing, shared, theirsOnly };
};

/**
 * One list of credits out of several platforms' lists.
 *
 * Later lists fill gaps in earlier ones rather than replacing them: the first
 * platform to carry a field wins, so a Filmmakers entry that names the director
 * keeps that name when the same credit arrives from a platform that has no
 * field for it. Nothing is invented and nothing is dropped.
 */
export const mergeWorkHistory = (lists = []) => {
  const merged = [];

  for (const list of lists) {
    for (const entry of list || []) {
      if (!productionOf(entry)) continue;
      const existing = merged.find((kept) => isSameCredit(kept, entry));
      if (!existing) {
        merged.push({ ...entry });
        continue;
      }
      for (const [key, value] of Object.entries(entry)) {
        const empty = existing[key] === undefined || existing[key] === null
          || existing[key] === '' || existing[key] === '-';
        if (empty && value !== undefined && value !== null && value !== '' && value !== '-') {
          existing[key] = value;
        }
      }
    }
  }

  return merged;
};

/** A credit in one line, for a dry run's report. */
export const describe = (entry) => [
  yearOf(entry),
  productionOf(entry),
  entry?.role && `als ${entry.role}`,
  entry?.company && entry.company !== '-' && `(${entry.company})`
].filter(Boolean).join(' ');

export default { canonical, identityOf, isSameCredit, diffWorkHistory, mergeWorkHistory, describe };
