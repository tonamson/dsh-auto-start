/**
 * Pure builders for the per-OS login entry: launchd LaunchAgent (macOS),
 * systemd user unit (Linux), hidden VBScript in the Startup folder (Windows).
 */
import { existsSync } from 'node:fs'
import { posix, win32 } from 'node:path'

const pathFor = platform => platform === 'win32' ? win32 : posix

/** Environment variables copied into the entry so the login-time process finds node/npx and the same DSH home. */
const CARRIED_ENV = ['PATH', 'DSH_HOME']

/**
 * Resolve a command to an absolute path through PATH (and PATHEXT on Windows).
 * @param {string} command
 * @param {NodeJS.ProcessEnv} env
 * @param {NodeJS.Platform} platform
 * @returns {string | undefined}
 */
export function which(command, env, platform) {
  const { delimiter, isAbsolute, join } = pathFor(platform)
  if (isAbsolute(command)) return existsSync(command) ? command : undefined
  const extensions = platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : ['']
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (dir === '') continue
    for (const extension of extensions) {
      const candidate = join(dir, command + extension)
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

/**
 * Location of the login entry for `label`.
 * @param {string} label
 * @param {NodeJS.Platform} platform
 * @param {NodeJS.ProcessEnv} env
 * @param {string} home
 * @returns {string}
 */
export function entryPath(label, platform, env, home) {
  const { join } = pathFor(platform)
  switch (platform) {
    case 'darwin': return join(home, 'Library', 'LaunchAgents', `dsh.autostart.${label}.plist`)
    case 'linux': return join(env.XDG_CONFIG_HOME ?? join(home, '.config'), 'systemd', 'user', `${label}.service`)
    case 'win32': return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', `${label}.vbs`)
    default: throw new Error(`dsh-autostart: unsupported platform ${platform}`)
  }
}

const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const systemdQuote = value => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%')}"`

/**
 * File content of the login entry.
 * @param {{ label: string, argv: string[], cwd: string, env: NodeJS.ProcessEnv, home: string }} spec - `argv[0]` is absolute.
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
export function entryContent({ label, argv, cwd, env, home }, platform) {
  const { join } = pathFor(platform)
  const carried = CARRIED_ENV.filter(name => env[name] !== undefined).map(name => [name, env[name]])
  switch (platform) {
    case 'darwin': {
      const log = join(home, 'Library', 'Logs', `${label}.log`)
      return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>dsh.autostart.${xml(label)}</string>
  <key>ProgramArguments</key>
  <array>
${argv.map(arg => `    <string>${xml(arg)}</string>`).join('\n')}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${carried.map(([name, value]) => `    <key>${name}</key><string>${xml(value)}</string>`).join('\n')}
  </dict>
  <key>WorkingDirectory</key><string>${xml(cwd)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`
    }
    case 'linux':
      return `[Unit]
Description=DeepSeek Harness (${label})
After=network-online.target

[Service]
ExecStart=${argv.map(systemdQuote).join(' ')}
WorkingDirectory=${cwd}
${carried.map(([name, value]) => `Environment=${systemdQuote(`${name}=${value}`)}`).join('\n')}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`
    case 'win32': {
      const log = join(env.LOCALAPPDATA ?? home, `${label}.log`)
      // ponytail: Startup inherits the user's environment, so no env is carried; cmd /c strips the outer quote pair.
      const inner = `${argv.map(arg => `"${arg}"`).join(' ')} >> "${log}" 2>&1`
      const commandLine = `cmd /c "cd /d "${cwd}" && ${inner}"`
      return `CreateObject("WScript.Shell").Run "${commandLine.replaceAll('"', '""')}", 0, False\r\n`
    }
    default: throw new Error(`dsh-autostart: unsupported platform ${platform}`)
  }
}
