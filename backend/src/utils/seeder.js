import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { logger } from './logger.js';
import User from '../models/User.js';
import Platform from '../models/Platform.js';
import Profile from '../models/Profile.js';

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI);

// Sample data
const users = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin'
  },
  {
    name: 'Publisher User',
    email: 'publisher@example.com',
    password: 'password123',
    role: 'publisher'
  },
  {
    name: 'Regular User',
    email: 'user@example.com',
    password: 'password123',
    role: 'user'
  }
];

const platforms = [
  {
    name: 'Filmmakers',
    authType: 'oauth',
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'oauth',
      features: ['profile', 'media', 'bookings'],
      regions: ['DE', 'AT', 'CH'],
      description: 'Largest casting platform in German-speaking region'
    }
  },
  {
    name: 'Casting Network',
    authType: 'api',
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'api_key',
      features: ['profile', 'media', 'bookings', 'recommendations'],
      regions: ['US', 'UK', 'CA', 'AU'],
      description: 'International casting platform for professional actors'
    }
  },
  {
    name: 'etalenta',
    authType: 'api',
    meta: {
      hasAPI: true,
      agentCapable: false,
      connectionType: 'api_key',
      features: ['profile', 'media'],
      regions: ['DE', 'AT'],
      description: 'German casting platform for theatre and film'
    }
  },
  {
    name: 'JobWork',
    authType: 'oauth',
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'oauth',
      features: ['profile', 'bookings'],
      regions: ['DE'],
      description: 'Platform for commercial and model castings'
    }
  }
];

// Import data into DB
const importData = async () => {
  try {
    // Clear the database
    await User.deleteMany();
    await Platform.deleteMany();
    await Profile.deleteMany();

    // Create users
    const createdUsers = await User.create(users);
    const adminUser = createdUsers[0]._id;

    // Add user reference to platforms and create them
    const platformsWithUser = platforms.map(platform => ({
      ...platform,
      user: adminUser,
      platformId: Math.floor(Math.random() * 1000) + 1 // Random ID for demo
    }));

    await Platform.create(platformsWithUser);

    // Create a profile for the admin
    await Profile.create({
      user: adminUser,
      firstName: 'Admin',
      lastName: 'User',
      dateOfBirth: new Date('1985-01-01'),
      gender: 'male',
      nationality: 'German',
      languages: ['German', 'English'],
      skills: ['Acting', 'Voice Acting'],
      bio: 'Professional actor with over 10 years of experience in film and theatre.',
      contactInfo: {
        email: 'admin@example.com',
        phone: '+49123456789',
        address: 'Musterstraße 123, 10115 Berlin'
      }
    });

    logger.info('Data imported successfully');
    process.exit();
  } catch (err) {
    logger.error(`Error importing data: ${err.message}`);
    process.exit(1);
  }
};

// Delete data from DB
const deleteData = async () => {
  try {
    await User.deleteMany();
    await Platform.deleteMany();
    await Profile.deleteMany();

    logger.info('Data destroyed successfully');
    process.exit();
  } catch (err) {
    logger.error(`Error deleting data: ${err.message}`);
    process.exit(1);
  }
};

// Determine if importing or deleting data
if (process.argv[2] === '-d') {
  deleteData();
} else {
  importData();
}
