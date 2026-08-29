import { existsSync } from 'fs';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';
import { listManifests } from '../connectors/registry.js';

/**
 * Check agent health status
 * GET /api/agent/health
 *
 * Everything reported here is derived from the connector registry or read off
 * this machine. It used to be a hard-coded platform list next to a literal
 * `status: 'healthy'` and a list of features nobody checked, which stayed green
 * while the connectors underneath it could not run at all.
 *
 * Note what this endpoint still cannot tell you: no connector has ever reached
 * a live platform from here, so "browser available" means the binary exists,
 * not that a sync would succeed.
 */
export const checkAgentHealth = catchAsync(async (req, res) => {
  const manifests = listManifests();
  const automated = manifests.filter((m) => m.authType !== 'manual');

  // Browser connectors drive puppeteer; without the executable they throw on
  // launch. This is the one part of the pipeline we can actually verify here.
  const browserPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browserAvailable = Boolean(browserPath) && existsSync(browserPath);

  const healthy = automated.length > 0 && browserAvailable;

  res.status(200).json({
    success: true,
    status: healthy ? 'healthy' : 'degraded',
    message: healthy
      ? `${automated.length} of ${manifests.length} platforms have a connector; browser available.`
      : `${automated.length} of ${manifests.length} platforms have a connector; browser not available at ${browserPath || '(PUPPETEER_EXECUTABLE_PATH unset)'}.`,
    timestamp: new Date().toISOString(),
    data: {
      totalPlatforms: manifests.length,
      automatedPlatforms: automated.length,
      manualPlatforms: manifests.length - automated.length,
      browserAvailable,
      platforms: manifests.map((m) => ({
        id: m.id,
        key: m.key,
        name: m.name,
        authType: m.authType,
        capabilities: m.capabilities
      }))
    }
  });
});

export default {
  checkAgentHealth
};
