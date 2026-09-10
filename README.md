# Amazon.in TV Search Automation

A Playwright + TypeScript UI automation project that searches for TVs on Amazon.in, applies filters, opens a product, and extracts basic product information.

The project uses the Page Object Model (POM) to keep page interactions separate from the test flow and make selectors easier to maintain.

## What the test does

The automation performs the following steps:

1. Opens [Amazon.in](https://www.amazon.in)
2. Searches for `TV`
3. Applies a screen-size filter for `50 inches` or `55 inches`
4. Selects two TV brands, such as Samsung and Sony
5. Opens the first product from the filtered search results
6. Extracts and prints:

   * Product title
   * Price
   * Customer rating
   * About this item bullets
   * Product specifications and additional product information

## Tech Stack

* Playwright Test (`@playwright/test`)
* TypeScript with strict mode enabled
* Page Object Model (POM)
* ESLint
* Prettier

## Project Structure

```text
amazon-tv-automation/
│
├── playwright.config.ts
├── tsconfig.json
├── package.json
│
├── src/
│   ├── pages/
│   │   ├── BasePage.ts
│   │   ├── HomePage.ts
│   │   ├── SearchResultsPage.ts
│   │   └── ProductPage.ts
│   │
│   ├── utils/
│   │   └── logger.ts
│   │
│   └── data/
│       └── constants.ts
│
├── tests/
│   └── amazonTvSearch.spec.ts
│
└── .github/
    └── workflows/
        └── playwright.yml
```

## Project Architecture

### Page Object Model

Each page has its own class containing the relevant locators and actions.

* `BasePage.ts` contains common helpers shared across pages.
* `HomePage.ts` handles navigation and searching.
* `SearchResultsPage.ts` handles filters and product selection.
* `ProductPage.ts` extracts information from the product details page.

This keeps the test file focused on the actual user flow instead of mixing business logic with selectors.

For example, the test should read roughly like this:

```text
Search for TV
→ Apply screen-size filter
→ Select brands
→ Open first product
→ Extract product details
```

rather than containing all the locator logic directly.

## Handling Amazon's Dynamic Filters

Amazon's search filters are not always consistent. The available brands, screen sizes, and filter layout can vary depending on the session, location, experiments, or product availability.

Because of this, the project does not rely on a single hardcoded selector for every filter.

The automation:

* Finds filter sections using their visible headings.
* Searches for filter options using partial text matching.
* Matches labels case-insensitively.
* Tries the configured screen sizes in order.
* Tries preferred brands first.
* Falls back to available brands if the preferred ones are missing.
* Logs every successfully applied filter.

This makes the test less dependent on one specific version of Amazon's UI.

## Product Data Extraction

Amazon product pages can have different layouts depending on the product category and active UI experiments.

Each extractor in `ProductPage.ts` therefore tries multiple locator patterns before giving up.

The following fields are collected:

* Product title
* Price
* Customer rating
* About this item section
* Product specifications
* Product information

If an optional field cannot be found, the test continues instead of failing.

For example:

```text
Not available
```

is returned for missing text fields, while list-based fields return an empty array.

The goal is to avoid failing the complete test because one section of a product page is missing or has changed.

## Handling Popups and Interstitials

Amazon may display UI elements that block normal interactions, including:

* Cookie consent banners
* Delivery location popups
* Other common interstitial dialogs

The shared method:

```ts
handleCommonInterstitials()
```

is called after navigation where required to detect and dismiss these elements.

## Prerequisites

Make sure the following are installed:

* Node.js 18 or later
* Node.js 20 is recommended
* npm 9 or later

## Installation

Clone the repository and install the dependencies:

```bash
npm install
```

Install the Playwright Chromium browser:

```bash
npx playwright install --with-deps chromium
```

## Running the Tests

### Default headless mode

```bash
npm test
```

The test runs in headless mode and prints the captured product details to the console.

### Run with a visible browser

Useful for debugging Amazon UI changes, popups, or CAPTCHA pages.

```bash
npm run test:headed
```

### Playwright UI Mode

```bash
npm run test:ui
```

This allows you to inspect and step through the test interactively.

### Debug Mode

```bash
npm run test:debug
```

This opens the Playwright Inspector and lets you execute the test step by step.

### View the Test Report

After running the tests:

```bash
npm run report
```

## Example Output

A typical run produces logs similar to the following:

```text
[2026-...] [STEP] ➡ Navigating to https://www.amazon.in

[2026-...] [STEP] ➡ Searching for "TV"

[2026-...] [STEP] ➡ Attempting to apply screen-size filter:
[50 inches, 55 inches]

[2026-...] [INFO] Applied "Screen Size" filter: "50 inches"

[2026-...] [STEP] ➡ Attempting to select 2 brand filters from:
[Samsung, Sony, LG, MI, OnePlus]

[2026-...] [INFO] Applied "Brand" filter: "Samsung"

[2026-...] [INFO] Applied "Brand" filter: "Sony"

[2026-...] [STEP] ➡ Opening the first product from the filtered results

[2026-...] [STEP] ➡ Product details captured

[2026-...] [DATA] --------------------------------------------

[2026-...] [DATA] PRODUCT TITLE

[2026-...] [DATA] --------------------------------------------

[2026-...] [DATA] Samsung 125 cm (50 inches) Crystal 4K Series
Ultra HD Smart LED TV ...

[2026-...] [DATA] PRICE
₹XX,XXX

[2026-...] [DATA] RATING
4.X out of 5

[2026-...] [DATA] ABOUT THIS ITEM
- ...
- ...

[2026-...] [DATA] PRODUCT INFORMATION
...
```

The actual output depends on the products and filters available during the test run.

## Configuration

Most of the test configuration is kept in:

```text
src/data/constants.ts
```

You can modify the following values.

### Search Term

```ts
SEARCH_TERM
```

The keyword entered into Amazon's search bar.

### Screen Sizes

```ts
SCREEN_SIZES
```

A list of screen-size filter labels. The automation tries them in order until one is successfully applied.

Example:

```ts
["50 inches", "55 inches"]
```

### Preferred Brands

```ts
PREFERRED_BRANDS
```

Brands the test should try to select first.

Example:

```ts
["Samsung", "Sony", "LG", "MI", "OnePlus"]
```

If these brands are not available in the current search results, the automation can fall back to other available brands.

### Number of Brands

```ts
NUMBER_OF_BRANDS_TO_SELECT
```

Controls how many brand filters should be selected.

## Playwright Configuration

The main Playwright settings are located in:

```text
playwright.config.ts
```

This file can be used to configure:

* Test timeout
* Retries
* Headless or headed execution
* Browser viewport
* Screenshots and traces
* Browser projects
* Parallel execution

The project uses:

```ts
workers: 1
```

because the tests run against a live third-party website. Running multiple automated sessions simultaneously is unnecessary for this scenario and can increase the chance of bot-detection issues.

## Linting and Formatting

Run ESLint:

```bash
npm run lint
```

Format the project using Prettier:

```bash
npm run format
```

## TypeScript Configuration

TypeScript strict mode is enabled.

The project also supports path aliases for cleaner imports:

```text
@pages
@utils
@data
```

The alias configuration is defined in:

```text
tsconfig.json
```

## Continuous Integration

The repository includes a GitHub Actions workflow:

```text
.github/workflows/playwright.yml
```

The workflow runs on pushes and pull requests to the `main` branch.

It performs the following steps:

1. Installs Node dependencies
2. Installs the Playwright Chromium browser
3. Runs the test suite
4. Uploads the Playwright HTML report as a build artifact

## Notes and Limitations

This project interacts with the live Amazon.in website, so some failures may be outside the control of the test code.

### CAPTCHA and Bot Detection

Amazon may occasionally show:

* CAPTCHA challenges
* Bot-detection pages
* Additional verification screens

This is more likely when running headless tests or using shared CI infrastructure.

If the test suddenly fails while searching or applying filters, run it locally in headed mode:

```bash
npm run test:headed
```

This makes it easier to see whether Amazon displayed an unexpected page or dialog.

### Selector Changes

Amazon changes its frontend regularly. A selector that works today may stop working after a UI update.

All page-specific selectors are isolated inside:

```text
src/pages/
```

If a particular step starts failing, check the corresponding page object rather than modifying the test flow.

### Dynamic Search Results

Search results and filters can change depending on:

* Product availability
* Amazon experiments
* Location
* Session state
* Time of execution

For this reason, the automation uses best-effort matching instead of assuming every filter will always exist.

### No Login Required

The automation only accesses publicly available product listings and product details.

It does not:

* Log into an Amazon account
* Add products to the cart
* Place orders
* Access personal account information

