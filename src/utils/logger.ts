/**
 * logger.ts
 * ---------------------------------------------------------------------------
 * A tiny, dependency-free structured logger used across the test suite.
 *
 * Why not just use console.log everywhere?
 *  - Consistent, timestamped, leveled output makes CI logs much easier to
 *    scan, especially when a run fails and you're diffing multiple retries.
 *  - Centralizing logging means we can later swap this for a real logging
 *    library (winston/pino) or ship logs to a dashboard without touching
 *    every call site.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'STEP' | 'DATA';

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[${timestamp()}] [${level}] ${message}`);
}

export const logger = {
  info: (message: string): void => write('INFO', message),
  warn: (message: string): void => write('WARN', message),
  error: (message: string): void => write('ERROR', message),
  /** Marks a distinct step in the automation flow (navigation, click, etc.) */
  step: (message: string): void => write('STEP', `➡ ${message}`),
  /**
   * Prints a labeled block of scraped data to the console in a readable,
   * clearly-delimited format — used for the final product-details report.
   */
  dataBlock: (label: string, value: string | string[]): void => {
    const divider = '-'.repeat(80);
    write('DATA', divider);
    write('DATA', label.toUpperCase());
    write('DATA', divider);
    if (Array.isArray(value)) {
      if (value.length === 0) {
        write('DATA', '(none found)');
      } else {
        value.forEach((line, idx) => write('DATA', `${idx + 1}. ${line}`));
      }
    } else {
      write('DATA', value || '(not found)');
    }
  },
};
