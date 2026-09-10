import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { logger } from '@utils/logger';
import { SCREEN_SIZE_TARGETS, ScreenSizeTarget } from '@data/constants';

export interface ProductMatchResult {
  matchesSize: boolean;
  matchesBrand: boolean;
  isTv: boolean;
  detectedSize: string | null;
  detectedBrand: string | null;
}

export class SearchResultsPage extends BasePage {
  private readonly filterRail: Locator = this.page.locator(
    '#s-refinements, #leftNav',
  );

  private readonly resultCards: Locator = this.page.locator(
    'div.s-main-slot div[data-component-type="s-search-result"]',
  );

  constructor(page: Page) {
    super(page);
  }

  async applyScreenSizeFilter(
    _targets: ScreenSizeTarget[] = SCREEN_SIZE_TARGETS,
  ): Promise<string | null> {
    const applied = await this.applyScreenSizeFilters();

    return applied.length > 0 ? applied[0] : null;
  }

  /**
   * Applies both exact screen-size ranges required by the assignment.
   *
   * 50 inches -> 44.0 to 52.9 in
   * 55 inches -> 53.0 to 61.9 in
   */
  async applyScreenSizeFilters(
    _targets: ScreenSizeTarget[] = SCREEN_SIZE_TARGETS,
  ): Promise<string[]> {
    logger.step(
      'Applying required screen-size filters: 50 inches and 55 inches',
    );

    const requiredTargets: ScreenSizeTarget[] = [
      {
        name: '50 inches',
        labels: ['44.0 to 52.9 in', '44 to 52.9 in'],
        patterns: [/44(?:\.0)?\s*to\s*52\.9\s*in/i],
      },
      {
        name: '55 inches',
        labels: ['53.0 to 61.9 in', '53 to 61.9 in'],
        patterns: [/53(?:\.0)?\s*to\s*61\.9\s*in/i],
      },
    ];

    const applied: string[] = [];

    for (const target of requiredTargets) {
      const option = await this.findFilterOption(target);

      if (!option) {
        logger.warn(
          `Required screen-size filter "${target.name}" was not found.`,
        );
        continue;
      }

      const alreadySelected = await this.isOptionSelected(option);

      if (alreadySelected) {
        applied.push(target.name);

        logger.info(
          `Screen-size filter already active: ${target.name}`,
        );

        continue;
      }

      try {
        await this.clickFilterOption(option);
        await this.waitForResultsRefresh();

        const active =
          (await this.isFilterActive(target)) ||
          (await this.isExactScreenSizeInUrl(target));

        if (active) {
          applied.push(target.name);

          logger.info(
            `Applied screen-size filter: ${target.name}`,
          );
        } else {
          logger.warn(
            `Clicked the "${target.name}" filter, but could not verify it as active.`,
          );
        }
      } catch (error) {
        logger.warn(
          `Failed to apply screen-size filter "${target.name}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const uniqueApplied = [...new Set(applied)];

    logger.info(
      `Screen-size filters applied: ${
        uniqueApplied.length > 0
          ? uniqueApplied.join(', ')
          : 'none'
      }`,
    );

    return uniqueApplied;
  }

  /**
   * Selects ONLY Samsung and Sony.
   *
   * Rules:
   * - Samsung available -> select Samsung.
   * - Sony available -> select Sony.
   * - Both available -> select both.
   * - Only one available -> select only that one.
   * - Neither available -> select neither.
   *
   * No other brand is ever selected.
   */
  async selectBrands(): Promise<string[]> {
    logger.step('Selecting required brands: Samsung and Sony');

    const selected: string[] = [];
    const requiredBrands = ['Samsung', 'Sony'];

    for (const brand of requiredBrands) {
      await this.expandFilterOptions();

      const option = await this.findBrandOption(brand);

      if (!option) {
        logger.info(
          `${brand} is not available in the current Brand filter.`,
        );

        continue;
      }

      const alreadySelected =
        await this.isOptionSelected(option);

      if (alreadySelected) {
        selected.push(brand);

        logger.info(
          `Brand filter already active: ${brand}`,
        );

        continue;
      }

      try {
        await this.clickFilterOption(option);
        await this.waitForResultsRefresh();

        if (await this.isBrandFilterActive(brand)) {
          selected.push(brand);

          logger.info(
            `Applied Brand filter: ${brand}`,
          );
        } else {
          logger.warn(
            `Clicked ${brand}, but could not verify it as active.`,
          );
        }
      } catch (error) {
        logger.warn(
          `Failed to apply Brand filter "${brand}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const uniqueSelected = [...new Set(selected)];

    if (uniqueSelected.length === 2) {
      logger.info(
        'Both required brands selected: Samsung, Sony',
      );
    } else if (uniqueSelected.length === 1) {
      logger.info(
        `Only one required brand is available: ${uniqueSelected[0]}`,
      );
    } else {
      logger.warn(
        'Neither Samsung nor Sony was selected. No other brand will be used.',
      );
    }

    return uniqueSelected;
  }

  /**
   * Verifies the required filters.
   *
   * Both screen-size filters must be applied.
   *
   * Only Samsung and Sony are permitted as selected brands.
   */
  async verifyFiltersApplied(
    screenSizes: string[] | string | null,
    brands: string[],
  ): Promise<boolean> {
    const appliedSizes = Array.isArray(screenSizes)
      ? screenSizes
      : screenSizes
        ? [screenSizes]
        : [];

    const normalizedSizes = appliedSizes.map((size) =>
      size.toLowerCase().trim(),
    );

    const normalizedBrands = brands.map((brand) =>
      brand.toLowerCase().trim(),
    );

    const has50Inches =
      normalizedSizes.includes('50 inches');

    const has55Inches =
      normalizedSizes.includes('55 inches');

    const hasRequiredScreenSizes =
      has50Inches && has55Inches;

    const allowedBrands = ['samsung', 'sony'];

    const hasOnlyAllowedBrands =
      normalizedBrands.every((brand) =>
        allowedBrands.includes(brand),
      );

    const hasNoDuplicateBrands =
      new Set(normalizedBrands).size ===
      normalizedBrands.length;

    const valid =
      hasRequiredScreenSizes &&
      hasOnlyAllowedBrands &&
      hasNoDuplicateBrands;

    if (!valid) {
      logger.warn(
        [
          'Filter verification failed:',
          `50 inches=${has50Inches}`,
          `55 inches=${has55Inches}`,
          `Samsung=${normalizedBrands.includes('samsung')}`,
          `Sony=${normalizedBrands.includes('sony')}`,
          `Applied brands=[${brands.join(', ')}]`,
        ].join(' | '),
      );
    } else {
      logger.info(
        [
          'Required filters verified:',
          '50 inches=Yes',
          '55 inches=Yes',
          `Samsung=${
            normalizedBrands.includes('samsung')
              ? 'Yes'
              : 'Not available'
          }`,
          `Sony=${
            normalizedBrands.includes('sony')
              ? 'Yes'
              : 'Not available'
          }`,
        ].join(' | '),
      );
    }

    return valid;
  }

  /**
   * Checks whether a product title satisfies the assignment.
   *
   * Required:
   * - Actual TV
   * - 50 or 55 inches
   * - Samsung or Sony
   *
   * IMPORTANT:
   * An empty selectedBrands array does NOT mean that every brand
   * is acceptable.
   */
  matchesRequiredProduct(
    title: string,
    selectedBrands: string[],
  ): ProductMatchResult {
    const normalizedTitle = title
      .replace(/\s+/g, ' ')
      .trim();

    const isAccessory =
      /\b(wall\s*mount|bracket|remote\s*control|tv\s*cover|hdmi\s*cable|stand\s*base|power\s*adapter)\b/i.test(
        normalizedTitle,
      );

    const isTv =
      !isAccessory &&
      /\b(tv|television|smart\s*tv|qled|oled|led|4k|uhd|ultra\s*hd)\b/i.test(
        normalizedTitle,
      );

    let detectedSize: string | null = null;
    let matchesSize = false;

    /*
     * 50-inch products.
     */
    if (
      /\b50\s*(?:inch(?:es)?|["”])/i.test(
        normalizedTitle,
      ) ||
      /\b126\s*(?:cm|cms)\b/i.test(
        normalizedTitle,
      ) ||
      /\b127\s*(?:cm|cms)\b/i.test(
        normalizedTitle,
      ) ||
      /\(50\s*(?:inch(?:es)?|["”])?\)/i.test(
        normalizedTitle,
      )
    ) {
      matchesSize = true;
      detectedSize = '50 inches';
    }

    /*
     * 55-inch products.
     */
    else if (
      /\b55\s*(?:inch(?:es)?|["”])/i.test(
        normalizedTitle,
      ) ||
      /\b139(?:\.7)?\s*(?:cm|cms)\b/i.test(
        normalizedTitle,
      ) ||
      /\b140\s*(?:cm|cms)\b/i.test(
        normalizedTitle,
      ) ||
      /\(55\s*(?:inch(?:es)?|["”])?\)/i.test(
        normalizedTitle,
      )
    ) {
      matchesSize = true;
      detectedSize = '55 inches';
    }

    /*
     * Explicitly reject other common TV sizes.
     */
    if (
      /\b(32|40|43|65|70|75|77|85)\s*(?:inch(?:es)?|["”])/i.test(
        normalizedTitle,
      )
    ) {
      matchesSize = false;
      detectedSize = null;
    }

    const allowedSelectedBrands =
      selectedBrands.filter((brand) =>
        /^(Samsung|Sony)$/i.test(brand.trim()),
      );

    let detectedBrand: string | null = null;
    let matchesBrand = false;

    /*
     * IMPORTANT:
     *
     * Do NOT set matchesBrand = true when no brand is selected.
     *
     * The previous logic did that, which allowed products such as
     * Toshiba to pass when Samsung/Sony were not detected.
     *
     * Only a successfully selected Samsung or Sony product is valid.
     */
    if (allowedSelectedBrands.length > 0) {
      for (const brand of allowedSelectedBrands) {
        const brandRegex = new RegExp(
          `\\b${this.escapeRegex(brand.trim())}\\b`,
          'i',
        );

        if (brandRegex.test(normalizedTitle)) {
          matchesBrand = true;
          detectedBrand = brand.trim();

          break;
        }
      }
    }

    return {
      isTv,
      matchesSize,
      matchesBrand,
      detectedSize,
      detectedBrand,
    };
  }

  /**
   * Finds and opens the first valid product.
   *
   * A valid product must:
   * - Be a TV.
   * - Be 50 or 55 inches.
   * - Match a successfully selected Samsung/Sony brand.
   *
   * If neither Samsung nor Sony was successfully selected, the method
   * fails instead of opening an unrelated brand.
   */
  async findAndOpenBestMatchingProduct(
    selectedBrands: string[] = [],
  ): Promise<{
    page: Page;
    title: string;
    detectedSize: string | null;
  }> {
    logger.step(
      'Searching filtered results for the best matching product',
    );

    const allowedSelectedBrands = selectedBrands
      .map((brand) => brand.trim())
      .filter((brand) =>
        /^(Samsung|Sony)$/i.test(brand),
      );

    /*
     * CRITICAL SAFETY CHECK:
     *
     * Never open Toshiba, LG, Visio World, MI, OnePlus,
     * or any other brand just because Samsung/Sony were not found.
     */
    if (allowedSelectedBrands.length === 0) {
      throw new Error(
        'Neither Samsung nor Sony was selected from the Brand filter. The test will not open a product from another brand.',
      );
    }

    await this.resultCards
      .first()
      .waitFor({
        state: 'visible',
        timeout: 20_000,
      });

    const totalCards = await this.resultCards.count();

    if (totalCards === 0) {
      throw new Error(
        'No Amazon search result cards were found after applying filters.',
      );
    }

    let bestCandidateIndex = -1;
    let bestCandidateTitle = '';
    let bestCandidateMatch: ProductMatchResult | null =
      null;

    for (let i = 0; i < totalCards; i++) {
      const card = this.resultCards.nth(i);

      const titleElement = card.locator('h2').first();

      const rawTitle = await titleElement
        .innerText()
        .catch(() => '');

      const title = rawTitle
        .replace(/\s+/g, ' ')
        .trim();

      if (!title) {
        continue;
      }

      const match = this.matchesRequiredProduct(
        title,
        allowedSelectedBrands,
      );

      /*
       * A candidate is valid only when all three conditions pass.
       */
      if (
        match.isTv &&
        match.matchesSize &&
        match.matchesBrand
      ) {
        bestCandidateIndex = i;
        bestCandidateTitle = title;
        bestCandidateMatch = match;

        break;
      }
    }

    if (
      bestCandidateIndex === -1 ||
      !bestCandidateMatch
    ) {
      throw new Error(
        [
          'Could not find a valid filtered TV product.',
          'Required sizes: 50 inches and 55 inches.',
          `Allowed selected brands: ${allowedSelectedBrands.join(', ')}.`,
          'No unrelated brand will be opened.',
        ].join(' '),
      );
    }

    logger.info(
      `Candidate product found:\n${bestCandidateTitle}`,
    );

    logger.info(
      [
        'Product matches:',
        `- TV product: ${
          bestCandidateMatch.isTv ? 'Yes' : 'No'
        }`,
        `- Required screen size: ${
          bestCandidateMatch.matchesSize
            ? 'Yes'
            : 'No'
        }`,
        `- Selected brand: ${
          bestCandidateMatch.matchesBrand
            ? 'Yes'
            : 'No'
        }`,
        `- Detected brand: ${
          bestCandidateMatch.detectedBrand ??
          'Unknown'
        }`,
        `- Detected size: ${
          bestCandidateMatch.detectedSize ??
          'Unknown'
        }`,
      ].join('\n'),
    );

    logger.step('Opening selected product');

    const selectedCard =
      this.resultCards.nth(bestCandidateIndex);

    const h2Link =
      selectedCard.locator('h2 a').first();

    const titleLink =
      (await h2Link.count()) > 0
        ? h2Link
        : selectedCard
            .locator(
              'a.a-link-normal.s-line-clamp-2, a.a-link-normal',
            )
            .first();

    if ((await titleLink.count()) === 0) {
      throw new Error(
        'Could not find a clickable product link in the selected result.',
      );
    }

    await titleLink.scrollIntoViewIfNeeded();

    const newPagePromise = this.page
      .context()
      .waitForEvent('page', {
        timeout: 10_000,
      })
      .catch(() => null);

    await titleLink.click();

    const newPage = await newPagePromise;

    const targetPage = newPage ?? this.page;

    await targetPage
      .waitForLoadState('domcontentloaded')
      .catch(() => {});

    await targetPage.bringToFront();

    return {
      page: targetPage,
      title: bestCandidateTitle,
      detectedSize:
        bestCandidateMatch.detectedSize,
    };
  }

  /**
   * Opens the first valid filtered result.
   */
  async openFirstResult(
    selectedBrands: string[] = [],
  ): Promise<Page> {
    const result =
      await this.findAndOpenBestMatchingProduct(
        selectedBrands,
      );

    return result.page;
  }

  /**
   * Finds a screen-size option directly inside Amazon's
   * refinement rail.
   *
   * This avoids relying on Amazon's changing heading/DOM hierarchy.
   */
  private async findFilterOption(
    target: ScreenSizeTarget,
  ): Promise<Locator | null> {
    const options = this.filterRail.locator('li');

    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const option = options.nth(i);

      const text = await this.getCleanText(option);

      if (!text) {
        continue;
      }

      const matchesPattern =
        target.patterns.some((pattern) =>
          pattern.test(text),
        );

      const lowerText = text.toLowerCase();

      const matchesLabel =
        target.labels.some((label) => {
          const normalizedLabel =
            label.toLowerCase();

          return (
            lowerText === normalizedLabel ||
            lowerText.startsWith(
              `${normalizedLabel} `,
            )
          );
        });

      if (matchesPattern || matchesLabel) {
        return option;
      }
    }

    return null;
  }

  /**
   * Finds ONLY the requested Samsung/Sony brand.
   */
  private async findBrandOption(
    brand: string,
  ): Promise<Locator | null> {
    const exactRegex = new RegExp(
      `^\\s*${this.escapeRegex(
        brand,
      )}\\s*(?:\\(.*\\))?\\s*$`,
      'i',
    );

    const options = this.filterRail.locator('li');

    const count = await options.count();

    for (let i = 0; i < count; i++) {
      const option = options.nth(i);

      const text = await this.getCleanText(option);

      if (!text) {
        continue;
      }

      if (exactRegex.test(text)) {
        return option;
      }

      /*
       * Amazon may append counts or extra text.
       */
      const startsWithBrand = new RegExp(
        `^\\s*${this.escapeRegex(
          brand,
        )}(?:\\s|\\(|$)`,
        'i',
      );

      if (startsWithBrand.test(text)) {
        return option;
      }
    }

    /*
     * Fallback for different Amazon refinement markup.
     */
    const textLocator = this.filterRail
      .locator(
        'a, label, span.a-size-base, span.a-list-item',
      )
      .filter({
        hasText: new RegExp(
          `^\\s*${this.escapeRegex(
            brand,
          )}\\s*$`,
          'i',
        ),
      })
      .first();

    if ((await textLocator.count()) > 0) {
      const parentOption =
        textLocator.locator(
          'xpath=ancestor::li[1]',
        );

      if ((await parentOption.count()) > 0) {
        return parentOption;
      }

      return textLocator;
    }

    return null;
  }

  /**
   * Expands visible "See more" controls.
   *
   * This helps prevent Samsung/Sony from being missed when
   * Amazon initially shows only a subset of brands.
   */
  private async expandFilterOptions(): Promise<void> {
    const seeMoreLinks = this.filterRail
      .locator('a, button')
      .filter({
        hasText: /see more/i,
      });

    const count = Math.min(
      await seeMoreLinks.count(),
      10,
    );

    for (let i = 0; i < count; i++) {
      const link = seeMoreLinks.nth(i);

      try {
        if (await link.isVisible()) {
          await link.click({
            timeout: 3_000,
          });

          await this.page.waitForTimeout(400);
        }
      } catch {
        /*
         * Amazon can remove the control while the
         * refinement list is refreshing.
         */
      }
    }
  }

  /**
   * Clicks a filter option using the most appropriate
   * available Amazon control.
   */
  private async clickFilterOption(
    option: Locator,
  ): Promise<void> {
    /*
     * Amazon commonly keeps the real checkbox input hidden and places
     * a visible checkbox icon over it. Prefer the visible control.
     */
    const selectors = [
      'label',
      'i.a-icon-checkbox',
      'i.a-icon-radio',
      'a',
      'span.a-list-item',
    ];

    for (const selector of selectors) {
      const control = option.locator(selector).first();

      if ((await control.count()) === 0) {
        continue;
      }

      const visible = await control
        .isVisible()
        .catch(() => false);

      if (!visible) {
        continue;
      }

      await control.scrollIntoViewIfNeeded();
      await control.click({
        timeout: 8_000,
      });

      return;
    }

    /*
     * Some Amazon layouts expose a visible checkbox input.
     */
    const input = option
      .locator(
        'input[type="checkbox"], input[type="radio"]',
      )
      .first();

    if ((await input.count()) > 0) {
      const visible = await input
        .isVisible()
        .catch(() => false);

      if (visible) {
        await input.scrollIntoViewIfNeeded();
        await input.check({
          timeout: 8_000,
        });

        return;
      }
    }

    /*
     * Last fallback: click the option container.
     */
    await option.scrollIntoViewIfNeeded();
    await option.click({
      timeout: 8_000,
    });
  }

  /**
   * Checks whether an option is selected.
   */
  private async isOptionSelected(
    option: Locator,
  ): Promise<boolean> {
    const selectedControl = option.locator(
      'input:checked, [aria-checked="true"], a.s-navigation-selected',
    );

    return (
      (await selectedControl.count()) > 0
    );
  }

  /**
   * Verifies whether a screen-size filter is active.
   */
  private async isFilterActive(
    target: ScreenSizeTarget,
  ): Promise<boolean> {
    const matchingOptions =
      this.filterRail.locator('li');

    const count =
      await matchingOptions.count();

    for (let i = 0; i < count; i++) {
      const option =
        matchingOptions.nth(i);

      const text =
        await this.getCleanText(option);

      if (!text) {
        continue;
      }

      const matches =
        target.patterns.some((pattern) =>
          pattern.test(text),
        ) ||
        target.labels.some(
          (label) =>
            text.toLowerCase() ===
            label.toLowerCase(),
        );

      if (
        matches &&
        (await this.isOptionSelected(option))
      ) {
        return true;
      }
    }

    /*
     * Amazon may move active filters to a selected
     * navigation area.
     */
    const selectedElements =
      this.page.locator(
        'a.s-navigation-selected, [aria-checked="true"], input:checked',
      );

    const selectedCount =
      await selectedElements.count();

    for (
      let i = 0;
      i < selectedCount;
      i++
    ) {
      const text =
        await this.getCleanText(
          selectedElements.nth(i),
        );

      if (
        target.patterns.some((pattern) =>
          pattern.test(text),
        ) ||
        target.labels.some((label) =>
          text
            .toLowerCase()
            .includes(
              label.toLowerCase(),
            ),
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verifies whether Samsung or Sony is active.
   */
  private async isBrandFilterActive(
    brand: string,
  ): Promise<boolean> {
    const brandRegex = new RegExp(
      `^\\s*${this.escapeRegex(
        brand,
      )}\\s*(?:\\(.*\\))?\\s*$`,
      'i',
    );

    /*
     * First check explicitly selected elements.
     */
    const selectedElements =
      this.page.locator(
        'a.s-navigation-selected, [aria-checked="true"], input:checked',
      );

    const selectedCount =
      await selectedElements.count();

    for (
      let i = 0;
      i < selectedCount;
      i++
    ) {
      const text =
        await this.getCleanText(
          selectedElements.nth(i),
        );

      if (brandRegex.test(text)) {
        return true;
      }
    }

    /*
     * Then check the brand option itself.
     */
    const option =
      await this.findBrandOption(brand);

    if (
      option &&
      (await this.isOptionSelected(option))
    ) {
      return true;
    }

    /*
     * Final fallback: Amazon can encode the selected
     * brand in the refinement URL.
     */
    const url =
      decodeURIComponent(
        this.page.url(),
      );

    const urlPattern = new RegExp(
      `(?:p_89[^&]*|brand[^&]*)${this.escapeRegex(
        brand,
      )}`,
      'i',
    );

    return urlPattern.test(url);
  }

  /**
   * Checks whether the exact required screen-size
   * range exists in the URL.
   */
  private async isExactScreenSizeInUrl(
    target: ScreenSizeTarget,
  ): Promise<boolean> {
    const url =
      decodeURIComponent(
        this.page.url(),
      );

    return target.patterns.some(
      (pattern) => {
        try {
          return pattern.test(url);
        } catch {
          return false;
        }
      },
    );
  }

  /**
   * Waits for Amazon results to refresh after
   * applying a filter.
   */
  private async waitForResultsRefresh(): Promise<void> {
    await this.page
      .waitForLoadState('domcontentloaded')
      .catch(() => {});

    await this.handleCommonInterstitials();

    await this.page.waitForTimeout(1_500);

    await this.resultCards
      .first()
      .waitFor({
        state: 'visible',
        timeout: 10_000,
      })
      .catch(() => {
        logger.warn(
          'Result cards did not reappear within timeout after filter click.',
        );
      });
  }

  /**
   * Returns normalized text from a locator.
   */
  private async getCleanText(
    locator: Locator,
  ): Promise<string> {
    return (
      await locator
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Escapes a string for use inside a regular expression.
   */
  private escapeRegex(
    value: string,
  ): string {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
  }
}