import { Page } from '@playwright/test';

import { BasePage } from './BasePage';

import { logger } from '@utils/logger';

/**
 * Shape of the data captured from a single product detail page.
 */
export interface ProductDetails {
  title: string;
  price: string;
  rating: string;
  aboutThisItem: string[];
  specifications: Record<string, string>;
}

/**
 * ProductPage
 * ---------------------------------------------------------------------------
 * Encapsulates scraping of the Amazon.in Product Detail Page (PDP):
 *
 * - Product title
 * - Price
 * - Customer rating
 * - About this item
 * - Product specifications / information
 */
export class ProductPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Waits until the core PDP content has rendered.
   */
  async waitForLoad(): Promise<void> {
    await this.handleCommonInterstitials();

    await this.page
      .locator(
        '#productTitle, #title, #centerCol, #dp-container',
      )
      .first()
      .waitFor({
        state: 'visible',
        timeout: 30_000,
      });
  }

  /**
   * Extracts the product title.
   */
  async getTitle(): Promise<string> {
    return this.safeText(
      this.page
        .locator('#productTitle, #title, h1#title')
        .first(),
      'Not available',
    );
  }

  /**
   * Extracts the displayed product price.
   */
  async getPrice(): Promise<string> {
    const candidates = [
      this.page
        .locator('.a-price .a-offscreen')
        .first(),

      this.page
        .locator(
          '#corePrice_feature_div .a-price .a-offscreen',
        )
        .first(),

      this.page
        .locator(
          '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        )
        .first(),

      this.page
        .locator(
          '#priceblock_ourprice, #priceblock_dealprice',
        )
        .first(),

      this.page
        .locator('span.a-price-whole')
        .first(),

      this.page
        .locator('.a-price .a-price-whole')
        .first(),
    ];

    for (const candidate of candidates) {
      const text = await this.safeText(candidate, '');

      if (text) {
        return text;
      }
    }

    return 'Not available';
  }

  /**
   * Extracts the average customer rating and review count.
   */
  async getRating(): Promise<string> {
    const starText = await this.safeText(
      this.page
        .locator(
          '#acrPopover, i.a-icon-star span.a-icon-alt, span[data-hook="rating-out-of-text"]',
        )
        .first(),
      '',
    );

    const countText = await this.safeText(
      this.page
        .locator(
          '#acrCustomerReviewText, span[data-hook="total-review-count"]',
        )
        .first(),
      '',
    );

    if (!starText && !countText) {
      return 'Not available';
    }

    return [starText, countText]
      .filter(Boolean)
      .join(' | ');
  }

  /**
   * Extracts the "About this item" bullet list.
   */
  async getAboutThisItem(): Promise<string[]> {
    const selectors = [
      '#feature-bullets ul li span.a-list-item',
      '#feature-bullets li span',
      '#aboutThisItemSection li',
      'div#aboutThisItemSection li',
    ];

    for (const selector of selectors) {
      const items = await this.safeTextAll(
        this.page.locator(selector),
      );

      if (items.length > 0) {
        return items;
      }
    }

    return [];
  }

  /**
   * Extracts product specification / product information
   * key-value pairs.
   */
  async getSpecifications(): Promise<Record<string, string>> {
    try {
      const specs = await this.page.evaluate(() => {
        const result: Record<string, string> = {};

        /*
         * 1. Product specification / overview tables.
         */
        const tableRows = document.querySelectorAll(
          [
            '#productDetails_techSpec_section_1 tr',
            '#productDetails_detailBullets_sections1 tr',
            '#prodDetails table tr',
            'table.a-keyvalue tr',
            '#productOverview_feature_div tr',
            '#poExpander tr',
            '#productDetails_db_sections table tr',
          ].join(', '),
        );

        tableRows.forEach((row) => {
          const keyElement = row.querySelector(
            'th, td.a-color-secondary, td:first-child',
          );

          const valueElement = row.querySelector(
            'td:last-child',
          );

          if (!keyElement || !valueElement) {
            return;
          }

          const key = (
            keyElement.textContent || ''
          )
            .replace(/\s+/g, ' ')
            .trim();

          const value = (
            valueElement.textContent || ''
          )
            .replace(/\s+/g, ' ')
            .trim();

          if (
            key &&
            value &&
            key !== value
          ) {
            result[key] = value;
          }
        });

        /*
         * 2. Detail bullets.
         */
        if (Object.keys(result).length === 0) {
          const bullets = document.querySelectorAll(
            [
              '#detailBulletsWrapper_feature_div li',
              '#detailBullets_feature_div li',
            ].join(', '),
          );

          bullets.forEach((li) => {
            const raw = (
              li.textContent || ''
            )
              .replace(/\s+/g, ' ')
              .trim();

            const index = raw.indexOf(':');

            if (index === -1) {
              return;
            }

            const key = raw
              .slice(0, index)
              .trim();

            const value = raw
              .slice(index + 1)
              .trim();

            if (key && value) {
              result[key] = value;
            }
          });
        }

        return result;
      });

      if (Object.keys(specs).length === 0) {
        logger.warn(
          'No product specification table/list was found on this PDP layout.',
        );
      }

      return specs;
    } catch {
      logger.warn(
        'Failed to extract product specifications.',
      );

      return {};
    }
  }

  /**
   * Detects the product's actual screen size.
   *
   * Checks:
   * 1. Product specifications
   * 2. Product title in inches
   * 3. Product title in centimeters
   */
  async detectScreenSize(
    titleText?: string,
    specs?: Record<string, string>,
  ): Promise<number | null> {
    const title =
      titleText || (await this.getTitle());

    const specifications =
      specs || (await this.getSpecifications());

    /*
     * 1. Check specification fields.
     */
    const specFields = [
      'Screen Size',
      'Display Size Class',
      'Size',
      'Standing screen display size',
      'Screen Size Unit of Measure',
      'Item Dimensions',
    ];

    for (const field of specFields) {
      const value = specifications[field];

      if (!value) {
        continue;
      }

      const inchMatch = value.match(
        /(\d+(?:\.\d+)?)\s*(?:inches|inch|["”])/i,
      );

      if (inchMatch) {
        return parseFloat(inchMatch[1]);
      }

      const cmMatch = value.match(
        /(\d+(?:\.\d+)?)\s*(?:cms?|centimetres?|centimeters?|cm)/i,
      );

      if (cmMatch) {
        return parseFloat(cmMatch[1]) / 2.54;
      }
    }

    /*
     * 2. Check title for inch notation.
     *
     * Examples:
     * 50 inches
     * 50 inch
     * 50"
     * 55 inches
     * 55"
     */
    const titleInchMatch =
      title.match(
        /\b(\d{2}(?:\.\d+)?)\s*(?:inches|inch|["”])\b/i,
      ) ||
      title.match(
        /\b(50|55)\s*(?:inches|inch|["”])/i,
      );

    if (titleInchMatch) {
      return parseFloat(titleInchMatch[1]);
    }

    /*
     * 3. Check title for centimeter notation.
     *
     * Examples:
     * 126 cm
     * 127 cm
     * 139 cm
     * 139.7 cm
     * 140 cm
     */
    const titleCmMatch = title.match(
      /\b(\d{2,3}(?:\.\d+)?)\s*(?:cms?|centimetres?|centimeters?|cm)\b/i,
    );

    if (titleCmMatch) {
      return parseFloat(titleCmMatch[1]) / 2.54;
    }

    return null;
  }

  /**
   * Validates that the selected product is either:
   *
   * - 50 inches
   * - 55 inches
   *
   * `expectedSizes` accepts both values because the test now applies
   * both required screen-size filters.
   */
  async validateScreenSize(
    expectedSizes: string[] | string | null = null,
    titleText?: string,
    specs?: Record<string, string>,
  ): Promise<void> {
    const title =
      titleText || (await this.getTitle());

    const detected = await this.detectScreenSize(
      title,
      specs,
    );

    if (detected === null) {
      throw new Error(
        `Could not determine the screen size of the selected product: ${title}`,
      );
    }

    /*
     * Allow a small tolerance because some products use
     * approximate display measurements.
     */
    const is50Inch =
      detected >= 48 && detected <= 52;

    const is55Inch =
      detected >= 53 && detected <= 57;

    if (!is50Inch && !is55Inch) {
      throw new Error(
        [
          'Incorrect product selected.',
          'Expected a 50-inch or 55-inch TV.',
          `Detected size: ${detected.toFixed(2)} inches.`,
          `Product: ${title}`,
        ].join(' '),
      );
    }

    /*
     * Normalize the expected-size argument.
     *
     * Supports:
     * - ['50 inches', '55 inches']
     * - '50 inches'
     * - '55 inches'
     * - null
     */
    const expectedSizeList = Array.isArray(
      expectedSizes,
    )
      ? expectedSizes
      : expectedSizes
        ? [expectedSizes]
        : [];

    const normalizedExpectedSizes =
      expectedSizeList.map((size) =>
        size.toLowerCase().trim(),
      );

    /*
     * If expected sizes were provided, verify the detected
     * size is one of those sizes.
     */
    if (
      normalizedExpectedSizes.length > 0
    ) {
      const detectedLabel = is50Inch
        ? '50 inches'
        : '55 inches';

      const expected50 =
        normalizedExpectedSizes.includes(
          '50 inches',
        );

      const expected55 =
        normalizedExpectedSizes.includes(
          '55 inches',
        );

      if (
        detectedLabel === '50 inches' &&
        !expected50
      ) {
        throw new Error(
          `Incorrect product selected. Expected sizes: ${expectedSizeList.join(
            ', ',
          )}. Detected: 50 inches. Product: ${title}`,
        );
      }

      if (
        detectedLabel === '55 inches' &&
        !expected55
      ) {
        throw new Error(
          `Incorrect product selected. Expected sizes: ${expectedSizeList.join(
            ', ',
          )}. Detected: 55 inches. Product: ${title}`,
        );
      }
    }

    const verifiedLabel = is50Inch
      ? '50 inches'
      : '55 inches';

    logger.info(
      `Product size verified: ${verifiedLabel}`,
    );
  }

  /**
   * Convenience method that gathers all product details.
   */
  async captureAllDetails(): Promise<ProductDetails> {
    await this.waitForLoad();

    const [
      title,
      price,
      rating,
      aboutThisItem,
      specifications,
    ] = await Promise.all([
      this.getTitle(),
      this.getPrice(),
      this.getRating(),
      this.getAboutThisItem(),
      this.getSpecifications(),
    ]);

    return {
      title,
      price,
      rating,
      aboutThisItem,
      specifications,
    };
  }
}