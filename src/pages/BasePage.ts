import { Locator, Page } from '@playwright/test';
import { logger } from '@utils/logger';

/**
 * Known Amazon search box selectors in order of priority.
 */
export const SEARCH_BOX_SELECTORS = [
  '#twotabsearchtextbox',
  'input[name="field-keywords"]',
  'input[aria-label*="Search" i]',
  'input#nav-bb-search',
  'input.nav-input[type="text"]',
  '#nav-search-keywords',
];

/**
 * BasePage
 * ---------------------------------------------------------------------------
 * Base class for all page objects, providing:
 * - Robust Amazon interstitial handling (Continue Shopping, Captcha/Bot, Cookie Consent, Location).
 * - Multi-selector fallback resolution for search box and core navigation elements.
 * - Safe text extraction utilities for single and multiple elements.
 * - Comprehensive diagnostic capturing for CI and headless environments.
 */
export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Safely extracts text from a single locator.
   * Returns fallback string if element is not found, not visible, or fails to extract.
   */
  protected async safeText(locator: Locator, fallback = ''): Promise<string> {
    try {
      const isVisible = await locator.first().isVisible({ timeout: 3_000 }).catch(() => false);
      if (!isVisible) {
        return fallback;
      }
      const text = await locator.first().textContent({ timeout: 3_000 });
      return text?.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Safely extracts and cleans text from all matching elements of a locator.
   * Returns an array of non-empty strings.
   */
  protected async safeTextAll(locator: Locator): Promise<string[]> {
    try {
      const count = await locator.count();
      const results: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await locator.nth(i).textContent({ timeout: 2_000 }).catch(() => null);
        const cleaned = text?.replace(/\s+/g, ' ').trim();
        if (cleaned) {
          results.push(cleaned);
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Checks if any of the known Amazon search box fallback selectors are visible.
   */
  async isSearchBoxPresent(): Promise<boolean> {
    for (const selector of SEARCH_BOX_SELECTORS) {
      try {
        const loc = this.page.locator(selector).first();
        const isVisible = await loc.isVisible({ timeout: 1_000 });
        if (isVisible) {
          return true;
        }
      } catch {
        // Continue checking next fallback selector
      }
    }
    return false;
  }

  /**
   * Finds and returns the first usable, visible Amazon search box locator.
   * Returns null if none of the fallback selectors match or become visible.
   */
  async findVisibleSearchBox(timeoutMs = 15_000): Promise<Locator | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      for (const selector of SEARCH_BOX_SELECTORS) {
        try {
          const loc = this.page.locator(selector).first();
          const count = await loc.count();
          if (count > 0) {
            const isVisible = await loc.isVisible({ timeout: 500 });
            if (isVisible) {
              return loc;
            }
          }
        } catch {
          // Check next selector
        }
      }
      await this.page.waitForTimeout(500);
    }
    return null;
  }

  /**
   * Handles common Amazon pop-ups and intermediate pages that may appear
   * before the actual page content becomes available.
   *
   * Sequence:
   * 1. Continue shopping interstitial (with retry loop)
   * 2. Cookie consent banner
   * 3. Delivery location popup
   * 4. Re-check continue shopping page in case of dynamic re-render
   */
  async handleCommonInterstitials(): Promise<void> {
    await this.handleContinueShoppingPage();
    await this.handleCookieConsent();
    await this.handleDeliveryLocationPopup();

    // Re-check Continue Shopping interstitial if search box is still not visible
    const hasSearchBox = await this.isSearchBoxPresent();
    if (!hasSearchBox) {
      await this.handleContinueShoppingPage();
    }
  }

  /**
   * Handles Amazon's "Continue shopping" intermediate page with a retry loop.
   * Detects the intermediate page using multiple robust selectors and page content analysis.
   */
  protected async handleContinueShoppingPage(maxAttempts = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 1. If normal Amazon search box is already present, no interstitial needs handling
      const hasSearchBox = await this.isSearchBoxPresent();
      if (hasSearchBox) {
        return;
      }

      // 2. Detect intermediate page indicators
      const isIntermediatePage = await this.detectContinueShoppingPage();
      if (!isIntermediatePage) {
        // Neither search box nor continue shopping page detected on this attempt
        return;
      }

      logger.info(
        `Amazon "Continue shopping" page detected (attempt ${attempt}/${maxAttempts}) — clicking continue.`,
      );

      const clicked = await this.clickContinueShoppingButton();
      if (!clicked) {
        logger.warn(
          `Detected "Continue shopping" page but could not click the button on attempt ${attempt}.`,
        );
      }

      // Wait for content change/navigation
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      await this.page.waitForTimeout(1_500);

      // Verify if search box appeared after clicking
      const searchBoxNowVisible = await this.isSearchBoxPresent();
      if (searchBoxNowVisible) {
        logger.info(
          `Successfully navigated past "Continue shopping" page to normal Amazon page on attempt ${attempt}.`,
        );
        return;
      }
    }
  }

  /**
   * Detects whether the current page is an Amazon "Continue shopping" interstitial.
   */
  private async detectContinueShoppingPage(): Promise<boolean> {
    try {
      // Check for button/link elements
      const continueBtn = this.getContinueShoppingLocator();
      const count = await continueBtn.count();
      if (count > 0) {
        const isVisible = await continueBtn.first().isVisible({ timeout: 1_500 }).catch(() => false);
        if (isVisible) {
          return true;
        }
      }

      // Check body text for key interstitial phrases
      const bodyText = await this.page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
      const normalizedBody = bodyText.replace(/\s+/g, ' ').toLowerCase();

      const hasContinueText =
        normalizedBody.includes('click the button below to continue shopping') ||
        normalizedBody.includes('continue shopping') ||
        normalizedBody.includes('conditions of use & sale') && normalizedBody.includes('privacy notice') && normalizedBody.length < 1000;

      return hasContinueText;
    } catch {
      return false;
    }
  }

  /**
   * Returns a locator matching candidate Continue Shopping buttons/links.
   */
  private getContinueShoppingLocator(): Locator {
    return this.page.locator(
      'button:has-text("Continue shopping"), a:has-text("Continue shopping"), input[value*="Continue" i], button:has-text("Continue"), a[href*="continue"], form button[type="submit"], form input[type="submit"]',
    );
  }

  /**
   * Clicks the Continue Shopping button using multiple selector strategies.
   */
  private async clickContinueShoppingButton(): Promise<boolean> {
    const candidateLocators = [
      this.page.getByRole('button', { name: /continue shopping/i }),
      this.page.getByRole('link', { name: /continue shopping/i }),
      this.page.getByText(/continue shopping/i),
      this.page.locator('button:has-text("Continue shopping")'),
      this.page.locator('a:has-text("Continue shopping")'),
      this.page.locator('input[value*="Continue" i]'),
      this.page.locator('button:has-text("Continue")'),
      this.page.locator('form input[type="submit"]'),
      this.page.locator('form button[type="submit"]'),
    ];

    for (const locator of candidateLocators) {
      try {
        const count = await locator.count();
        if (count > 0) {
          const isVisible = await locator.first().isVisible({ timeout: 1_000 }).catch(() => false);
          if (isVisible) {
            await locator.first().click({ timeout: 3_000 });
            logger.info('"Continue shopping" button clicked.');
            return true;
          }
        }
      } catch (err) {
        logger.warn(`Click attempt on Continue Shopping locator failed: ${(err as Error).message}`);
      }
    }
    return false;
  }

  /**
   * Handles Amazon's cookie consent banner with short bounded checks.
   */
  private async handleCookieConsent(): Promise<void> {
    const cookieSelectors = [
      '#sp-cc-accept',
      'input[name="accept"]',
      '#sp-cc-accept-custom',
      'button[id*="sp-cc-accept"]',
    ];

    for (const selector of cookieSelectors) {
      try {
        const button = this.page.locator(selector).first();
        const count = await button.count();
        if (count > 0) {
          const isVisible = await button.isVisible({ timeout: 1_500 }).catch(() => false);
          if (isVisible) {
            logger.info('Cookie consent banner detected — accepting.');
            await button.click({ timeout: 3_000 });
            logger.info('Cookie consent accepted.');
            return;
          }
        }
      } catch (err) {
        logger.warn(`Cookie consent interaction failed on selector "${selector}": ${(err as Error).message}`);
      }
    }
  }

  /**
   * Handles the delivery location pop-up with short bounded checks.
   */
  private async handleDeliveryLocationPopup(): Promise<void> {
    const closeButtons = [
      this.page.locator('#GLUXClose'),
      this.page.locator('button[aria-label="Close"]'),
      this.page.locator('.a-popover-header-close'),
      this.page.locator('input[data-action-type="DISMISS"]'),
      this.page.locator('span[data-action="a-popover-close"]'),
      this.page.locator('#glow-toaster-body input[type="submit"]'),
    ];

    for (const button of closeButtons) {
      try {
        const count = await button.count();
        if (count > 0) {
          const isVisible = await button.first().isVisible({ timeout: 1_000 }).catch(() => false);
          if (isVisible) {
            logger.info('Delivery location pop-up detected — closing.');
            await button.first().click({ timeout: 2_000 });
            logger.info('Delivery location pop-up closed.');
            return;
          }
        }
      } catch (err) {
        logger.warn(`Delivery popup close attempt failed: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Captures detailed diagnostic information when navigation or element resolution fails.
   */
  async captureNavigationDiagnostics(): Promise<void> {
    try {
      const currentUrl = this.page.url();
      const pageTitle = await this.page.title().catch(() => '(unknown title)');

      const bodyText = await this.page.locator('body').innerText({ timeout: 3_000 }).catch(() => '');
      const normalizedBody = bodyText.replace(/\s+/g, ' ').trim();
      const html = await this.page.content().catch(() => '');

      logger.warn('========== NAVIGATION DIAGNOSTICS ==========');
      logger.warn(`Current URL: ${currentUrl}`);
      logger.warn(`Page title: ${pageTitle}`);
      logger.warn(`Page HTML length: ${html.length} chars`);
      logger.warn(`Page body preview: ${normalizedBody.slice(0, 500)}`);

      // Classify page type
      const isContinueShopping = await this.detectContinueShoppingPage();
      const isCaptcha =
        html.includes('validateCaptcha') ||
        html.includes('Enter the characters you see below') ||
        html.includes('Type the characters you see in this image');
      const isBotBlocked =
        html.includes('automated access') ||
        html.includes('Sorry, we just need to make sure you\'re not a robot');

      logger.warn(`Diagnostic classification:`);
      logger.warn(`- Continue shopping interstitial detected: ${isContinueShopping}`);
      logger.warn(`- CAPTCHA page detected: ${isCaptcha}`);
      logger.warn(`- Bot/Robot access block detected: ${isBotBlocked}`);

      // Inspect matching counts for each search selector
      logger.warn('Search box fallback selector scan:');
      for (const selector of SEARCH_BOX_SELECTORS) {
        try {
          const loc = this.page.locator(selector);
          const count = await loc.count();
          const visible = count > 0 ? await loc.first().isVisible({ timeout: 500 }).catch(() => false) : false;
          logger.warn(`  - "${selector}": found ${count} (visible: ${visible})`);
        } catch {
          logger.warn(`  - "${selector}": check error`);
        }
      }

      await this.page.screenshot({
        path: 'test-results/navigation-failure.png',
        fullPage: true,
      }).catch(() => {});

      logger.info('Navigation diagnostic screenshot saved to test-results/navigation-failure.png');
      logger.warn('============================================');
    } catch (error) {
      logger.warn(`Unable to capture full navigation diagnostics: ${String(error)}`);
    }
  }
}
