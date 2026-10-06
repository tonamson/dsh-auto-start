import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { entryContent, entryPath, which } from './entry.js'

const spec = { label: 'dsh-web', argv: ['/opt/bin/npx', '-y', '@deepseek-ai/dsh', 'web'], cwd: '/home/u', env: { PATH: '/opt/bin:/usr/bin' }, home: '/home/u' }

test('which resolves through PATH', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autostart-'))
  writeFileSync(join(dir, 'npx'), '')
  assert.equal(which('npx', { PATH: dir }, 'darwin'), join(dir, 'npx'))
  assert.equal(which('missing', { PATH: dir }, 'linux'), undefined)
})

test('entry paths per platform', () => {
  assert.equal(entryPath('dsh-web', 'darwin', {}, '/Users/u'), '/Users/u/Library/LaunchAgents/dsh.autostart.dsh-web.plist')
  assert.equal(entryPath('dsh-web', 'linux', {}, '/home/u'), '/home/u/.config/systemd/user/dsh-web.service')
  assert.throws(() => entryPath('dsh-web', 'aix', {}, '/'), /unsupported/)
})

test('launchd plist carries argv, PATH, and restart-on-crash', () => {
  const plist = entryContent({ ...spec, argv: [...spec.argv, 'a&b'] }, 'darwin')
  assert.match(plist, /<string>\/opt\/bin\/npx<\/string>/)
  assert.match(plist, /<string>a&amp;b<\/string>/)
  assert.match(plist, /<key>PATH<\/key><string>\/opt\/bin:\/usr\/bin<\/string>/)
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/)
  assert.match(plist, /<key>SuccessfulExit<\/key><false\/>/)
})

test('systemd unit quotes arguments and escapes %', () => {
  const unit = entryContent({ ...spec, argv: [...spec.argv, '50%'] }, 'linux')
  assert.match(unit, /^ExecStart="\/opt\/bin\/npx" "-y" "@deepseek-ai\/dsh" "web" "50%%"$/m)
  assert.match(unit, /^Environment="PATH=\/opt\/bin:\/usr\/bin"$/m)
  assert.match(unit, /^WantedBy=default.target$/m)
})

test('windows vbs runs hidden with doubled quotes', () => {
  const vbs = entryContent({ ...spec, argv: ['C:\\n\\npx.cmd', 'web'], cwd: 'C:\\Users\\u', env: { LOCALAPPDATA: 'C:\\L' } }, 'win32')
  assert.equal(vbs, 'CreateObject("WScript.Shell").Run "cmd /c ""cd /d ""C:\\Users\\u"" && ""C:\\n\\npx.cmd"" ""web"" >> ""C:\\L\\dsh-web.log"" 2>&1""", 0, False\r\n')
})
