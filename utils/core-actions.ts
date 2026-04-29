/**
 * core-actions.ts — XPath locator factory
 *
 * `getLocator` converts a raw XPath string into a Playwright-compatible
 * `xpath=` selector string. Pair it with `locatorUtils.pick()` to get a
 * fully traced, map-backed locator.
 *
 * Usage:
 *   import { getLocator } from '../utils/core-actions';
 *   import { locatorUtils } from '../utils/locator-utils';
 *
 *   // Static locator
 *   page.locator(getLocator(locatorUtils.pick('saveButton')))
 *
 *   // Parameterised locator
 *   page.locator(getLocator(locatorUtils.pick('contactRow').replace('{NAME}', contactName)))
 *
 * Why a string and not a Locator?
 *   Returning a string keeps the factory page-agnostic so the same export
 *   works in beforeEach, inside test(), and in helper functions without
 *   needing to thread `page` through every call.
 */

/**
 * Wraps an XPath expression in the `xpath=` prefix required by Playwright.
 * Pass the result directly to `page.locator()`.
 */
export function getLocator(xpath: string): string {
  if (!xpath) {
    throw new Error('[getLocator] Empty XPath string — check locatorUtils.pick() returned a value.');
  }
  return `xpath=${xpath}`;
}
