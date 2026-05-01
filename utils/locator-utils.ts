/**
 * locator-utils.ts — XPath locator registry
 *
 * Each spec/locator file registers its XPath map once at module level.
 * The singleton `locatorUtils` lets any file call `locatorUtils.pick('key')`
 * to retrieve the raw XPath string for use with `getLocator()`.
 *
 * Usage:
 *   import { locatorUtils } from '../utils/locator-utils';
 *
 *   const locatorMap = {
 *     saveButton: `//button[normalize-space()='Save']`,
 *     contactRow: `//a[contains(@title,'{NAME}')]`,
 *   };
 *   locatorUtils.register(locatorMap);
 *
 *   // In tests:
 *   page.locator(getLocator(locatorUtils.pick('saveButton')))
 *   page.locator(getLocator(locatorUtils.pick('contactRow').replace('{NAME}', name)))
 */

class LocatorUtils {
  private _map: Record<string, string> = {};

  /**
   * Register a locator map into the global registry.
   * Keys from multiple files are merged; last-write wins on collision.
   */
  register(map: Record<string, string>): void {
    Object.assign(this._map, map);
  }

  /**
   * Retrieve the XPath string for a registered key.
   * Throws if the key was never registered — prevents silent empty-string locators.
   */
  pick(key: string): string {
    const val = this._map[key];
    if (val === undefined) {
      throw new Error(
        `[LocatorUtils] Key "${key}" not found in registry. ` +
        `Call locatorUtils.register(locatorMap) before using pick().`
      );
    }
    return val;
  }

  /** Returns all currently registered keys (for debugging). */
  keys(): string[] {
    return Object.keys(this._map);
  }
}

export const locatorUtils = new LocatorUtils();
