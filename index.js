/**
 * Cordis plugin: register `dsh` to start at OS login (like 9router's start-on-boot).
 * Writes the entry on load when `enabled`, removes it when `enabled: false`.
 * The entry takes effect at the next login; the running instance is left alone.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname } from 'node:path'
import Schema from '@deepseek-ai/schemastery'
import { entryContent, entryPath, which } from './entry.js'

export const name = 'dsh-autostart'

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description('Start dsh at login. false removes the login entry.'),
  label: Schema.string().pattern(/^[\w.-]+$/).default('dsh-web').description('Entry name; one entry per label.'),
  command: Schema.string().default('npx').description('Executable, resolved to an absolute path through PATH now.'),
  args: Schema.array(Schema.string()).default(['-y', '@deepseek-ai/dsh', 'web', '--no-open']).description('Arguments after the command.'),
  cwd: Schema.string().default(homedir()).description('Working directory of the started process.'),
})

/** Run systemctl --user; a missing user manager (WSL, containers) only warns. */
function systemctl(logger, ...args) {
  try {
    execFileSync('systemctl', ['--user', ...args], { stdio: 'pipe' })
  } catch (error) {
    logger.warn('systemctl --user %s failed: %s', args.join(' '), error.message)
  }
}

export function apply(ctx, config) {
  const logger = ctx.logger('autostart')
  const { platform, env } = process
  const home = homedir()
  const file = entryPath(config.label, platform, env, home)

  if (!config.enabled) {
    if (!existsSync(file)) return
    if (platform === 'linux') systemctl(logger, 'disable', basename(file))
    rmSync(file)
    if (platform === 'linux') systemctl(logger, 'daemon-reload')
    logger.info('removed login entry %s', file)
    return
  }

  const executable = which(config.command, env, platform)
  if (executable === undefined) throw new Error(`dsh-autostart: command ${JSON.stringify(config.command)} not found on PATH`)
  const content = entryContent({ label: config.label, argv: [executable, ...config.args], cwd: config.cwd, env, home }, platform)
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
  if (platform === 'linux') {
    systemctl(logger, 'daemon-reload')
    systemctl(logger, 'enable', basename(file))
  }
  logger.info('installed login entry %s', file)
}
