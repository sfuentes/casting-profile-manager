import { PlatformConnector } from './PlatformConnector.js';

/**
 * Agencies the user deals with by hand. There is no site to automate against,
 * so this connector declares no sync capabilities at all.
 *
 * It exists so those platforms are represented in the registry like any other
 * rather than being special-cased by id in the controllers. Callers ask the
 * manifest what is supported and get a consistent NotSupportedError if they
 * try anyway.
 */
export class ManualConnector extends PlatformConnector {
  static forPlatform(id, name) {
    return class extends ManualConnector {
      static manifest = Object.freeze({
        id,
        key: `manual-${id}`,
        name,
        authType: 'manual',
        credentialFields: [],
        // Deliberately empty: nothing here can be automated.
        capabilities: []
      });
    };
  }

  /**
   * Recording a manual platform always "succeeds" - it is the user asserting
   * they have an account, not a login we verified. The message says so rather
   * than implying a check happened.
   */
  async verify() {
    return {
      ok: true,
      verified: false,
      message: 'Manual platform - recorded. There is nothing to log in to.'
    };
  }
}
