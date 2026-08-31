import { FilmmakersConnector } from './FilmmakersConnector.js';
import { CastingNetworkConnector } from './CastingNetworkConnector.js';
import { SchauspielervideosConnector } from './SchauspielervideosConnector.js';
import { ETalentaConnector } from './ETalentaConnector.js';
import { JobWorkConnector } from './JobWorkConnector.js';
import { WantedConnector } from './WantedConnector.js';
import { SarahWeissConnector } from './SarahWeissConnector.js';
import { FilmpoolConnector } from './FilmpoolConnector.js';
import { UfaBaseConnector } from './UfaBaseConnector.js';
import { ImOffConnector } from './ImOffConnector.js';
import { CastingNetworkDeConnector } from './CastingNetworkDeConnector.js';
import { BackstageConnector } from './BackstageConnector.js';
import { ManualConnector } from './ManualConnector.js';

/**
 * The single place that knows which platforms exist.
 *
 * Nothing else hard-codes a platform id. Controllers and services ask the
 * registry, and the UI can be driven entirely from the manifests - which auth
 * fields to render, which actions to offer - instead of duplicating that
 * knowledge on the client.
 */
const CONNECTORS = [
  FilmmakersConnector,
  CastingNetworkConnector,
  SchauspielervideosConnector,
  ETalentaConnector,
  JobWorkConnector,
  WantedConnector,
  // Sarah Weiß Casting was a manual entry until its login turned out to be a
  // real one, on the same platform agentur wanted uses.
  SarahWeissConnector,
  FilmpoolConnector,
  UfaBaseConnector,
  ImOffConnector,
  // casting-network.de - the German site, not the international
  // castingnetworks.com that CastingNetworkConnector drives.
  CastingNetworkDeConnector,
  // Backstage signs in with Google and is behind Cloudflare: recorded here so
  // it is a platform like any other, automated by nothing.
  BackstageConnector,
  ManualConnector.forPlatform(6, 'Agentur (manuell)'),
  ManualConnector.forPlatform(7, 'Agentur (manuell)')
];

const byId = new Map();
const byKey = new Map();

for (const Connector of CONNECTORS) {
  const { id, key } = Connector.manifest;
  if (byId.has(id)) throw new Error(`Duplicate connector id ${id}`);
  if (byKey.has(key)) throw new Error(`Duplicate connector key ${key}`);
  byId.set(id, Connector);
  byKey.set(key, Connector);
}

export const getConnector = (platformId) => byId.get(Number(platformId)) || null;
export const getConnectorByKey = (key) => byKey.get(key) || null;

/** Manifests only - safe to send to the client. */
export const listManifests = () => CONNECTORS.map((c) => c.manifest);

export const hasConnector = (platformId) => byId.has(Number(platformId));
