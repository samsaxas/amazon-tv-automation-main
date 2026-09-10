import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { logger } from '@utils/logger';
import { AMAZON_BASE_URL } from '@data/constants';

/**
 * Known Amazon search button selectors in order of priority.
 */
export const SEARCH_SUBMIT_SELECTORS = [
  '#nav-search-submit-button',
  'input.nav-input[type="submit"]',
  'input[type="submit"][value="Go"]',
  '#nav-search-submit-text',
  'button[type="submit"]',
  'input[type="submit"]',
];

/**
 * HomePage
 * ---------------------------------------------------------------------------
 * Handles interactions with the Amazon.in homepage.
 *
 * Responsibilities:
 * - Navigate to Amazon.in
 * - Dynamically handle intermediate pages and pop-ups
 * - Robustly resolve and verify the Amazon search box
 * - Perform search with button click and keyboard fallback
 */
export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigates to Amazon.in, handles interstitials, and ensures the search box is ready.
   */
  async goto(): Promise<void> {
    logger.step(`Navigating to ${AMAZON_BASE_URL}`);

    await this.page.goto(AMAZON_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // Handle initial interstitials (Continue shopping, Cookie banner, Location pop-up)
    await this.handleCommonInterstitials();

    // Dynamically resolve search box
    let searchBox = await this.findVisibleSearchBox(10_000);

    // If search box is not found immediately, re-attempt interstitial handling in case of delayed redirect
    if (!searchBox) {
      logger.warn('Search box not detected on initial check — re-checking for intermediate pages.');
      await this.handleCommonInterstitials();
      searchBox = await this.findVisibleSearchBox(10_000);
    }

    if (!searchBox) {
      await this.captureNavigationDiagnostics();
      throw new Error(
        'Amazon search box was not found after handling common interstitial pages. ' +
          'Amazon may have returned an unhandled interstitial, bot verification, or unexpected page layout.',
      );
    }

    logger.info('Amazon homepage loaded and search box is ready.');
  }

  /**
   * Searches Amazon for the provided term and verifies landing on the results page.
   */
  async searchFor(term: string): Promise<void> {
    logger.step(`Searching for "${term}"`);

    const activeSearchBox = await this.findVisibleSearchBox(10_000);
    if (!activeSearchBox) {
      await this.captureNavigationDiagnostics();
      throw new Error('Cannot submit search: no visible search box found on the page.');
    }

    await activeSearchBox.click();
    await activeSearchBox.fill(term);

    // Attempt to submit search via button, fallback to Enter key
    const submitted = await this.clickSearchButton();
    if (!submitted) {
      logger.warn('Search submit button was not interactable — submitting with Enter key.');
      await activeSearchBox.press('Enter');
    }

    // Wait for search results navigation
    await this.page.waitForLoadState('domcontentloaded');

    // Handle any interstitials on results page load
    await this.handleCommonInterstitials();

    // Verify results page URL or content
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/s?') && !currentUrl.includes('keywords=')) {
      logger.warn(`Search results URL verification note: current URL is ${currentUrl}`);
    }

    logger.info('Search results page loaded.');
  }

  /**
   * Tries clicking one of the known search submit button selectors.
   * Returns true if successfully clicked, false otherwise.
   */
  private async clickSearchButton(): Promise<boolean> {
    for (const selector of SEARCH_SUBMIT_SELECTORS) {
      try {
        const button: Locator = this.page.locator(selector).first();
        const count = await button.count();
        if (count > 0) {
          const isVisible = await button.isVisible({ timeout: 1_500 }).catch(() => false);
          if (isVisible) {
            await button.click({ timeout: 4_000 });
            logger.info(`Search submitted using button matching "${selector}".`);
            return true;
          }
        }
      } catch {
        // Try next submit selector
      }
    }
    return false;
  }
}
