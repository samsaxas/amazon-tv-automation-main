/**
 * constants.ts
 * ---------------------------------------------------------------------------
 * Centralized test data for the Amazon TV automation.
 *
 * Requirements:
 * - Search for "TV".
 * - Apply BOTH required screen-size filters:
 *      1. 44.0 to 52.9 in  -> approximately 50 inches
 *      2. 53.0 to 61.9 in  -> approximately 55 inches
 * - Select Samsung and Sony when they are available.
 * - If only one of Samsung or Sony is available, select only that brand.
 * - Never select any other brand as a fallback.
 */

export const SEARCH_TERM = 'TV';

/**
 * Required Amazon screen-size filters.
 *
 * These are the exact filter ranges requested for the assignment.
 *
 * 44.0 to 52.9 in -> 50-inch category
 * 53.0 to 61.9 in -> 55-inch category
 *
 * Both filters must be attempted. The automation must not stop after
 * successfully applying only the first filter.
 */
export interface ScreenSizeTarget {
  name: string;
  patterns: RegExp[];
  labels: string[];
}

export const SCREEN_SIZE_TARGETS: ScreenSizeTarget[] = [
  {
    name: '50 inches',

    labels: [
      '44.0 to 52.9 in',
      '44 to 52.9 in',
    ],

    patterns: [
      /44(?:\.0)?\s+to\s+52\.9\s+in/i,
    ],
  },

  {
    name: '55 inches',

    labels: [
      '53.0 to 61.9 in',
      '53 to 61.9 in',
    ],

    patterns: [
      /53(?:\.0)?\s+to\s+61\.9\s+in/i,
    ],
  },
];

/**
 * Backward-compatible screen-size names.
 *
 * Both values are required and must be applied when available.
 */
export const SCREEN_SIZES = ['50 inches', '55 inches'];

/**
 * Required brands.
 *
 * Only these two brands are allowed.
 *
 * If both are available:
 *     Samsung + Sony
 *
 * If only Samsung is available:
 *     Samsung
 *
 * If only Sony is available:
 *     Sony
 *
 * If neither is available:
 *     No brand filter is selected.
 *
 * IMPORTANT:
 * No fallback brands such as LG, Toshiba, MI, OnePlus, Visio World,
 * or any other Amazon-listed brand should ever be selected.
 */
export const PREFERRED_BRANDS = ['Samsung', 'Sony'];

/**
 * Maximum number of brands to select.
 *
 * This prevents the automation from selecting more than the two
 * explicitly requested brands.
 */
export const NUMBER_OF_BRANDS_TO_SELECT = 2;

export const AMAZON_BASE_URL = 'https://www.amazon.in';