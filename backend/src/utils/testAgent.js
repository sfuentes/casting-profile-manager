import agentService from '../services/agentService.js';
import { logger } from './logger.js';

/**
 * Agent Testing Utility
 * Test platform agents in isolation
 */

/**
 * Test connection to a platform
 */
export async function testConnection(platformId, credentials) {
  try {
    logger.info(`Testing connection to platform ${platformId}`);
    console.log(`\n=== Testing Connection to Platform ${platformId} ===\n`);

    const result = await agentService.testConnection(platformId, credentials);

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ Connection test PASSED');
    } else {
      console.log('\n❌ Connection test FAILED');
    }

    return result;
  } catch (error) {
    console.error('\n❌ Connection test ERROR:', error.message);
    throw error;
  }
}

/**
 * Test profile sync
 */
export async function testProfileSync(platformId, credentials, profileData) {
  try {
    logger.info(`Testing profile sync to platform ${platformId}`);
    console.log(`\n=== Testing Profile Sync to Platform ${platformId} ===\n`);

    const result = await agentService.syncProfile(platformId, credentials, profileData);

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ Profile sync PASSED');
    } else {
      console.log('\n❌ Profile sync FAILED');
    }

    return result;
  } catch (error) {
    console.error('\n❌ Profile sync ERROR:', error.message);
    throw error;
  }
}

/**
 * Test availability update
 */
export async function testAvailabilityUpdate(platformId, credentials, availability) {
  try {
    logger.info(`Testing availability update on platform ${platformId}`);
    console.log(`\n=== Testing Availability Update on Platform ${platformId} ===\n`);

    const result = await agentService.updateAvailability(platformId, credentials, availability);

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ Availability update PASSED');
    } else {
      console.log('\n❌ Availability update FAILED');
    }

    return result;
  } catch (error) {
    console.error('\n❌ Availability update ERROR:', error.message);
    throw error;
  }
}

/**
 * Test media upload
 */
export async function testMediaUpload(platformId, credentials, media) {
  try {
    logger.info(`Testing media upload to platform ${platformId}`);
    console.log(`\n=== Testing Media Upload to Platform ${platformId} ===\n`);

    const result = await agentService.uploadMedia(platformId, credentials, media);

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ Media upload PASSED');
    } else {
      console.log('\n❌ Media upload FAILED');
    }

    return result;
  } catch (error) {
    console.error('\n❌ Media upload ERROR:', error.message);
    throw error;
  }
}

/**
 * Test profile read
 */
export async function testProfileRead(platformId, credentials) {
  try {
    logger.info(`Testing profile read from platform ${platformId}`);
    console.log(`\n=== Testing Profile Read from Platform ${platformId} ===\n`);

    const result = await agentService.readProfile(platformId, credentials);

    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\n✅ Profile read COMPLETED');

    return result;
  } catch (error) {
    console.error('\n❌ Profile read ERROR:', error.message);
    throw error;
  }
}

/**
 * Get agent metrics
 */
export async function getMetrics(platformId) {
  try {
    console.log(`\n=== Agent Metrics for Platform ${platformId} ===\n`);

    const metrics = await agentService.getAgentMetrics(platformId);

    console.log(JSON.stringify(metrics, null, 2));

    return metrics;
  } catch (error) {
    console.error('\n❌ Failed to get metrics:', error.message);
    throw error;
  }
}

/**
 * Get all metrics
 */
export async function getAllMetrics() {
  try {
    console.log('\n=== All Agent Metrics ===\n');

    const metrics = await agentService.getAllMetrics();

    console.log(JSON.stringify(metrics, null, 2));

    return metrics;
  } catch (error) {
    console.error('\n❌ Failed to get all metrics:', error.message);
    throw error;
  }
}

/**
 * Run full test suite for a platform
 */
export async function runFullTest(platformId, credentials, testData = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FULL TEST SUITE FOR PLATFORM ${platformId}`);
  console.log('='.repeat(60));

  const results = {
    platformId,
    tests: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  // Test 1: Connection
  try {
    console.log('\n[1/4] Testing Connection...');
    results.tests.connection = await testConnection(platformId, credentials);
    results.summary.passed += 1;
  } catch (error) {
    results.tests.connection = { success: false, error: error.message };
    results.summary.failed += 1;
  }
  results.summary.total += 1;

  // Test 2: Profile Sync
  if (testData.profile) {
    try {
      console.log('\n[2/4] Testing Profile Sync...');
      results.tests.profileSync = await testProfileSync(platformId, credentials, testData.profile);
      results.summary.passed += 1;
    } catch (error) {
      results.tests.profileSync = { success: false, error: error.message };
      results.summary.failed += 1;
    }
    results.summary.total += 1;
  }

  // Test 3: Availability Update
  if (testData.availability) {
    try {
      console.log('\n[3/4] Testing Availability Update...');
      results.tests.availability = await testAvailabilityUpdate(
        platformId,
        credentials,
        testData.availability
      );
      results.summary.passed += 1;
    } catch (error) {
      results.tests.availability = { success: false, error: error.message };
      results.summary.failed += 1;
    }
    results.summary.total += 1;
  }

  // Test 4: Profile Read
  try {
    console.log('\n[4/4] Testing Profile Read...');
    results.tests.profileRead = await testProfileRead(platformId, credentials);
    results.summary.passed += 1;
  } catch (error) {
    results.tests.profileRead = { success: false, error: error.message };
    results.summary.failed += 1;
  }
  results.summary.total += 1;

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} ✅`);
  console.log(`Failed: ${results.summary.failed} ❌`);
  console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  return results;
}

/**
 * Example usage for Filmmakers
 */
export function exampleFilmmakersTest() {
  const credentials = {
    email: 'your-email@example.com',
    password: 'your-password'
  };

  const testData = {
    profile: {
      name: 'Test Actor',
      biography: 'Test biography for agent testing',
      height: '175',
      location: 'Berlin, Germany'
    },
    availability: [
      {
        startDate: '2024-02-01',
        endDate: '2024-02-10',
        type: 'available'
      }
    ]
  };

  return runFullTest(1, credentials, testData);
}

/**
 * Example usage for e-TALENTA
 */
export function exampleETalentaTest() {
  const credentials = {
    username: 'your-username',
    password: 'your-password'
  };

  const testData = {
    profile: {
      name: 'Test Actor',
      firstName: 'Test',
      lastName: 'Actor',
      biography: 'Test biography',
      height: 175,
      location: 'Berlin'
    },
    availability: [
      {
        startDate: '2024-02-01',
        endDate: '2024-02-10',
        type: 'available'
      }
    ]
  };

  return runFullTest(4, credentials, testData);
}

// Export all test functions
export default {
  testConnection,
  testProfileSync,
  testAvailabilityUpdate,
  testMediaUpload,
  testProfileRead,
  getMetrics,
  getAllMetrics,
  runFullTest,
  exampleFilmmakersTest,
  exampleETalentaTest
};
