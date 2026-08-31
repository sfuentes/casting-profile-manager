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
 * How far apart two strings are, counted in single-character edits, and given
 * up on past `cap`.
 *
 * Used only to notice that two spellings might be the same word - "Jefferey"
 * against "Jeffrey" - never to decide that they are. The decision is the
 * user's.
 */
export const editDistance = (a, b, cap = 3) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > cap) return cap + 1;
    previous = row;
  }
  return previous[b.length];
};

/**
 * Credits that might be the same as this one, without being sure enough to say
 * so.
 *
 * These are the cases the two real accounts actually produced, and each is a
 * reason to ask rather than decide:
 *
 *   Jefferey Bernard fühlt sich nicht   vs  Jeffrey Bernard fühlt sich nicht
 *   Berlin Tag und Nacht - 2985         vs  Berlin Tag und Nacht
 *   ... als Bösewicht, Jochen Bauer     vs  ... als Jochen Bach
 *
 * The first looks like a typo. The second may be one episode against the whole
 * series - or two different jobs, and merging them would delete one from
 * someone's CV without saying so. The third is the same person billed two ways,
 * or two different parts. Nothing here can tell which, so nothing here decides.
 */
export const nearMatches = (entry, theirs = []) => {
  const mine = identityOf(entry);
  if (!mine.production) return [];

  const out = [];

  theirs.forEach((other, index) => {
    const theirId = identityOf(other);
    if (!theirId.production) return;
    if (isSameCredit(entry, other)) return;

    const sameProduction = mine.production === theirId.production;
    const oneContainsTheOther = !sameProduction
      && (mine.production.startsWith(theirId.production)
        || theirId.production.startsWith(mine.production));
    const nearlySpelled = !sameProduction && !oneContainsTheOther
      && editDistance(mine.production, theirId.production, 2) <= 2;

    if (!sameProduction && !oneContainsTheOther && !nearlySpelled) return;

    // A year both sides record and disagree on means different credits, not an
    // uncertain one - that is the one thing here that is decidable.
    if (mine.year && theirId.year && mine.year !== theirId.year) return;

    const reason = sameProduction
      ? 'same production, different role'
      : (oneContainsTheOther ? 'one title is part of the other' : 'the titles are spelled almost the same');

    out.push({ index, entry: other, reason });
  });

  return out;
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
    // A list is either plain credits or credits with the platform they came
    // from: [{ platform, platformName, credits }]. Both are accepted, because
    // knowing the origin is worth recording but not worth forcing on callers
    // that only want the union.
    const credits = Array.isArray(list) ? list : (list?.credits || []);
    const label = Array.isArray(list) ? null : {
      platform: list?.platform, platformName: list?.platformName
    };

    for (const entry of credits) {
      if (!productionOf(entry)) continue;
      const existing = merged.find((kept) => isSameCredit(kept, entry));
      if (!existing) {
        merged.push({ ...entry, ...(label?.platform ? { platforms: [label.platform] } : {}) });
        continue;
      }
      // The same credit on a second platform: both are remembered, so a merged
      // list can still say who has it and who is missing it.
      if (label?.platform && !existing.platforms?.includes(label.platform)) {
        existing.platforms = [...(existing.platforms || []), label.platform];
      }
      for (const [key, value] of Object.entries(entry)) {
        if (key === 'platforms') continue;
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


/** The answer that means "this really is a credit of its own - add it". */
export const ADD_AS_NEW = '__add__';

/**
 * The full answer for one platform: what to add, what it already has, and what
 * nobody can decide without the user.
 *
 * A credit with a plausible near match is taken out of `missing` and put into
 * `questions` instead. That is the whole point: pushing it might duplicate a
 * credit onto a public profile, and dropping it might lose a job from a CV, so
 * it is neither pushed nor dropped until someone says which.
 *
 * @returns {{missing, shared, theirsOnly, questions}}
 *   `missing` is safe to add on its own. `questions` each carry the credit, the
 *   candidates it might be, and the values an answer may take.
 */
export const reconcileWorkHistory = (ours = [], theirs = [], labels = {}) => {
  const { missing, shared, theirsOnly } = diffWorkHistory(ours, theirs);

  const certain = [];
  const questions = [];

  for (const entry of missing) {
    const candidates = nearMatches(entry, theirs);
    if (candidates.length === 0) {
      certain.push(entry);
      continue;
    }

    const index = ours.indexOf(entry);
    questions.push({
      path: `workHistory.${index === -1 ? questions.length : index}`,
      credit: describe(entry),
      // Both sides are named. A question that shows two spellings without
      // saying which site each is on cannot be answered: the answer depends on
      // knowing that one of them is what this platform already publishes.
      // A credit that came from a merge already knows which platforms carried
      // it, so it can name itself without being told.
      from: labels.ourName || labels.ourPlatform
        || (entry.platforms?.length ? entry.platforms.join(', ') : null),
      onPlatform: labels.theirName || labels.theirPlatform || null,
      entry,
      options: [
        ...candidates.map((candidate) => ({
          value: `same:${candidate.index}`,
          label: describe(candidate.entry),
          onPlatform: labels.theirName || labels.theirPlatform || null,
          reason: candidate.reason
        })),
        { value: ADD_AS_NEW, label: 'Als eigenen Eintrag hinzufügen' }
      ]
    });
  }

  return { missing: certain, shared, theirsOnly, questions };
};

/**
 * Turn the user's answers into the credits to add.
 *
 * Only an answer that was offered counts, and no answer means no action - the
 * same contract the import dialog already uses for unmapped values. A question
 * left alone therefore adds nothing, which is the safe direction: the credit
 * stays where it is and can be asked about again next time.
 */
export const applyCreditResolutions = (questions = [], answers = {}) => {
  const add = [];
  const treatedAsSame = [];

  for (const question of questions) {
    const answer = answers[question.path];
    if (!answer) continue;
    if (!question.options.some((option) => option.value === answer)) continue;

    if (answer === ADD_AS_NEW) add.push(question.entry);
    else treatedAsSame.push({ path: question.path, answer });
  }

  return { add, treatedAsSame };
};

export default {
  canonical, identityOf, isSameCredit, diffWorkHistory, mergeWorkHistory, describe,
  nearMatches, reconcileWorkHistory, applyCreditResolutions, ADD_AS_NEW
};
