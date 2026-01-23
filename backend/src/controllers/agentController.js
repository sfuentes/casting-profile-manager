import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';

/**
 * Check agent health status
 * GET /api/agent/health
 *
 * This endpoint provides status information about the platform sync agents
 */
export const checkAgentHealth = catchAsync(async (req, res) => {
  // Count available adapters
  const availableAdapters = {
    1: 'Filmmakers (Web Scraping)',
    2: 'Casting Network (Web Scraping)',
    3: 'Schauspielervideos (API)',
    4: 'e-TALENTA (API)',
    5: 'JobWork (Web Scraping)',
    9: 'Wanted (Web Scraping)'
  };

  const totalPlatforms = 9;
  const implementedPlatforms = Object.keys(availableAdapters).length;

  res.status(200).json({
    success: true,
    status: 'healthy',
    message: `Platform sync agents operational - ${implementedPlatforms}/${totalPlatforms} platforms supported`,
    timestamp: new Date().toISOString(),
    data: {
      supportedPlatforms: implementedPlatforms,
      totalPlatforms: totalPlatforms,
      availableAdapters: availableAdapters,
      mode: 'production',
      features: [
        'push_availability',
        'push_profile',
        'push_media',
        'rate_limiting',
        'retry_logic',
        'error_handling'
      ]
    }
  });
});

export default {
  checkAgentHealth
};
