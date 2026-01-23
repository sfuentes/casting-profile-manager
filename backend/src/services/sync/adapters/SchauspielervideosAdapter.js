import axios from 'axios';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

/**
 * Schauspielervideos Platform Adapter
 * Platform ID: 3
 * Type: API-based integration
 * Features: Profile, Videos, Photos, Showreel
 * Regions: DE, AT, CH
 */
export class SchauspielerVideosAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);

    // Schauspielervideos API configuration
    this.apiBaseUrl = process.env.SCHAUSPIELERVIDEOS_API_URL || 'https://api.schauspielervideos.de/v2';
    this.apiClient = null;
    this.apiKey = null;
  }

  /**
   * Initialize rate limiter
   * Schauspielervideos allows 50 requests per minute
   */
  initRateLimiter() {
    return new (require('rate-limiter-flexible').RateLimiterMemory)({
      points: 50,
      duration: 60,
    });
  }

  /**
   * Authenticate with Schauspielervideos API
   * @returns {Promise<boolean>}
   */
  async authenticate() {
    try {
      this.log('info', 'Authenticating with Schauspielervideos API');

      // Check if API key exists
      if (!this.credentials || !this.credentials.apiKey) {
        throw new Error('Missing Schauspielervideos API key');
      }

      this.apiKey = this.credentials.apiKey;

      // Initialize API client
      this.apiClient = axios.create({
        baseURL: this.apiBaseUrl,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      // Test API key validity
      const response = await this.apiClient.get('/profile/me');

      if (!response.data || response.status !== 200) {
        throw new Error('Invalid API key or authentication failed');
      }

      this.log('info', 'Successfully authenticated with Schauspielervideos');
      return true;

    } catch (error) {
      this.log('error', 'Schauspielervideos authentication failed', {
        error: error.message,
        statusCode: error.response?.status
      });
      throw new Error(`Schauspielervideos authentication failed: ${error.message}`);
    }
  }

  /**
   * Push availability data to Schauspielervideos
   * Note: Schauspielervideos doesn't typically manage availability
   * @param {Array} availability
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    this.log('warn', 'Schauspielervideos does not support availability sync');

    return {
      success: true,
      count: 0,
      message: 'Schauspielervideos does not manage availability data'
    };
  }

  /**
   * Push media (videos/photos) to Schauspielervideos
   * @param {Object} media
   * @returns {Promise<Object>}
   */
  async pushMedia(media) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Uploading media to Schauspielervideos', {
          type: media.type,
          filename: media.filename
        });

        if (!this.apiClient) {
          throw new Error('API client not initialized. Call authenticate() first.');
        }

        // Determine media type
        const isVideo = media.type === 'video' || media.mimeType?.includes('video');

        // Create form data for file upload
        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        formData.append('file', media.buffer, {
          filename: media.filename,
          contentType: media.mimeType
        });

        formData.append('type', isVideo ? 'video' : 'photo');

        if (media.title) {
          formData.append('title', media.title);
        }

        if (media.description) {
          formData.append('description', media.description);
        }

        if (media.category) {
          formData.append('category', media.category);
        }

        // Set as showreel if specified
        if (media.isShowreel) {
          formData.append('is_showreel', 'true');
        }

        // Upload to Schauspielervideos
        const endpoint = isVideo ? '/media/videos' : '/media/photos';
        const response = await this.apiClient.post(endpoint, formData, {
          headers: {
            ...formData.getHeaders(),
            'X-API-Key': this.apiKey
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 120000 // 2 minutes for video uploads
        });

        this.log('info', 'Successfully uploaded media to Schauspielervideos', {
          externalId: response.data.id,
          url: response.data.url,
          type: isVideo ? 'video' : 'photo'
        });

        return {
          success: true,
          externalId: response.data.id,
          url: response.data.url,
          thumbnailUrl: response.data.thumbnail_url
        };
      });
    });
  }

  /**
   * Update profile information on Schauspielervideos
   * @param {Object} profile
   * @returns {Promise<Object>}
   */
  async updateProfile(profile) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Updating profile on Schauspielervideos');

        if (!this.apiClient) {
          throw new Error('API client not initialized. Call authenticate() first.');
        }

        // Transform profile data
        const schauspielerProfile = this.transformProfile(profile);

        // Update profile via API
        const response = await this.apiClient.patch('/profile', schauspielerProfile);

        this.log('info', 'Successfully updated profile on Schauspielervideos', {
          profileId: response.data.id
        });

        return {
          success: true,
          profileId: response.data.id,
          updatedFields: Object.keys(schauspielerProfile)
        };
      });
    });
  }

  /**
   * Transform internal profile format to Schauspielervideos format
   * @param {Object} profile
   * @returns {Object}
   */
  transformProfile(profile) {
    const schauspielerProfile = {
      // Basic information
      stage_name: profile.stageName || profile.name,
      first_name: profile.name?.split(' ')[0],
      last_name: profile.name?.split(' ').slice(1).join(' '),
      biography: profile.biography,

      // Physical attributes
      height_cm: this.parseHeight(profile.height),
      weight_kg: profile.weight ? parseInt(profile.weight) : null,
      eye_color: profile.eyeColor?.toLowerCase(),
      hair_color: profile.hairColor?.toLowerCase(),
      gender: profile.gender?.toLowerCase(),

      // Location
      city: profile.city,
      country: profile.country,

      // Languages
      languages: profile.languages?.map(lang => ({
        language_code: this.getLanguageCode(lang.language),
        proficiency: this.mapLanguageLevel(lang.level)
      })) || [],

      // Skills and specializations
      skills: profile.skills || [],
      specializations: profile.specializations || [],

      // Filmography/Work history
      filmography: profile.workHistory?.map(work => ({
        title: work.production || work.title,
        role: work.role,
        year: work.year,
        type: this.mapWorkType(work.type),
        director: work.director,
        production_company: work.productionCompany
      })) || [],

      // Training
      training: profile.education?.filter(edu =>
        edu.type === 'training' || edu.institution?.toLowerCase().includes('schauspiel')
      ).map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        year: edu.year,
        description: edu.description
      })) || []
    };

    return this.cleanObject(schauspielerProfile);
  }

  /**
   * Parse height to cm
   * @param {string} height
   * @returns {number|null}
   */
  parseHeight(height) {
    if (!height) return null;

    const match = height.match(/(\d+)/);
    if (!match) return null;

    const value = parseInt(match[1]);

    if (height.toLowerCase().includes('cm')) {
      return value;
    }

    if (value < 10) {
      const inches = height.match(/['"](\d+)/)?.[1] || 0;
      return Math.round((value * 12 + parseInt(inches)) * 2.54);
    }

    return value;
  }

  /**
   * Map work type to Schauspielervideos categories
   * @param {string} type
   * @returns {string}
   */
  mapWorkType(type) {
    const typeMap = {
      'film': 'feature_film',
      'movie': 'feature_film',
      'tv': 'television',
      'television': 'television',
      'series': 'tv_series',
      'theater': 'theater',
      'theatre': 'theater',
      'commercial': 'commercial',
      'short': 'short_film',
      'short film': 'short_film',
      'web': 'web_series',
      'voice': 'voice_acting'
    };
    return typeMap[type?.toLowerCase()] || 'other';
  }

  /**
   * Get ISO language code
   * @param {string} language
   * @returns {string}
   */
  getLanguageCode(language) {
    const languageMap = {
      'german': 'de',
      'deutsch': 'de',
      'english': 'en',
      'englisch': 'en',
      'french': 'fr',
      'französisch': 'fr',
      'spanish': 'es',
      'spanisch': 'es',
      'italian': 'it',
      'italienisch': 'it'
    };
    return languageMap[language?.toLowerCase()] || language?.toLowerCase().slice(0, 2);
  }

  /**
   * Map language level
   * @param {string} level
   * @returns {string}
   */
  mapLanguageLevel(level) {
    const levelMap = {
      'native': 'native',
      'muttersprache': 'native',
      'fluent': 'fluent',
      'fließend': 'fluent',
      'advanced': 'advanced',
      'fortgeschritten': 'advanced',
      'intermediate': 'intermediate',
      'mittel': 'intermediate',
      'basic': 'basic',
      'grundkenntnisse': 'basic'
    };
    return levelMap[level?.toLowerCase()] || 'basic';
  }

  /**
   * Remove null/undefined values from object
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
   * Pull profile data from Schauspielervideos (future implementation)
   * @returns {Promise<Object>}
   */
  async pullProfile() {
    try {
      if (!this.apiClient) {
        throw new Error('API client not initialized. Call authenticate() first.');
      }

      const response = await this.apiClient.get('/profile/me');

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      this.log('error', 'Failed to pull profile from Schauspielervideos', {
        error: error.message
      });
      throw error;
    }
  }
}

export default SchauspielerVideosAdapter;
