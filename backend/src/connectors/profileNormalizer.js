/**
 * Normalise imported profile data into this app's own vocabulary.
 *
 * Connectors return what the platform says: "dunkelbraun", "fliessend",
 * "1980-07-12T00:00:00.000Z", "178 cm". The profile stores its own values, and
 * the profile form renders them directly - so an unnormalised import lands in
 * the database looking correct while showing up blank or wrong in the UI.
 *
 * Two rules:
 *
 *   1. Anything that can be mapped mechanically is mapped here, once, for every
 *      platform. A connector's job is to read the page, not to know what this
 *      app calls things.
 *   2. Anything that cannot be mapped is never guessed. It is returned as an
 *      open question with the allowed values, and the user decides. Quietly
 *      substituting "braun" for an eye colour we did not recognise would be
 *      the same class of bug as a connector reporting a sync it never did.
 */

/** The values this app uses. Anything outside these lists needs a decision. */
export const VOCABULARY = Object.freeze({
  gender: ['male', 'female', 'diverse', 'not_specified'],
  eyeColor: ['blau', 'braun', 'grün', 'grau', 'grau-blau', 'grün-braun', 'bernstein', 'schwarz'],
  hairColor: ['blond', 'dunkelblond', 'hellbraun', 'braun', 'dunkelbraun', 'schwarz', 'rot', 'grau', 'weiß', 'gefärbt'],
  languageLevel: ['Muttersprache', 'Verhandlungssicher', 'Fließend', 'Gute Kenntnisse', 'Grundkenntnisse'],
  workType: ['tv', 'film', 'theater', 'commercial', 'other']
});

/** Platform spellings that mean one of our values. Lower-cased on both sides. */
const SYNONYMS = Object.freeze({
  eyeColor: {
    'blau-grau': 'grau-blau',
    blaugrau: 'grau-blau',
    'blau-grün': 'grün',
    hellbraun: 'braun',
    dunkelbraun: 'braun',
    haselnuss: 'bernstein',
    hazel: 'bernstein',
    blue: 'blau',
    brown: 'braun',
    green: 'grün',
    grey: 'grau',
    gray: 'grau',
    black: 'schwarz'
  },
  hairColor: {
    'dunkel-blond': 'dunkelblond',
    'hell-braun': 'hellbraun',
    'dunkel-braun': 'dunkelbraun',
    brünett: 'dunkelbraun',
    blonde: 'blond',
    brown: 'braun',
    black: 'schwarz',
    red: 'rot',
    grey: 'grau',
    gray: 'grau',
    white: 'weiß',
    dyed: 'gefärbt'
  },
  languageLevel: {
    muttersprache: 'Muttersprache',
    'native speaker': 'Muttersprache',
    native: 'Muttersprache',
    fliessend: 'Fließend',
    fließend: 'Fließend',
    fluent: 'Fließend',
    verhandlungssicher: 'Verhandlungssicher',
    'business fluent': 'Verhandlungssicher',
    'gute kenntnisse': 'Gute Kenntnisse',
    gut: 'Gute Kenntnisse',
    good: 'Gute Kenntnisse',
    grundkenntnisse: 'Grundkenntnisse',
    basic: 'Grundkenntnisse',
    'basic knowledge': 'Grundkenntnisse',
    schulkenntnisse: 'Grundkenntnisse'
  }
});

const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/**
 * Match a value against a vocabulary, case-insensitively and through the
 * synonym table.
 * @returns {string|null} the app's value, or null when it is not recognised
 */
const toVocabulary = (field, value) => {
  const text = clean(value);
  if (!text) return null;

  const allowed = VOCABULARY[field] || [];
  const lower = text.toLowerCase();

  const direct = allowed.find((option) => option.toLowerCase() === lower);
  if (direct) return direct;

  const synonym = (SYNONYMS[field] || {})[lower];
  if (synonym) return synonym;

  return null;
};

/**
 * A date as the YYYY-MM-DD the profile form's date input needs.
 *
 * Deliberately not `new Date(value)`: V8's parser accepts almost anything and
 * invents the missing parts, so `new Date('irgendwann 1980')` returns the 1st
 * of January 1980 rather than failing. An import that silently invents a
 * birthday is worse than one that asks. Only shapes that actually are dates are
 * accepted, and the conversion is textual so no timezone can shift the day.
 */
const toDateOnly = (value) => {
  if (!value) return null;

  const inRange = (year, month, day) => Number(month) >= 1 && Number(month) <= 12
    && Number(day) >= 1 && Number(day) <= 31 && Number(year) >= 1900;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/);
  if (iso && inRange(iso[1], iso[2], iso[3])) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // German and slash-separated day-first formats: 12.07.1980, 12/07/1980
  const dayFirst = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dayFirst && inRange(dayFirst[3], dayFirst[2], dayFirst[1])) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  }

  return null;
};

/** "178 cm", "1,78 m", 178 -> "178". Centimetres, as the form expects. */
const toCentimetres = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(',', '.');

  const metres = text.match(/^(\d(?:\.\d+)?)\s*m\b/i);
  if (metres) return String(Math.round(parseFloat(metres[1]) * 100));

  const digits = text.match(/\d+/);
  return digits ? digits[0] : null;
};

/** "70 kg", 70 -> "70". */
const toKilograms = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).match(/\d+/);
  return digits ? digits[0] : null;
};

/**
 * Normalise one import.
 *
 * @param {object} fields  what the connector read, in this app's field names
 * @returns {{fields: object, unmapped: Array<{path, field, value, options}>}}
 *   `unmapped` is the list of values that need the user: each carries the raw
 *   value and the values it could become.
 */
export const normalizeProfileFields = (fields = {}) => {
  const out = { ...fields };
  const unmapped = [];

  const ask = (path, field, value) => {
    unmapped.push({ path, field, value, options: VOCABULARY[field] || [] });
  };

  // ---- plain text: trim only ----
  for (const key of ['name', 'firstName', 'lastName', 'location', 'citizenship', 'biography', 'actingAge']) {
    if (out[key] !== undefined) out[key] = clean(out[key]);
  }

  // ---- measurements ----
  if (out.height !== undefined) out.height = toCentimetres(out.height);
  if (out.weight !== undefined) out.weight = toKilograms(out.weight);

  // ---- date of birth: the form uses <input type="date">, which shows nothing
  //      at all for a full ISO timestamp ----
  if (out.dateOfBirth !== undefined) {
    const date = toDateOnly(out.dateOfBirth);
    if (date) out.dateOfBirth = date;
    else {
      delete out.dateOfBirth;
      unmapped.push({ path: 'dateOfBirth', field: 'dateOfBirth', value: fields.dateOfBirth, options: [] });
    }
  }

  // ---- enumerated values ----
  if (out.gender !== undefined) {
    const gender = VOCABULARY.gender.includes(out.gender) ? out.gender : toVocabulary('gender', out.gender);
    if (gender) out.gender = gender;
    else {
      delete out.gender;
      ask('gender', 'gender', fields.gender);
    }
  }

  for (const key of ['eyeColor', 'hairColor']) {
    if (out[key] === undefined) continue;
    const value = toVocabulary(key, out[key]);
    if (value) out[key] = value;
    else {
      delete out[key];
      ask(key, key, fields[key]);
    }
  }

  // ---- languages: the name is free text, the level is not ----
  if (Array.isArray(out.languages)) {
    out.languages = out.languages.map((entry, index) => {
      const language = clean(entry.language);
      const level = toVocabulary('languageLevel', entry.level);
      if (!level && entry.level) {
        unmapped.push({
          path: `languages.${index}.level`,
          field: 'languageLevel',
          value: entry.level,
          options: VOCABULARY.languageLevel,
          context: language
        });
      }
      return { language, level: level || '' };
    }).filter((entry) => entry.language);
  }

  // ---- skills: trim, drop blanks, drop duplicates ----
  for (const key of ['skills', 'specialSkills']) {
    if (!Array.isArray(out[key])) continue;
    out[key] = [...new Set(out[key].map(clean).filter(Boolean))];
  }

  // ---- work history: the type is an enum the schema enforces ----
  if (Array.isArray(out.workHistory)) {
    out.workHistory = out.workHistory.map((entry) => ({
      ...entry,
      title: clean(entry.title),
      production: clean(entry.production),
      description: clean(entry.description),
      year: clean(entry.year),
      type: VOCABULARY.workType.includes(entry.type) ? entry.type : 'other'
    }));
  }

  if (Array.isArray(out.education)) {
    out.education = out.education.map((entry) => ({
      ...entry,
      institution: clean(entry.institution),
      degree: clean(entry.degree),
      description: clean(entry.description),
      startYear: clean(entry.startYear),
      endYear: clean(entry.endYear)
    }));
  }

  // Drop anything that normalised to nothing, so an empty value never
  // overwrites something the user typed.
  for (const [key, value] of Object.entries(out)) {
    const empty = value === null || value === undefined || value === ''
      || (Array.isArray(value) && value.length === 0);
    if (empty) delete out[key];
  }

  return { fields: out, unmapped };
};

/**
 * Apply the user's answers to the open questions.
 *
 * A resolution is either one of the offered values or the literal string
 * `__keep__` (store the platform's own wording) - anything else is ignored
 * rather than trusted, since this arrives from the client.
 */
export const applyResolutions = (fields, unmapped, resolutions = {}) => {
  const out = { ...fields };

  for (const question of unmapped) {
    const answer = resolutions[question.path];
    if (!answer) continue;

    const value = answer === '__keep__' ? question.value : answer;
    const allowed = answer === '__keep__'
      || question.options.length === 0
      || question.options.includes(answer);
    if (!allowed) continue;

    const languageLevel = question.path.match(/^languages\.(\d+)\.level$/);
    if (languageLevel) {
      const index = Number(languageLevel[1]);
      if (Array.isArray(out.languages) && out.languages[index]) {
        out.languages[index] = { ...out.languages[index], level: value };
      }
      continue;
    }

    out[question.path] = value;
  }

  return out;
};
