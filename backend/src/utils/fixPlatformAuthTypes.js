import mongoose from 'mongoose';
import Platform from '../models/Platform.js';
import { connectDB } from '../config/database.js';
import { logger } from './logger.js';

/**
 * Fix platform authentication types for existing users
 * Updates incorrect OAuth/API settings to credentials for scraping-based platforms
 */

const fixPlatformAuthTypes = async () => {
  try {
    await connectDB();
    logger.info('Connected to MongoDB');

    // Define the correct platform configurations
    const platformUpdates = [
      {
        platformId: 1,
        authType: 'credentials',
        meta: {
          hasAPI: false,
          agentCapable: true,
          connectionType: 'scraping',
          features: ['profile', 'media', 'bookings'],
          regions: ['EU', 'Global'],
          description: 'European film industry network'
        }
      },
      {
        platformId: 2,
        authType: 'credentials',
        meta: {
          hasAPI: false,
          agentCapable: true,
          connectionType: 'scraping',
          features: ['profile', 'media', 'bookings', 'submissions'],
          regions: ['US', 'UK', 'CA'],
          description: 'Global casting platform'
        }
      },
      {
        platformId: 5,
        authType: 'credentials',
        meta: {
          hasAPI: false,
          agentCapable: true,
          connectionType: 'scraping',
          features: ['profile', 'jobs', 'networking'],
          regions: ['DE', 'AT', 'CH'],
          description: 'German platform for commercial and model castings'
        }
      },
      {
        platformId: 9,
        authType: 'credentials',
        meta: {
          hasAPI: false,
          agentCapable: true,
          connectionType: 'scraping',
          features: ['profile', 'jobs', 'availability'],
          regions: ['DE', 'AT', 'CH'],
          description: 'German entertainment job portal'
        }
      }
    ];

    let totalUpdated = 0;

    for (const update of platformUpdates) {
      const result = await Platform.updateMany(
        { platformId: update.platformId },
        {
          $set: {
            authType: update.authType,
            meta: update.meta
          }
        }
      );

      logger.info(`Updated platform ${update.platformId}: ${result.modifiedCount} documents`);
      totalUpdated += result.modifiedCount;
    }

    logger.info(`✅ Migration completed! Updated ${totalUpdated} platform entries total.`);

    // Show summary
    const summary = await Platform.aggregate([
      {
        $group: {
          _id: '$platformId',
          name: { $first: '$name' },
          authType: { $first: '$authType' },
          connectionType: { $first: '$meta.connectionType' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n📊 Platform Summary:');
    console.table(summary);

    process.exit(0);

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixPlatformAuthTypes();
}

export default fixPlatformAuthTypes;
