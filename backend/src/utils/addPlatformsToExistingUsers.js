import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Platform from '../models/Platform.js';
import { logger } from './logger.js';
import { listManifests } from '../connectors/registry.js';

/**
 * Every platform the app knows, taken from the connector registry.
 *
 * This was a third hand-maintained copy of the same list (the other two were
 * in authController and in the client), and all three had drifted apart. A
 * list of platforms that lives anywhere except the registry is a list that
 * will be wrong the next time a connector is added.
 */
const knownPlatforms = () => listManifests().map((manifest) => ({
  platformId: manifest.id,
  name: manifest.name,
  authType: manifest.authType,
  connected: false,
  meta: { description: manifest.name }
}));

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
      const existingPlatformIds = existingPlatforms.map((p) => p.platformId);

      console.log(`  - Existing platforms: ${existingPlatformIds.length} (IDs: ${existingPlatformIds.join(', ') || 'none'})`);

      // Filter out platforms that already exist
      const platformsToAdd = knownPlatforms().filter(
        (platform) => !existingPlatformIds.includes(platform.platformId)
      );

      if (platformsToAdd.length === 0) {
        console.log('  - All platforms already exist for this user');
        totalSkipped += existingPlatformIds.length;
        continue;
      }

      // Add missing platforms
      const platformsWithUser = platformsToAdd.map((platform) => ({
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
