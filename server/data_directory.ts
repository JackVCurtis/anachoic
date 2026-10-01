import { mkdirSync, chmodSync } from 'node:fs'
import { userInfo } from 'node:os'
import { isAbsolute, join } from 'node:path'

const MACOS_FOLDER = 'Anachoic MCP'
const XDG_FOLDER = 'anachoic-mcp'
const PRIVATE = 0o700

export type DataDirectorySources = {
  env: Record<string, string | undefined>
  platform: NodeJS.Platform
  /**
   * The home directory from the user database. Desktop starts the server with
   * an empty environment, so HOME is never consulted.
   */
  userHome: () => string | undefined
}

export type DataDirectoryResolution =
  { ok: true; directory: string } | { ok: false; reason: string }

/**
 * The user database's home directory. os.homedir() prefers HOME, while
 * os.userInfo() reads the passwd entry alone.
 */
export function homeFromUserDatabase(): string | undefined {
  try {
    const { homedir } = userInfo()
    return homedir && isAbsolute(homedir) ? homedir : undefined
  } catch {
    return undefined
  }
}

export function resolveDataDirectory({
  env,
  platform,
  userHome,
}: DataDirectorySources): DataDirectoryResolution {
  const configured = env.ANACHOIC_DATA_DIR
  if (configured) {
    if (!isAbsolute(configured)) {
      return {
        ok: false,
        reason: `ANACHOIC_DATA_DIR must be an absolute path, not "${configured}".`,
      }
    }
    return { ok: true, directory: configured }
  }

  if (platform !== 'darwin' && env.XDG_DATA_HOME && isAbsolute(env.XDG_DATA_HOME)) {
    return { ok: true, directory: join(env.XDG_DATA_HOME, XDG_FOLDER) }
  }

  const home = userHome()
  if (!home) {
    return {
      ok: false,
      reason:
        'ANACHOIC_DATA_DIR is not set and the home directory could not be found in the user database.',
    }
  }
  if (platform === 'darwin') {
    return { ok: true, directory: join(home, 'Library', 'Application Support', MACOS_FOLDER) }
  }
  return { ok: true, directory: join(home, '.local', 'share', XDG_FOLDER) }
}

/**
 * Creates the data directory and its logs/ folder, both readable by the user
 * alone. mkdir's mode is masked by the umask, so an explicit chmod follows.
 */
export function prepareDataDirectory(directory: string) {
  const logs = join(directory, 'logs')
  mkdirSync(logs, { recursive: true, mode: PRIVATE })
  chmodSync(directory, PRIVATE)
  chmodSync(logs, PRIVATE)
  return { directory, logs }
}
