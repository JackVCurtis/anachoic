/**
 * The ext-apps reference host that the development loop and the e2e suite
 * run: examples/basic-host from this commit, built against this published
 * release of the package.
 */
export const EXT_APPS_REPOSITORY = 'https://github.com/modelcontextprotocol/ext-apps.git'
export const EXT_APPS_COMMIT = '82221c0c8ce7661efa6771c9d461511b1650495f'
export const EXT_APPS_VERSION = '2.0.3'

/**
 * basic-host hard-codes its sandbox at localhost:8081, so neither port can
 * move.
 */
export const REFERENCE_HOST_PORT = 8080
export const REFERENCE_SANDBOX_PORT = 8081
