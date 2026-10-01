import { buildServer } from './build_server.mjs'
import { buildViews } from './build_views.mjs'

await Promise.all([buildViews({ watch: true }), buildServer({ watch: true })])
