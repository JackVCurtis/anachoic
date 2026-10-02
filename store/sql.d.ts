/**
 * Migrations are imported as text: esbuild's text loader in the server build,
 * and a plugin in the unit suite.
 */
declare module '*.sql' {
  const sql: string
  export default sql
}
