import { test, expect } from '@playwright/test';

import { HomePage } from '@pages/HomePage';
import { SearchResultsPage } from '@pages/SearchResultsPage';
import { ProductPage } from '@pages/ProductPage';
import { logger } from '@utils/logger';

import { SEARCH_TERM } from '@data/constants';

/**
 * amazonTvSearch.spec.ts
 * ---------------------------------------------------------------------------
 * End-to-end scenario:
 *
 * 1. Navigate to https://www.amazon.in
 * 2. Search for "TV"
 * 3. Apply BOTH required screen-size filters:
 *      - 44.0 to 52.9 in  (~50 inches)
 *      - 53.0 to 61.9 in  (~55 inches)
 * 4. Select Samsung and Sony when they are available.
 *      - If both are available, select both.
 *      - If only one is available, select only that one.
 *      - Never select any other brand.
 * 5. Verify that the required filters are actively applied.
 * 6. Open a valid TV product from the filtered results.
 * 7. Validate that the product screen size is 50" or 55".
 * 8. Capture and log:
 *      - Product title
 *      - Price
 *      - Customer rating
 *      - About this item
 *      - Product information / specifications
 */

test.describe(
  'Amazon.in — TV search, filter, and product detail capture',
  () => {
    test('search for TV, apply filters, and log first product details', async ({
      page,
    }) => {
      const homePage = new HomePage(page);
      const searchResultsPage = new SearchResultsPage(page);

      // -------------------------------------------------------------------
      // Step 1 & 2: Navigate to Amazon and search for TV
      // -------------------------------------------------------------------

      await homePage.goto();

      await homePage.searchFor(SEARCH_TERM);

      await expect(page).toHaveURL(/\/s(?:\?|\/)/, {
        timeout: 20_000,
      });

      // -------------------------------------------------------------------
      // Step 3: Apply BOTH required screen-size filters
      // -------------------------------------------------------------------

      const appliedScreenSizes =
        await searchResultsPage.applyScreenSizeFilters();

      expect(
        appliedScreenSizes.length,
        'At least one required screen-size filter must be available',
      ).toBeGreaterThan(0);

      // The assignment requires both screen-size ranges whenever Amazon
      // exposes them on the page.
      logger.step('Screen-size filters applied');

      for (const screenSize of appliedScreenSizes) {
        logger.info(`Applied screen-size filter: ${screenSize}`);
      }

      // -------------------------------------------------------------------
      // Step 4: Select Samsung and Sony only
      // -------------------------------------------------------------------

      const brandsSelected = await searchResultsPage.selectBrands();

      logger.step('Brand filters applied');

      if (brandsSelected.length === 0) {
        logger.info(
          'Neither Samsung nor Sony was available. No other brand will be selected.',
        );
      } else {
        for (const brand of brandsSelected) {
          logger.info(`Applied Brand filter: ${brand}`);
        }
      }

      // -------------------------------------------------------------------
      // Step 5: Verify required filters
      // -------------------------------------------------------------------

      const filtersValid =
        await searchResultsPage.verifyFiltersApplied(
          appliedScreenSizes,
          brandsSelected,
        );

      expect(
        filtersValid,
        'Required screen-size and brand filters must be correctly applied',
      ).toBe(true);

      // -------------------------------------------------------------------
      // Step 6: Open a valid filtered TV product
      // -------------------------------------------------------------------

      const productDetailPage =
        await searchResultsPage.openFirstResult(brandsSelected);

      const productPage = new ProductPage(productDetailPage);

      // -------------------------------------------------------------------
      // Step 7: Capture product details and validate screen size
      // -------------------------------------------------------------------

      const details = await productPage.captureAllDetails();

      await productPage.validateScreenSize(
        appliedScreenSizes,
        details.title,
        details.specifications,
      );

      // -------------------------------------------------------------------
      // Step 8: Log product details
      // -------------------------------------------------------------------

      logger.step('Capturing product details');

      logger.dataBlock('Product Title', details.title);

      logger.dataBlock('Price', details.price);

      logger.dataBlock('Customer Rating', details.rating);

      logger.dataBlock('About This Item', details.aboutThisItem);

      const specLines = Object.entries(details.specifications).map(
        ([key, value]) => `${key}: ${value}`,
      );

      logger.dataBlock(
        'Product Information / Specifications',
        specLines,
      );

      // -------------------------------------------------------------------
      // Core assertions
      // -------------------------------------------------------------------

      expect(
        appliedScreenSizes.length,
        'At least one required screen-size filter must be applied',
      ).toBeGreaterThan(0);

      expect(
        details.title,
        'Product title should be captured',
      ).not.toBe('Not available');

      expect(
        details.title.length,
        'Product title should not be empty',
      ).toBeGreaterThan(0);

      expect(
        productDetailPage.url(),
        'Should land on an Amazon product detail page',
      ).toMatch(/\/(?:dp|gp\/product)\//);
    });
  },
);