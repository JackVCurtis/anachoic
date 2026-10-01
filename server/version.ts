/**
 * The package version, which the server build writes in from package.json.
 * Code run from source, as in the unit tests, has no build to write it.
 */
declare const ANACHOIC_VERSION: string | undefined

export const VERSION = typeof ANACHOIC_VERSION === 'string' ? ANACHOIC_VERSION : '0.0.0-source'
