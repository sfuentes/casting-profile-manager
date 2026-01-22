import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { logger } from './logger.js';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import Platform from '../models/Platform.js';
import Profile from '../models/Profile.js';
import Availability from '../models/Availability.js';
import Booking from '../models/Booking.js';
import Option from '../models/Option.js';

// Load env vars
dotenv.config();

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
    // Connect to DB
    await connectDB();

    // Clear the database
    await User.deleteMany();
    await Platform.deleteMany();
    await Profile.deleteMany();
    await Availability.deleteMany();
    await Booking.deleteMany();
    await Option.deleteMany();

    // Create users
    const createdUsers = await User.create(users);
    const adminUser = createdUsers[0];

    // Add user reference to platforms and create them
    const platformsWithUser = platforms.map((platform) => ({
      ...platform,
      user: adminUser._id,
      platformId: Math.floor(Math.random() * 1000) + 1 // Random ID for demo
    }));

    await Platform.create(platformsWithUser);

    // Create a profile for the admin
    await Profile.create({
      user: adminUser._id,
      name: adminUser.name,
      firstName: 'Admin',
      lastName: 'User',
      dateOfBirth: new Date('1985-01-01'),
      gender: 'male',
      citizenship: 'German',
      languages: [
        { language: 'German', level: 'native' },
        { language: 'English', level: 'fluent' }
      ],
      skills: ['Acting', 'Voice Acting'],
      biography: 'Professional actor with over 10 years of experience in film and theatre.',
      contact: {
        email: 'admin@example.com',
        phone: '+49123456789',
        address: 'Musterstraße 123, 10115 Berlin'
      }
    });

    // Seed some bookings for demo
    await Booking.create([
      {
        user: adminUser._id,
        title: 'Tatort: Berlin',
        type: 'tv',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: 'confirmed',
        location: 'Berlin',
        notes: 'Supporting role as witness'
      },
      {
        user: adminUser._id,
        title: 'Commercial: Car Brand',
        type: 'commercial',
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: 'pending',
        location: 'Hamburg',
        notes: 'Lead role'
      }
    ]);

    // Seed some options
    await Option.create([
      {
        user: adminUser._id,
        title: 'Netflix Series: Mystery',
        production: 'Wiedemann & Berg',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: 'pending',
        location: 'Prague',
        notes: 'Waiting for call back'
      }
    ]);

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
    // Connect to DB
    await connectDB();

    await User.deleteMany();
    await Platform.deleteMany();
    await Profile.deleteMany();
    await Availability.deleteMany();
    await Booking.deleteMany();
    await Option.deleteMany();

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
