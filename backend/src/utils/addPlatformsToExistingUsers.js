import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Platform from '../models/Platform.js';
import { logger } from './logger.js';

// Default platforms to add for all users
const DEFAULT_PLATFORMS = [
  {
    platformId: 1,
    name: 'Filmmakers',
    authType: 'credentials',
    connected: false,
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
    name: 'Casting Network',
    authType: 'credentials',
    connected: false,
    meta: {
      hasAPI: false,
      agentCapable: true,
      connectionType: 'scraping',
      features: ['profile', 'media', 'bookings', 'recommendations'],
      regions: ['US', 'UK', 'CA', 'AU'],
      description: 'International casting platform for professional actors'
    }
  },
  {
    platformId: 3,
    name: 'Schauspielervideos',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'api_key',
      features: ['profile', 'videos', 'photos', 'showreel'],
      regions: ['DE', 'AT', 'CH'],
      description: 'German actor video platform'
    }
  },
  {
    platformId: 4,
    name: 'e-TALENTA',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'api_key',
      features: ['profile', 'photos', 'availability', 'castings'],
      regions: ['EU', 'DE', 'AT', 'CH'],
      description: 'European casting network'
    }
  },
  {
    platformId: 5,
    name: 'JobWork',
    authType: 'credentials',
    connected: false,
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
    platformId: 6,
    name: 'Agentur Iris Müller',
    authType: 'credentials',
    connected: false,
    meta: {
      hasAPI: false,
      agentCapable: false,
      connectionType: 'manual',
      features: ['profile', 'representation'],
      regions: ['DE'],
      description: 'Traditional talent agency'
    }
  },
  {
    platformId: 7,
    name: 'Agentur Connection',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: false,
      connectionType: 'api',
      features: ['profile', 'representation', 'bookings'],
      regions: ['DE', 'AT'],
      description: 'Professional talent agency'
    }
  },
  {
    platformId: 8,
    name: 'Agentur Sarah Weiss',
    authType: 'credentials',
    connected: false,
    meta: {
      hasAPI: false,
      agentCapable: false,
      connectionType: 'manual',
      features: ['profile', 'representation'],
      regions: ['DE'],
      description: 'Boutique talent agency'
    }
  },
  {
    platformId: 9,
    name: 'Wanted',
    authType: 'credentials',
    connected: false,
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

const addPlatformsToExistingUsers = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    if (users.length === 0) {
      console.log('No users found in database');
      process.exit(0);
    }

    let totalAdded = 0;
    let totalSkipped = 0;

    // Process each user
    for (const user of users) {
      console.log(`\nProcessing user: ${user.email} (${user._id})`);

      // Check which platforms the user already has
      const existingPlatforms = await Platform.find({ user: user._id });
      const existingPlatformIds = existingPlatforms.map(p => p.platformId);

      console.log(`  - Existing platforms: ${existingPlatformIds.length} (IDs: ${existingPlatformIds.join(', ') || 'none'})`);

      // Filter out platforms that already exist
      const platformsToAdd = DEFAULT_PLATFORMS.filter(
        platform => !existingPlatformIds.includes(platform.platformId)
      );

      if (platformsToAdd.length === 0) {
        console.log(`  - All platforms already exist for this user`);
        totalSkipped += existingPlatformIds.length;
        continue;
      }

      // Add missing platforms
      const platformsWithUser = platformsToAdd.map(platform => ({
        ...platform,
        user: user._id
      }));

      await Platform.insertMany(platformsWithUser);
      console.log(`  ✅ Added ${platformsToAdd.length} new platforms`);
      totalAdded += platformsToAdd.length;
      totalSkipped += existingPlatformIds.length;
    }

    console.log('\n========================================');
    console.log('Migration completed successfully!');
    console.log(`Total platforms added: ${totalAdded}`);
    console.log(`Total platforms skipped (already exist): ${totalSkipped}`);
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error adding platforms to existing users:', error);
    process.exit(1);
  }
};

// Run the migration
addPlatformsToExistingUsers();
