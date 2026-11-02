const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

// Run the actual TypeScript session implementation without another test dependency.
const filename = path.resolve(__dirname, '../lib/admin-session.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sessionModule = new Module(filename, module)
sessionModule.filename = filename
sessionModule.paths = module.paths
sessionModule._compile(compiled, filename)
const { createAdminSession, verifyAdminSession, matchesAdminPassword, getAdminPassword, ADMIN_SESSION_MAX_AGE } = sessionModule.exports
const authFilename = path.resolve(__dirname, '../lib/admin-auth.ts')
const authModule = new Module(authFilename, module)
authModule.filename = authFilename
authModule.paths = module.paths
authModule.require = (id) => id === './admin-session' ? sessionModule.exports : require(id)
authModule._compile(ts.transpileModule(fs.readFileSync(authFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, authFilename)
const { rejectCrossOrigin, requireAdmin } = authModule.exports
const { NextRequest } = require('next/server')
const routeFilename = path.resolve(__dirname, '../app/api/admin/auth/route.ts')
const routeModule = new Module(routeFilename, module)
routeModule.filename = routeFilename
routeModule.paths = module.paths
routeModule.require = (id) => id === '@/lib/admin-session' ? sessionModule.exports
  : id === '@/lib/admin-auth' ? authModule.exports : require(id)
routeModule._compile(ts.transpileModule(fs.readFileSync(routeFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, routeFilename)

const password = 'test-only-long-unique-password'
const now = 1800000000000

test('password comparison rejects incorrect and empty credentials', () => {
  assert.equal(matchesAdminPassword(password, password), true)
  assert.equal(matchesAdminPassword('admin2026', password), false)
  assert.equal(matchesAdminPassword('', ''), false)
  assert.equal(matchesAdminPassword('x'.repeat(1025), password), false)
  assert.throws(() => createAdminSession(''))
})

test('sessions expire after eight hours and password rotation invalidates them', () => {
  const token = createAdminSession(password, now)
  assert.equal(verifyAdminSession(token, password, now), true)
  assert.equal(verifyAdminSession(token, password, now + ADMIN_SESSION_MAX_AGE * 1000 - 1), true)
  assert.equal(verifyAdminSession(token, password, now + ADMIN_SESSION_MAX_AGE * 1000), false)
  assert.equal(verifyAdminSession(token, 'rotated-password', now), false)
  assert.equal(verifyAdminSession(token, '', now), false)
})

test('localStorage flags, malformed cookies and modified session payloads cannot authenticate', () => {
  const token = createAdminSession(password, now)
  const [expires, nonce, signature] = token.split('.')
  for (const forged of [undefined, '', 'true', 'admin_authenticated=true', 'a.b.c', token + '.extra',
    `${Number(expires) + 1}.${nonce}.${signature}`, `${expires}.${'0'.repeat(64)}.${signature}`,
    `${expires}.${nonce}.${'0'.repeat(64)}`, `${expires}.${nonce}.${'z'.repeat(64)}`, 'x'.repeat(257)]) {
    assert.equal(verifyAdminSession(forged, password, now), false)
  }
})

test('sessions have independent nonces and do not contain the password', () => {
  const first = createAdminSession(password, now)
  const second = createAdminSession(password, now)
  assert.notEqual(first, second)
  assert.equal(first.includes(password), false)
})

test('origin checks accept the actual host, including loopback IPs, and reject cross-site requests', () => {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.1.5:3000', 'https://portfolio.example']) {
    const request = (requestOrigin) => new NextRequest(`${origin}/api/admin/auth`, {
      method: 'POST', headers: { host: new URL(origin).host, ...(requestOrigin ? { origin: requestOrigin } : {}) },
    })
    assert.equal(rejectCrossOrigin(request(origin)), null)
    assert.equal(rejectCrossOrigin(request('https://external.example')).status, 403)
    assert.equal(rejectCrossOrigin(request(null)).status, 403)
  }
})

test('API authorization requires a valid session and origin with custom or default passwords', () => {
  const previous = process.env.ADMIN_PASSWORD
  try {
    const origin = 'http://127.0.0.1:3000'
    const request = (cookie, requestOrigin = origin) => new NextRequest(`${origin}/api/admin/projects`, {
      method: 'POST', headers: { host: '127.0.0.1:3000', origin: requestOrigin, cookie },
    })
    process.env.ADMIN_PASSWORD = password
    assert.equal(requireAdmin(request('admin_authenticated=true')).status, 401)
    const cookie = `portfolio_admin_session=${createAdminSession(password)}`
    assert.equal(requireAdmin(request(cookie)), null)
    assert.equal(requireAdmin(request(cookie, 'https://external.example')).status, 403)
    delete process.env.ADMIN_PASSWORD
    assert.equal(requireAdmin(request(cookie)).status, 401)
    const defaultCookie = `portfolio_admin_session=${createAdminSession('admin2026')}`
    assert.equal(requireAdmin(request(defaultCookie)), null)
    assert.equal(requireAdmin(request('admin_authenticated=true')).status, 401)
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = previous
  }
})

test('login works with admin2026 without an ADMIN_PASSWORD environment variable', async () => {
  const previous = process.env.ADMIN_PASSWORD
  try {
    delete process.env.ADMIN_PASSWORD
    assert.equal(getAdminPassword(), 'admin2026')
    const loginRequest = (value) => new NextRequest('https://portfolio.example/api/admin/auth', {
      method: 'POST', headers: { host: 'portfolio.example', origin: 'https://portfolio.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: value }),
    })
    assert.equal((await routeModule.exports.POST(loginRequest('incorrect-password'))).status, 401)
    const login = await routeModule.exports.POST(loginRequest('admin2026'))
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /Secure/i)
    assert.equal(requireAdmin(new NextRequest('https://portfolio.example/api/admin/projects?scope=admin', {
      headers: { cookie: cookie.split(';')[0] },
    })), null)
    process.env.ADMIN_PASSWORD = password
    assert.equal(getAdminPassword(), password)
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = previous
  }
})
