import axios from 'axios';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

/**
 * e-TALENTA Platform Adapter
 * Platform ID: 4
 * Type: API-based integration
 * Features: Profile, Photos, Availability, Castings
 * Regions: EU, DE, AT, CH
 */
export class ETalentaAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);

    // e-TALENTA API configuration
    this.apiBaseUrl = process.env.ETALENTA_API_URL || 'https://api.e-talenta.eu/v1';
    this.apiClient = null;
    this.accessToken = null;
  }

  /**
   * Initialize rate limiter with e-TALENTA specific limits
   * e-TALENTA allows 100 requests per minute
   */
  initRateLimiter() {
    return new (require('rate-limiter-flexible').RateLimiterMemory)({
      points: 100,
      duration: 60,
    });
  }

  /**
   * Authenticate with e-TALENTA API
   * @returns {Promise<boolean>}
   */
  async authenticate() {
    try {
      this.log('info', 'Authenticating with e-TALENTA API');

      // Check if credentials exist
      if (!this.credentials || !this.credentials.username || !this.credentials.password) {
        throw new Error('Missing e-TALENTA credentials (username/password required)');
      }

      // Authenticate with e-TALENTA API
      const response = await axios.post(`${this.apiBaseUrl}/auth/login`, {
        username: this.credentials.username,
        password: this.credentials.password,
        client_id: process.env.ETALENTA_CLIENT_ID,
        client_secret: process.env.ETALENTA_CLIENT_SECRET
      });

      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid authentication response from e-TALENTA');
      }

      this.accessToken = response.data.access_token;

      // Initialize API client with auth token
      this.apiClient = axios.create({
        baseURL: this.apiBaseUrl,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      this.log('info', 'Successfully authenticated with e-TALENTA');
      return true;

    } catch (error) {
      this.log('error', 'e-TALENTA authentication failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`e-TALENTA authentication failed: ${error.message}`);
    }
  }

  /**
   * Push availability data to e-TALENTA
   * @param {Array} availability - Array of availability objects
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', `Pushing ${availability.length} availability items to e-TALENTA`);

        if (!this.apiClient) {
          throw new Error('API client not initialized. Call authenticate() first.');
        }

        // Transform availability data to e-TALENTA format
        const eTalentaAvailability = this.transformAvailability(availability);

        // Push to e-TALENTA API
        const response = await this.apiClient.post('/profile/availability', {
          availability: eTalentaAvailability
        });

        this.log('info', 'Successfully pushed availability to e-TALENTA', {
          count: availability.length,
          externalIds: response.data.ids
        });

        return {
          success: true,
          count: availability.length,
          externalIds: response.data.ids || [],
          response: response.data
        };
      });
    });
  }

  /**
   * Transform internal availability format to e-TALENTA format
   * @param {Array} availability
   * @returns {Array}
   */
  transformAvailability(availability) {
    return availability.map(item => ({
      start_date: this.formatDate(item.startDate),
      end_date: this.formatDate(item.endDate),
      status: this.mapAvailabilityStatus(item.status),
      notes: item.notes || '',
      type: item.type || 'general'
    }));
  }

  /**
   * Map internal availability status to e-TALENTA status
   * @param {string} status
   * @returns {string}
   */
  mapAvailabilityStatus(status) {
    const statusMap = {
      'available': 'available',
      'unavailable': 'blocked',
      'option': 'option',
      'booking': 'booked',
      'tentative': 'tentative'
    };
    return statusMap[status] || 'available';
  }

  /**
   * Push media (photos/videos) to e-TALENTA
   * @param {Object} media - Media object with buffer and metadata
   * @returns {Promise<Object>}
   */
  async pushMedia(media) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Uploading media to e-TALENTA', {
          type: media.type,
          filename: media.filename
        });

        if (!this.apiClient) {
          throw new Error('API client not initialized. Call authenticate() first.');
        }

        // Create form data for file upload
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        formData.append('file', media.buffer, {
          filename: media.filename,
          contentType: media.mimeType
        });
        formData.append('type', media.type); // 'photo' or 'video'
        formData.append('category', media.category || 'portfolio');

        if (media.description) {
          formData.append('description', media.description);
        }

        // Upload to e-TALENTA
        const response = await this.apiClient.post('/profile/media', formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.accessToken}`
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });

        this.log('info', 'Successfully uploaded media to e-TALENTA', {
          externalId: response.data.id,
          url: response.data.url
        });

        return {
          success: true,
          externalId: response.data.id,
          url: response.data.url
        };
      });
    });
  }

  /**
   * Update profile information on e-TALENTA
   * @param {Object} profile - Profile data
   * @returns {Promise<Object>}
   */
  async updateProfile(profile) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Updating profile on e-TALENTA');

        if (!this.apiClient) {
          throw new Error('API client not initialized. Call authenticate() first.');
        }

        // Transform profile data to e-TALENTA format
        const eTalentaProfile = this.transformProfile(profile);

        // Update profile via API
        const response = await this.apiClient.put('/profile', eTalentaProfile);

        this.log('info', 'Successfully updated profile on e-TALENTA', {
          profileId: response.data.id
        });

        return {
          success: true,
          profileId: response.data.id,
          updatedFields: Object.keys(eTalentaProfile)
        };
      });
    });
  }

  /**
   * Transform internal profile format to e-TALENTA format
   * @param {Object} profile
   * @returns {Object}
   */
  transformProfile(profile) {
    const eTalentaProfile = {
      first_name: profile.name?.split(' ')[0] || '',
      last_name: profile.name?.split(' ').slice(1).join(' ') || '',
      biography: profile.biography || '',
      birth_date: profile.dateOfBirth ? this.formatDate(profile.dateOfBirth) : null,

      // Physical attributes
      physical_attributes: {
        height: this.parseHeight(profile.height),
        weight: profile.weight ? parseInt(profile.weight) : null,
        eye_color: profile.eyeColor?.toLowerCase(),
        hair_color: profile.hairColor?.toLowerCase(),
        gender: profile.gender?.toLowerCase()
      },

      // Contact information
      contact: {
        email: profile.email,
        phone: profile.phone,
        city: profile.city,
        country: profile.country
      },

      // Languages
      languages: profile.languages?.map(lang => ({
        language: lang.language,
        level: this.mapLanguageLevel(lang.level)
      })) || [],

      // Skills
      skills: profile.skills || [],

      // Work history (experience)
      experience: profile.workHistory?.map(work => ({
        title: work.role || work.title,
        production: work.production,
        year: work.year,
        type: work.type,
        description: work.description
      })) || [],

      // Education/Training
      training: profile.education?.map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        year: edu.year,
        description: edu.description
      })) || []
    };

    // Remove null/undefined values
    return this.cleanObject(eTalentaProfile);
  }

  /**
   * Parse height from string format (e.g., "175 cm", "5'9\"") to cm
   * @param {string} height
   * @returns {number|null}
   */
  parseHeight(height) {
    if (!height) return null;

    // Extract numbers from string
    const match = height.match(/(\d+)/);
    if (!match) return null;

    const value = parseInt(match[1]);

    // If height contains "cm", assume it's already in cm
    if (height.toLowerCase().includes('cm')) {
      return value;
    }

    // If height is likely in feet (< 10), convert to cm
    if (value < 10) {
      const inches = height.match(/['"](\d+)/)?.[1] || 0;
      return Math.round((value * 12 + parseInt(inches)) * 2.54);
    }

    return value;
  }

  /**
   * Map internal language level to e-TALENTA format
   * @param {string} level
   * @returns {string}
   */
  mapLanguageLevel(level) {
    const levelMap = {
      'native': 'native',
      'fluent': 'fluent',
      'advanced': 'advanced',
      'intermediate': 'intermediate',
      'basic': 'basic',
      'beginner': 'basic'
    };
    return levelMap[level?.toLowerCase()] || 'basic';
  }

  /**
   * Format date to ISO 8601 format (YYYY-MM-DD)
   * @param {Date|string} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return null;

    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    return d.toISOString().split('T')[0];
  }

  /**
   * Remove null/undefined values from object recursively
   * @param {Object} obj
   * @returns {Object}
   */
  cleanObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObject(item)).filter(item => item != null);
    }

    if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        const cleaned = this.cleanObject(value);
        if (cleaned != null && cleaned !== '' && !(Array.isArray(cleaned) && cleaned.length === 0)) {
          acc[key] = cleaned;
        }
        return acc;
      }, {});
    }

    return obj;
  }

  /**
   * Pull availability data from e-TALENTA (future implementation)
   * @returns {Promise<Array>}
   */
  async pullAvailability() {
    // TODO: Implement when e-TALENTA provides read API
    throw new Error('Pull availability not yet implemented for e-TALENTA');
  }

  /**
   * Pull profile data from e-TALENTA (future implementation)
   * @returns {Promise<Object>}
   */
  async pullProfile() {
    // TODO: Implement when e-TALENTA provides read API
    throw new Error('Pull profile not yet implemented for e-TALENTA');
  }
}

export default ETalentaAdapter;
