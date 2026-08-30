#!/usr/bin/env node
/**
 * Look at a platform's pages while logged in, before writing a single selector.
 *
 * This is the step that made the Filmmakers importer possible: log in with the
 * credentials the user already stored, follow whatever the site itself calls
 * "my profile", and report what the pages are made of. Every earlier attempt to
 * write an importer from assumptions produced selectors that matched nothing -
 * /profile/edit does not exist on Filmmakers, the fields are namespaced
 * actor_profile[...], and no amount of thinking about it would have said so.
 *
 *   node scripts/recon-profile.mjs jobwork
 *   node scripts/recon-profile.mjs jobwork --out C:\some\dir
 *
 * Read-only: it navigates and reads. Nothing is submitted, nothing is written
 * to the platform, and nothing is written to the user's profile.
 *
 * The saved HTML is the account holder's personal data, so it goes to a
 * temporary directory by default, never into the repository.
 */
import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/database.js';
import Platform from '../src/models/Platform.js';
import { getConnectorByKey, listManifests } from '../src/connectors/registry.js';
import { redact } from '../src/connectors/forensics.js';

const [key, ...rest] = process.argv.slice(2);
const outFlag = rest.indexOf('--out');
const OUT = outFlag === -1
  ? path.join(os.tmpdir(), `recon-${key}-${Date.now()}`)
  : rest[outFlag + 1];

if (!key) {
  console.error('Usage: node scripts/recon-profile.mjs <platform-key> [--out <dir>]');
  console.error('Known keys:', listManifests().map((m) => m.key).join(', '));
  process.exit(1);
}

const Connector = getConnectorByKey(key);
if (!Connector) {
  console.error(`No connector registered for "${key}".`);
  process.exit(1);
}

await connectDB();

const platform = await Platform.findOne({ platformId: Connector.manifest.id, connected: true });
if (!platform) {
  console.error(`No connected ${Connector.manifest.name} record found.`);
  console.error('Connect the platform in the app first - this script never asks for a password.');
  await mongoose.disconnect();
  process.exit(1);
}

// Read through the Mongoose getters, which is what decrypts them.
const credentials = {
  email: platform.authData?.email,
  username: platform.authData?.username,
  password: platform.authData?.password,
  apiKey: platform.authData?.apiKey
};

const connector = new Connector(platform, credentials);
await fs.mkdir(OUT, { recursive: true });

/** Save a page, with the credentials scrubbed out of it. */
const save = async (label, html) => {
  const file = path.join(OUT, `${key}-${label}.html`);
  await fs.writeFile(file, redact(html, credentials), 'utf8');
  return file;
};

/** Load a URL and report what it is; returns false when it did not load. */
const visit = async (label, url) => {
  const response = await connector.page
    .goto(url, { waitUntil: 'networkidle2', timeout: 45000 })
    .catch((error) => ({ error }));

  if (response?.error) {
    console.log(`\n### ${label}: ${response.error.message.slice(0, 80)}`);
    return false;
  }

  const html = await connector.page.content();
  console.log(`\n### ${label}`);
  console.log(`  ${response?.status()}  ${connector.page.url()}`);
  console.log(`  title: ${await connector.page.title()}`);
  console.log(`  html -> ${await save(label, html)} (${html.length} bytes)`);

  // Form controls are what an importer reads; values are the user's own data
  // and are reported only as present/absent.
  const controls = await connector.page.$$eval('input, select, textarea', (els) => els
    .filter((el) => el.type !== 'hidden' && el.type !== 'search' && el.type !== 'submit')
    .slice(0, 80)
    .map((el) => {
      const id = el.getAttribute('id');
      const label2 = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        id,
        label: (label2?.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        filled: Boolean(el.value && String(el.value).trim())
      };
    })).catch(() => []);

  if (controls.length) {
    console.log(`  form controls (${controls.length}):`);
    for (const control of controls) console.log('   ', JSON.stringify(control));
  }
  return true;
};

try {
  await connector.authenticate();
  console.log(`\nlogged in as ${credentials.email || credentials.username}`);
  console.log(`landing page: ${connector.page.url()}`);

  // What the site itself offers once logged in. This is how the profile URL is
  // found - never by trying paths.
  const links = await connector.page.$$eval('a[href]', (els) => {
    const seen = new Set();
    return els
      .map((a) => ({ href: a.getAttribute('href'), text: (a.innerText || '').trim().slice(0, 40) }))
      .filter((l) => l.href && !seen.has(l.href) && seen.add(l.href));
  });

  const interesting = links.filter((l) => /profil|profile|edit|bearbeiten|konto|account|mein|my|setcard|vita|cv|einstellungen|settings/i
    .test(`${l.href} ${l.text}`));

  console.log('\nlinks the logged-in page offers that look profile-related:');
  for (const link of interesting.slice(0, 40)) {
    console.log(`  ${link.href}  |  ${link.text}`);
  }

  await visit('landing', connector.page.url());

  const base = new URL(connector.page.url()).origin;
  const candidates = [...new Set(interesting
    .map((l) => l.href)
    .filter((href) => /profil|profile|edit|bearbeiten|vita|setcard/i.test(href))
    .map((href) => (href.startsWith('http') ? href : new URL(href, base).href)))].slice(0, 8);

  console.log('\nfollowing:', candidates.length ? candidates.join('\n           ') : '(nothing looked like a profile link)');
  for (const [index, url] of candidates.entries()) {
    // eslint-disable-next-line no-await-in-loop
    await visit(`page-${index + 1}`, url);
  }

  console.log(`\nEverything saved under: ${OUT}`);
  console.log('That HTML is personal data. It is outside the repository on purpose.');
} catch (error) {
  console.log(`\nFAILED: ${error.constructor.name}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connector.close();
  await mongoose.disconnect();
}
