#!/usr/bin/env node
/**
 * Find a platform's real login page, without an account.
 *
 * Filmmakers' connector pointed at /login, which answers 404 - the form was at
 * /users/sign_in all along, and nobody could have known without loading the
 * page. This does that one check for any platform: load the public homepage,
 * follow whatever it calls "login", and report what the form there is made of.
 *
 * Public pages only. Nothing is submitted and no credentials are involved.
 *
 *   node scripts/recon-login.mjs https://www.jobwork.de [more urls...]
 */
import puppeteer from 'puppeteer';

const CANDIDATE_PATHS = [
  '/login', '/users/sign_in', '/sign_in', '/signin', '/anmelden', '/account/login',
  '/user/login', '/session/new', '/auth/login', '/de/login'
];

const inspect = async (page) => {
  const forms = await page.$$eval('form', (els) => els
    .filter((form) => form.querySelector('input[type="password"]'))
    .map((form) => ({
      action: form.getAttribute('action'),
      method: form.getAttribute('method'),
      fields: [...form.querySelectorAll('input, button, select')]
        .filter((el) => el.getAttribute('type') !== 'hidden')
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          name: el.getAttribute('name'),
          id: el.getAttribute('id')
        }))
    })));
  return forms;
};

const run = async (baseUrl) => {
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`\n================ ${baseUrl} ================`);

    let home;
    try {
      home = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (error) {
      console.log('  homepage unreachable:', error.message.slice(0, 90));
      return;
    }
    console.log(`  home: ${home?.status()} ${page.url()} | ${await page.title()}`);

    const links = await page.$$eval('a[href]', (els) => [...new Set(els
      .map((a) => `${a.getAttribute('href')}|${(a.innerText || '').trim().slice(0, 24)}`)
      .filter((l) => /login|sign_?in|anmeld|account|konto|mitglied/i.test(l)))]).catch(() => []);
    console.log('  login-ish links:', links.slice(0, 8));

    const fromLinks = links
      .map((l) => l.split('|')[0])
      .filter((href) => /login|sign_?in|anmeld/i.test(href))
      .map((href) => (href.startsWith('http') ? href : new URL(href, baseUrl).href));

    const seen = new Set();
    for (const url of [...fromLinks, ...CANDIDATE_PATHS.map((p) => new URL(p, baseUrl).href)]) {
      if (seen.has(url)) continue;
      seen.add(url);

      let response;
      try {
        response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (error) {
        console.log(`  ${url} -> FAILED ${error.message.slice(0, 50)}`);
        continue;
      }

      // Several of these logins are single-page apps: the form is not in the
      // delivered HTML and only appears once the bundle has run. Concluding
      // "no login form here" from the initial DOM would be wrong.
      await page.waitForSelector('input[type="password"]', { timeout: 8000 }).catch(() => {});

      const status = response?.status();
      const passwords = await page.$$eval('input[type="password"]', (e) => e.length).catch(() => 0);
      if (status !== 200 || passwords === 0) {
        console.log(`  ${url} -> ${status}, ${passwords} password field(s)`);
        continue;
      }

      console.log(`\n  >>> LOGIN FORM: ${page.url()} (${status}) | ${await page.title()}`);
      for (const form of await inspect(page)) {
        console.log(`      action=${form.action} method=${form.method}`);
        for (const field of form.fields) console.log('       ', JSON.stringify(field));
      }
      break;
    }
  } finally {
    await browser.close();
  }
};

for (const url of process.argv.slice(2)) {
  // eslint-disable-next-line no-await-in-loop
  await run(url);
}
