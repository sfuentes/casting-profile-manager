import { logger } from '../../utils/logger.js';
import BrowserPoolManager from './BrowserPoolManager.js';

/**
 * Agent Orchestrator
 * Manages and coordinates all platform agents
 */
export class AgentOrchestrator {
  constructor(config = {}) {
    this.config = {
      maxConcurrentOperations: config.maxConcurrentOperations || 5,
      operationTimeout: config.operationTimeout || 60000,
      ...config
    };

    this.agents = new Map();
    this.browserPool = new BrowserPoolManager(config.browserPool);
    this.activeOperations = new Map();
    this.operationQueue = [];

    logger.info('AgentOrchestrator initialized', {
      maxConcurrentOperations: this.config.maxConcurrentOperations
    });
  }

  /**
   * Register a platform agent
   */
  registerAgent(platformId, AgentClass) {
    if (!platformId || !AgentClass) {
      throw new Error('Platform ID and Agent class are required');
    }

    this.agents.set(platformId, AgentClass);
    logger.info(`Agent registered for platform ${platformId}`, {
      agentName: AgentClass.name
    });
  }

  /**
   * Get agent instance for platform
   */
  async getAgent(platformId) {
    const AgentClass = this.agents.get(platformId);

    if (!AgentClass) {
      throw new Error(`No agent registered for platform: ${platformId}`);
    }

    // Create agent instance
    const agent = new AgentClass();

    // Set browser if agent needs it (web scraping agents)
    if (agent.needsBrowser !== false) {
      const browser = await this.browserPool.getBrowser();
      agent.setBrowser(browser);
    }

    return agent;
  }

  /**
   * Release agent resources
   */
  async releaseAgent(agent) {
    try {
      // Release browser back to pool if agent was using one
      if (agent.browser) {
        await this.browserPool.releaseBrowser(agent.browser);
      }

      // Cleanup agent
      await agent.cleanup();
    } catch (error) {
      logger.error('Error releasing agent', {
        platform: agent.platformName,
        error: error.message
      });
    }
  }

  /**
   * Execute operation with agent
   */
  async executeOperation(platformId, operation, ...args) {
    const operationId = this.generateOperationId();

    logger.info(`Queuing operation ${operation} for platform ${platformId}`, {
      operationId
    });

    // Check if we can execute immediately
    if (this.activeOperations.size < this.config.maxConcurrentOperations) {
      return this.runOperation(operationId, platformId, operation, args);
    }

    // Queue the operation
    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        operationId,
        platformId,
        operation,
        args,
        resolve,
        reject
      });

      logger.debug(`Operation queued`, {
        operationId,
        queueLength: this.operationQueue.length
      });
    });
  }

  /**
   * Run operation
   */
  async runOperation(operationId, platformId, operation, args) {
    let agent;

    try {
      // Mark operation as active
      this.activeOperations.set(operationId, {
        platformId,
        operation,
        startTime: Date.now()
      });

      logger.info(`Starting operation ${operation} for platform ${platformId}`, {
        operationId,
        activeOperations: this.activeOperations.size
      });

      // Get agent
      agent = await this.getAgent(platformId);

      // Execute operation with timeout
      const result = await this.withTimeout(
        agent[operation](...args),
        this.config.operationTimeout,
        `Operation ${operation} timed out`
      );

      logger.info(`Operation ${operation} completed successfully`, {
        operationId,
        platform: agent.platformName
      });

      return result;
    } catch (error) {
      logger.error(`Operation ${operation} failed`, {
        operationId,
        platformId,
        error: error.message
      });

      throw error;
    } finally {
      // Release agent and mark operation as complete
      if (agent) {
        await this.releaseAgent(agent);
      }

      this.activeOperations.delete(operationId);

      // Process next operation in queue
      this.processQueue();
    }
  }

  /**
   * Process operation queue
   */
  processQueue() {
    if (this.operationQueue.length === 0) {
      return;
    }

    if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
      return;
    }

    const nextOperation = this.operationQueue.shift();
    if (!nextOperation) {
      return;
    }

    logger.debug('Processing queued operation', {
      operationId: nextOperation.operationId,
      remainingInQueue: this.operationQueue.length
    });

    this.runOperation(
      nextOperation.operationId,
      nextOperation.platformId,
      nextOperation.operation,
      nextOperation.args
    )
      .then(nextOperation.resolve)
      .catch(nextOperation.reject);
  }

  /**
   * Test connection to platform
   */
  async testConnection(platformId, credentials) {
    return this.executeOperation(platformId, 'testConnection', credentials);
  }

  /**
   * Sync profile to platform
   */
  async syncProfile(platformId, credentials, profileData) {
    return this.executeOperation(platformId, 'syncProfile', credentials, profileData);
  }

  /**
   * Update availability on platform
   */
  async updateAvailability(platformId, credentials, availability) {
    return this.executeOperation(platformId, 'updateAvailability', credentials, availability);
  }

  /**
   * Upload media to platform
   */
  async uploadMedia(platformId, credentials, media) {
    return this.executeOperation(platformId, 'uploadMedia', credentials, media);
  }

  /**
   * Read profile from platform
   */
  async readProfile(platformId, credentials) {
    return this.executeOperation(platformId, 'readProfile', credentials);
  }

  /**
   * Bulk sync to multiple platforms
   */
  async bulkSync(platforms, operation, ...args) {
    logger.info(`Starting bulk ${operation} for ${platforms.length} platforms`);

    const results = await Promise.allSettled(
      platforms.map((platform) =>
        this.executeOperation(platform.platformId, operation, platform.credentials, ...args)
      )
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.filter((r) => r.status === 'rejected').length;

    logger.info(`Bulk ${operation} completed`, {
      total: platforms.length,
      successful: successCount,
      failed: failureCount
    });

    return {
      total: platforms.length,
      successful: successCount,
      failed: failureCount,
      results: results.map((result, index) => ({
        platformId: platforms[index].platformId,
        platformName: platforms[index].name,
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }

  /**
   * Get agent metrics for platform
   */
  async getAgentMetrics(platformId) {
    try {
      const agent = await this.getAgent(platformId);
      const metrics = agent.getMetrics();
      await this.releaseAgent(agent);

      return metrics;
    } catch (error) {
      logger.error(`Failed to get metrics for platform ${platformId}`, {
        error: error.message
      });

      return null;
    }
  }

  /**
   * Get all agent metrics
   */
  async getAllMetrics() {
    const platformIds = Array.from(this.agents.keys());
    const metricsPromises = platformIds.map((id) => this.getAgentMetrics(id));
    const metricsResults = await Promise.allSettled(metricsPromises);

    return metricsResults
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => result.value);
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    return {
      registeredAgents: this.agents.size,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      maxConcurrentOperations: this.config.maxConcurrentOperations,
      browserPool: this.browserPool.getStats(),
      activeOperationDetails: Array.from(this.activeOperations.entries()).map(
        ([id, details]) => ({
          operationId: id,
          platformId: details.platformId,
          operation: details.operation,
          duration: Date.now() - details.startTime
        })
      )
    };
  }

  /**
   * Execute with timeout
   */
  async withTimeout(promise, timeoutMs, errorMessage) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      })
    ]);
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if platform is supported
   */
  isPlatformSupported(platformId) {
    return this.agents.has(platformId);
  }

  /**
   * Get list of supported platforms
   */
  getSupportedPlatforms() {
    return Array.from(this.agents.keys());
  }

  /**
   * Cleanup and shutdown orchestrator
   */
  async cleanup() {
    logger.info('Cleaning up AgentOrchestrator');

    // Wait for active operations to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeOperations.size > 0 && Date.now() - startTime < timeout) {
      logger.info(`Waiting for ${this.activeOperations.size} active operations to complete`);
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }

    if (this.activeOperations.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeOperations.size} operations still active`);
    }

    // Clear queue
    this.operationQueue = [];

    // Cleanup browser pool
    await this.browserPool.cleanup();

    logger.info('AgentOrchestrator cleanup completed');
  }
}

export default AgentOrchestrator;
