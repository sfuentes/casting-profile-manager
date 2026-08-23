/**
 * Selector helpers shared by the browser-driven connectors.
 *
 * These exist because six selectors in this codebase used `button:contains("Add")`.
 * That is jQuery syntax, not CSS: `querySelectorAll` throws `SyntaxError` on it,
 * so the whole selector string was rejected and the valid alternatives listed
 * beside it never got a chance. The availability paths of Filmmakers,
 * CastingNetwork, JobWork and Wanted failed on every run regardless of what the
 * sites actually looked like.
 *
 * Matching a button by its label is still the right idea - these are unknown
 * third-party pages and the label is often the only stable handle. It just has
 * to happen in JavaScript rather than in the selector string.
 */

/** Elements that plausibly act as a button when no id or data attribute exists. */
export const CLICKABLE = 'button, a, input[type="submit"], input[type="button"], [role="button"]';

const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * First element matching any of the given CSS selectors.
 * Selectors are tried in order, so put the specific ones first.
 */
export const findFirst = async (page, selectors) => {
  // Sequential on purpose: selectors are ordered by preference, so the first
  // match must win. Running them in parallel would return whichever resolved
  // fastest.
  /* eslint-disable no-restricted-syntax, no-await-in-loop */
  for (const selector of selectors) {
    const handle = await page.$(selector).catch(() => null);
    if (handle) return handle;
  }
  /* eslint-enable no-restricted-syntax, no-await-in-loop */

  return null;
};

/**
 * Find a clickable element whose visible label contains one of `texts`.
 *
 * Checks textContent, `value` (submit inputs carry their label there), aria-label
 * and title, and ignores elements that are hidden or disabled - a match the user
 * could not click is not a match.
 *
 * @returns {Promise<import('puppeteer').ElementHandle|null>}
 */
export const findByText = async (page, texts, { selector = CLICKABLE, timeout = 5000 } = {}) => {
  const wanted = texts.map(normalise).filter(Boolean);
  if (wanted.length === 0) return null;

  const deadline = Date.now() + timeout;
  // Polling loop: each pass has to observe the result of the previous one, so
  // the awaits are sequential by necessity.
  /* eslint-disable no-await-in-loop */
  do {
    const handle = await page
      .evaluateHandle(
        (sel, labels) => {
          const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
          // eslint-disable-next-line no-undef -- runs in the page, not in Node
          const nodes = Array.from(document.querySelectorAll(sel));

          return (
            nodes.find((el) => {
              if (el.disabled) return false;
              const box = el.getBoundingClientRect();
              if (box.width === 0 && box.height === 0) return false;
              const text = [el.textContent, el.value, el.getAttribute('aria-label'), el.title]
                .map(norm)
                .filter(Boolean);

              return labels.some((label) => text.some((t) => t.includes(label)));
            }) || null
          );
        },
        selector,
        wanted
      )
      .catch(() => null);

    const element = handle?.asElement?.();
    if (element) return element;
    await handle?.dispose?.();

    if (Date.now() >= deadline) break;
    await new Promise((resolve) => { setTimeout(resolve, 200); });
  } while (Date.now() < deadline);
  /* eslint-enable no-await-in-loop */

  return null;
};

/**
 * Prefer a structural selector, fall back to the label.
 *
 * A `data-action` attribute or a stable class survives a redesign far better
 * than German button copy, so those are tried first; the text match is the
 * safety net, not the primary route.
 */
export const findByCssOrText = async (page, {
  css = [], texts = [], selector = CLICKABLE, timeout = 5000
} = {}) => {
  const structural = await findFirst(page, css);
  if (structural) return structural;

  return findByText(page, texts, { selector, timeout });
};

/**
 * Click whatever `findByCssOrText` resolves to.
 * @returns {Promise<boolean>} whether anything was clicked
 */
export const clickByCssOrText = async (page, options) => {
  const element = await findByCssOrText(page, options);
  if (!element) return false;
  await element.click();
  await element.dispose().catch(() => {});

  return true;
};
