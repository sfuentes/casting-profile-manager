import BaseIntelligentAgent from './BaseIntelligentAgent.js';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';
import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * e-TALENTA Platform Agent
 * Intelligent API-based agent for e-TALENTA
 */
export class ETalentaAgent extends BaseIntelligentAgent {
  constructor() {
    super({
      platformId: 4,
      name: 'e-TALENTA',
      baseUrl: process.env.ETALENTA_API_URL || 'https://api.e-talenta.eu/v1',
      capabilities: ['profile', 'photos', 'availability', 'castings']
    });

    this.apiClient = null;
    this.accessToken = null;
    this.needsBrowser = false; // API agent doesn't need browser
  }

  /**
   * Initialize rate limiter for e-TALENTA
   * e-TALENTA allows 100 requests per minute
   */
  initRateLimiter() {
    return new RateLimiterMemory({
      points: 100,
      duration: 60,
    });
  }

  /**
   * Authenticate with e-TALENTA API
   */
  async authenticate(credentials) {
    if (!credentials || !credentials.username || !credentials.password) {
      throw new Error('Username and password are required for e-TALENTA');
    }

    if (this.config.simulationMode) {
      await this.delay(800 + Math.random() * 400);
      this.isAuthenticated = true;
      this.sessionStartTime = Date.now();
      this.accessToken = 'simulated_token_' + Date.now();
      this.log('info', 'Authentication successful (simulation)');
      return true;
    }

    return this.authenticateReal(credentials);
  }

  /**
   * Real API authentication
   */
  async authenticateReal(credentials) {
    try {
      this.log('info', 'Authenticating with e-TALENTA API');

      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username: credentials.username,
        password: credentials.password,
        client_id: process.env.ETALENTA_CLIENT_ID,
        client_secret: process.env.ETALENTA_CLIENT_SECRET
      }, {
        timeout: this.config.timeout
      });

      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid authentication response from e-TALENTA');
      }

      this.accessToken = response.data.access_token;

      // Initialize API client with auth token
      this.apiClient = axios.create({
        baseURL: this.baseUrl,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        timeout: this.config.timeout
      });

      this.isAuthenticated = true;
      this.sessionStartTime = Date.now();
      this.log('info', 'Authentication successful');

      return true;
    } catch (error) {
      this.log('error', 'Authentication failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`e-TALENTA authentication failed: ${error.message}`);
    }
  }

  /**
   * Sync profile to e-TALENTA
   */
  async performSyncProfile(profileData) {
    try {
      this.log('info', 'Starting profile sync');

      // Simulation mode
      if (this.config.simulationMode) {
        await this.delay(1000 + Math.random() * 500);
        this.log('info', 'Profile sync completed (simulation)');
        return {
          success: true,
          platform: this.platformName,
          message: 'Profile synchronized successfully (simulation)',
          syncedFields: Object.keys(profileData),
          profileId: 'sim_profile_' + Date.now(),
          timestamp: new Date().toISOString()
        };
      }

      // Transform profile data to e-TALENTA format
      const eTalentaProfile = this.transformProfile(profileData);

      // Send to API
      const response = await this.apiClient.put('/profile', eTalentaProfile);

      this.log('info', 'Profile sync completed');

      return {
        success: true,
        platform: this.platformName,
        message: 'Profile synchronized successfully',
        syncedFields: Object.keys(profileData),
        profileId: response.data.id,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Profile sync failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`Profile sync failed: ${error.message}`);
    }
  }

  /**
   * Update availability on e-TALENTA
   */
  async performUpdateAvailability(availability) {
    try {
      this.log('info', 'Starting availability update');

      // Simulation mode
      if (this.config.simulationMode) {
        await this.delay(800 + Math.random() * 400);
        this.log('info', 'Availability update completed (simulation)');
        return {
          success: true,
          platform: this.platformName,
          message: 'Availability updated successfully (simulation)',
          updatedSlots: Array.isArray(availability) ? availability.length : 1,
          timestamp: new Date().toISOString()
        };
      }

      // Transform availability data
      const eTalentaAvailability = this.transformAvailability(availability);

      // Send to API
      const response = await this.apiClient.post('/profile/availability', {
        availability: eTalentaAvailability
      });

      this.log('info', 'Availability update completed');

      return {
        success: true,
        platform: this.platformName,
        message: 'Availability updated successfully',
        updatedSlots: Array.isArray(availability) ? availability.length : 1,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Availability update failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`Availability update failed: ${error.message}`);
    }
  }

  /**
   * Upload media to e-TALENTA
   */
  async performUploadMedia(media) {
    try {
      this.log('info', 'Starting media upload');

      const files = Array.isArray(media) ? media : [media];
      let uploadedCount = 0;

      for (const file of files) {
        try {
          // Create form data
          const formData = new FormData();

          if (file.buffer) {
            formData.append('file', file.buffer, {
              filename: file.originalname || 'upload.jpg',
              contentType: file.mimetype || 'image/jpeg'
            });
          } else if (file.path) {
            const fileBuffer = await fs.readFile(file.path);
            formData.append('file', fileBuffer, {
              filename: file.originalname || 'upload.jpg',
              contentType: file.mimetype || 'image/jpeg'
            });
          }

          if (file.type) {
            formData.append('type', file.type); // 'photo' or 'video'
          }

          if (file.category) {
            formData.append('category', file.category);
          }

          // Upload to API
          await this.apiClient.post('/profile/media', formData, {
            headers: {
              ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 120000 // 2 minutes for large files
          });

          uploadedCount += 1;
        } catch (fileError) {
          this.log('warn', `Failed to upload file: ${fileError.message}`);
        }
      }

      this.log('info', 'Media upload completed', { uploadedFiles: uploadedCount });

      return {
        success: true,
        platform: this.platformName,
        message: `${uploadedCount} files uploaded successfully`,
        uploadedFiles: uploadedCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Media upload failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`Media upload failed: ${error.message}`);
    }
  }

  /**
   * Read profile from e-TALENTA
   */
  async performReadProfile() {
    try {
      this.log('info', 'Reading profile from platform');

      // Simulation mode
      if (this.config.simulationMode) {
        await this.delay(600 + Math.random() * 300);
        this.log('info', 'Profile data retrieved (simulation)');
        return {
          id: 'sim_profile_' + Date.now(),
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+49 123 456789',
          height: 180,
          weight: 75,
          eyeColor: 'blue',
          hairColor: 'brown',
          source: this.platformName,
          timestamp: new Date().toISOString()
        };
      }

      const response = await this.apiClient.get('/profile');

      this.log('info', 'Profile data retrieved');

      return {
        ...response.data,
        source: this.platformName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Profile read failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`Profile read failed: ${error.message}`);
    }
  }

  /**
   * Transform profile data to e-TALENTA format
   */
  transformProfile(profile) {
    const eTalentaProfile = {
      basic_info: {},
      physical: {},
      contact: {},
      professional: {}
    };

    // Basic info
    if (profile.name) eTalentaProfile.basic_info.name = profile.name;
    if (profile.firstName) eTalentaProfile.basic_info.first_name = profile.firstName;
    if (profile.lastName) eTalentaProfile.basic_info.last_name = profile.lastName;
    if (profile.dateOfBirth) eTalentaProfile.basic_info.date_of_birth = profile.dateOfBirth;
    if (profile.gender) eTalentaProfile.basic_info.gender = profile.gender;
    if (profile.nationality) eTalentaProfile.basic_info.nationality = profile.nationality;
    if (profile.biography) eTalentaProfile.basic_info.biography = profile.biography;

    // Physical attributes
    if (profile.height) {
      eTalentaProfile.physical.height = this.convertHeight(profile.height);
    }
    if (profile.weight) eTalentaProfile.physical.weight = profile.weight;
    if (profile.eyeColor) eTalentaProfile.physical.eye_color = profile.eyeColor;
    if (profile.hairColor) eTalentaProfile.physical.hair_color = profile.hairColor;
    if (profile.hairLength) eTalentaProfile.physical.hair_length = profile.hairLength;
    if (profile.shoeSize) eTalentaProfile.physical.shoe_size = profile.shoeSize;

    // Contact
    if (profile.email) eTalentaProfile.contact.email = profile.email;
    if (profile.phone) eTalentaProfile.contact.phone = profile.phone;
    if (profile.location) eTalentaProfile.contact.location = profile.location;
    if (profile.city) eTalentaProfile.contact.city = profile.city;
    if (profile.country) eTalentaProfile.contact.country = profile.country;

    // Professional
    if (profile.languages && Array.isArray(profile.languages)) {
      eTalentaProfile.professional.languages = profile.languages.map((lang) => ({
        language: lang.name || lang,
        level: this.mapLanguageLevel(lang.level)
      }));
    }

    if (profile.skills && Array.isArray(profile.skills)) {
      eTalentaProfile.professional.skills = profile.skills;
    }

    if (profile.experience && Array.isArray(profile.experience)) {
      eTalentaProfile.professional.experience = profile.experience.map((exp) => ({
        title: exp.title,
        role: exp.role,
        year: exp.year,
        production: exp.production,
        director: exp.director
      }));
    }

    // Clean up empty objects
    Object.keys(eTalentaProfile).forEach((key) => {
      if (Object.keys(eTalentaProfile[key]).length === 0) {
        delete eTalentaProfile[key];
      }
    });

    return eTalentaProfile;
  }

  /**
   * Transform availability data to e-TALENTA format
   */
  transformAvailability(availability) {
    const slots = Array.isArray(availability) ? availability : [availability];

    return slots.map((slot) => ({
      start_date: slot.startDate,
      end_date: slot.endDate,
      start_time: slot.startTime,
      end_time: slot.endTime,
      status: this.mapAvailabilityStatus(slot.type),
      notes: slot.reason || slot.notes
    }));
  }

  /**
   * Map availability status
   */
  mapAvailabilityStatus(type) {
    const statusMap = {
      available: 'available',
      busy: 'busy',
      blocked: 'unavailable',
      unavailable: 'unavailable'
    };

    return statusMap[type] || 'available';
  }

  /**
   * Convert height to cm
   */
  convertHeight(height) {
    if (typeof height === 'number') {
      return height;
    }

    const heightStr = height.toString();

    // Already in cm
    if (heightStr.includes('cm')) {
      return parseInt(heightStr.replace(/\D/g, ''), 10);
    }

    // Convert from feet/inches
    const feetInchesMatch = heightStr.match(/(\d+)[''](\d+)/);
    if (feetInchesMatch) {
      const feet = parseInt(feetInchesMatch[1], 10);
      const inches = parseInt(feetInchesMatch[2], 10);
      return Math.round((feet * 12 + inches) * 2.54);
    }

    // Try to parse as plain number
    const num = parseInt(heightStr.replace(/\D/g, ''), 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Map language level
   */
  mapLanguageLevel(level) {
    if (!level) return 'basic';

    const levelStr = level.toString().toLowerCase();
    const levelMap = {
      native: 'native',
      fluent: 'fluent',
      advanced: 'advanced',
      intermediate: 'intermediate',
      basic: 'basic',
      beginner: 'basic'
    };

    return levelMap[levelStr] || 'basic';
  }
}

export default ETalentaAgent;
