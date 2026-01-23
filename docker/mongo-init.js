// MongoDB Initialization Script
// This script runs when the MongoDB container is first created

print('========================================');
print('MongoDB Initialization Script');
print('========================================');

// Switch to the application database
db = db.getSiblingDB('darsteller-manager');

print('Creating darsteller-manager database...');

// Create collections with validators
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'must be a valid email and is required'
        },
        password: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        role: {
          enum: ['user', 'admin'],
          description: 'can only be user or admin'
        }
      }
    }
  }
});

print('Users collection created');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });

print('User indexes created');

// Create profiles collection
db.createCollection('profiles');
db.profiles.createIndex({ user: 1 }, { unique: true });
db.profiles.createIndex({ 'platforms.platformId': 1 });

print('Profiles collection created');

// Create bookings collection
db.createCollection('bookings');
db.bookings.createIndex({ user: 1 });
db.bookings.createIndex({ startDate: 1, endDate: 1 });
db.bookings.createIndex({ status: 1 });

print('Bookings collection created');

// Create availability collection
db.createCollection('availabilities');
db.availabilities.createIndex({ user: 1 });
db.availabilities.createIndex({ startDate: 1, endDate: 1 });

print('Availabilities collection created');

// Create platforms collection
db.createCollection('platforms');
db.platforms.createIndex({ name: 1 });
db.platforms.createIndex({ 'users.userId': 1 });

print('Platforms collection created');

print('========================================');
print('MongoDB initialization completed!');
print('Database: darsteller-manager');
print('Collections created: users, profiles, bookings, availabilities, platforms');
print('========================================');
