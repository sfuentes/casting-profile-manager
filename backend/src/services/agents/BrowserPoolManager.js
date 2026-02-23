import puppeteer from 'puppeteer';
import { logger } from '../../utils/logger.js';

/**
 * Browser Pool Manager
 * Manages a pool of reusable browser instances for web scraping agents
 */
export class BrowserPoolManager {
  constructor(config = {}) {
    this.config = {
      maxBrowsers: config.maxBrowsers || 3,
      maxPagesPerBrowser: config.maxPagesPerBrowser || 5,
      browserIdleTimeout: config.browserIdleTimeout || 5 * 60 * 1000, // 5 minutes
      headless: config.headless !== false,
      ...config
    };

    this.browsers = [];
    this.availableBrowsers = [];
    this.idleTimers = new Map();

    logger.info('BrowserPoolManager initialized', {
      maxBrowsers: this.config.maxBrowsers,
      headless: this.config.headless
    });
  }

  /**
   * Get browser instance from pool
   */
  async getBrowser() {
    // Check if there's an available browser
    if (this.availableBrowsers.length > 0) {
      const browser = this.availableBrowsers.pop();

      // Clear idle timeout
      if (this.idleTimers.has(browser)) {
        clearTimeout(this.idleTimers.get(browser));
        this.idleTimers.delete(browser);
      }

      // Verify browser is still connected
      if (browser.isConnected()) {
        logger.debug('Reusing existing browser from pool');
        return browser;
      }

      // Browser disconnected, remove it
      logger.warn('Browser in pool was disconnected, creating new one');
      this.browsers = this.browsers.filter((b) => b !== browser);
    }

    // Create new browser if under limit
    if (this.browsers.length < this.config.maxBrowsers) {
      const browser = await this.createBrowser();
      this.browsers.push(browser);
      logger.info('Created new browser', {
        totalBrowsers: this.browsers.length,
        maxBrowsers: this.config.maxBrowsers
      });
      return browser;
    }

    // Wait for a browser to become available
    logger.info('Browser pool at capacity, waiting for available browser');
    return this.waitForAvailableBrowser();
  }

  /**
   * Create new browser instance
   */
  async createBrowser() {
    try {
      const browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080
        }
      });

      // Handle browser disconnection
      browser.on('disconnected', () => {
        logger.warn('Browser disconnected from pool');
        this.browsers = this.browsers.filter((b) => b !== browser);
        this.availableBrowsers = this.availableBrowsers.filter((b) => b !== browser);
        if (this.idleTimers.has(browser)) {
          clearTimeout(this.idleTimers.get(browser));
          this.idleTimers.delete(browser);
        }
      });

      logger.info('Browser created successfully');
      return browser;
    } catch (error) {
      logger.error('Failed to create browser', { error: error.message });
      throw new Error(`Failed to create browser: ${error.message}`);
    }
  }

  /**
   * Release browser back to pool
   */
  async releaseBrowser(browser) {
    if (!browser || !browser.isConnected()) {
      return;
    }

    // Close all pages except the first one
    const pages = await browser.pages();
    for (let i = 1; i < pages.length; i += 1) {
      try {
        await pages[i].close();
      } catch (error) {
        logger.warn('Error closing page', { error: error.message });
      }
    }

    // Add to available pool
    if (!this.availableBrowsers.includes(browser)) {
      this.availableBrowsers.push(browser);
      logger.debug('Browser released back to pool', {
        availableBrowsers: this.availableBrowsers.length
      });

      // Set idle timeout
      const timeout = setTimeout(() => {
        this.closeIdleBrowser(browser);
      }, this.config.browserIdleTimeout);

      this.idleTimers.set(browser, timeout);
    }
  }

  /**
   * Close idle browser
   */
  async closeIdleBrowser(browser) {
    try {
      if (browser.isConnected()) {
        await browser.close();
        logger.info('Closed idle browser');
      }

      this.browsers = this.browsers.filter((b) => b !== browser);
      this.availableBrowsers = this.availableBrowsers.filter((b) => b !== browser);
      this.idleTimers.delete(browser);
    } catch (error) {
      logger.error('Error closing idle browser', { error: error.message });
    }
  }

  /**
   * Wait for available browser
   */
  async waitForAvailableBrowser() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.availableBrowsers.length > 0) {
          clearInterval(checkInterval);
          resolve(this.getBrowser());
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(this.createBrowser());
      }, 30000);
    });
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalBrowsers: this.browsers.length,
      availableBrowsers: this.availableBrowsers.length,
      activeBrowsers: this.browsers.length - this.availableBrowsers.length,
      maxBrowsers: this.config.maxBrowsers,
      connectedBrowsers: this.browsers.filter((b) => b.isConnected()).length
    };
  }

  /**
   * Close all browsers
   */
  async closeAll() {
    logger.info('Closing all browsers in pool');

    // Clear all idle timers
    for (const timeout of this.idleTimers.values()) {
      clearTimeout(timeout);
    }
    this.idleTimers.clear();

    // Close all browsers
    const closePromises = this.browsers.map(async (browser) => {
      try {
        if (browser.isConnected()) {
          await browser.close();
        }
      } catch (error) {
        logger.error('Error closing browser', { error: error.message });
      }
    });

    await Promise.all(closePromises);

    this.browsers = [];
    this.availableBrowsers = [];

    logger.info('All browsers closed');
  }

  /**
   * Cleanup and close pool
   */
  async cleanup() {
    await this.closeAll();
  }
}

export default BrowserPoolManager;
