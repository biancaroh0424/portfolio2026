const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { NextRequest } = require('next/server')

const originalCwd = process.cwd()
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-privacy-test-'))
const originalEnv = { ...process.env }
process.chdir(temp)
process.env.ADMIN_PASSWORD = 'admin2026'
process.env.PROJECT_CONTENT_ENCRYPTION_KEY = 'test-only-encryption-key-32-characters-long'
process.env.VECTOR_STORE_MODE = 'file'
delete process.env.VERCEL
const cache = new Map()
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = module.paths
  cache.set(filename, loaded)
  loaded.require = id => {
    if (id === './vector-store-file') return { searchVectorStore: async () => [
      { id: 'old-private-index', content: { type: 'project', projectId: 'draft', title: 'Secret', content: 'Secret' }, score: 1 },
      { id: 'public-index', content: { type: 'project', projectId: 'legacy', title: 'Public', content: 'Public' }, score: 0.9 },
    ] }
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
    if (id.startsWith('./')) return load(path.relative(originalCwd, path.resolve(path.dirname(filename), id + '.ts')))
    return require(id)
  }
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename)
  return loaded.exports
}
after(() => {
  process.chdir(originalCwd)
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]
  Object.assign(process.env, originalEnv)
  fs.rmSync(temp, { recursive: true, force: true })
})

const visibility = load('lib/project-visibility.ts')
const storage = load('lib/project-storage.ts')
const crypto = load('lib/private-content.ts')
const session = load('lib/admin-session.ts')
const api = load('app/api/admin/projects/route.ts')
const detailApi = load('app/api/admin/projects/[id]/route.ts')
const uploadApi = load('app/api/admin/upload/route.ts')
const mediaApi = load('app/api/admin/media/[id]/route.ts')
const mediaRegisterApi = load('app/api/admin/media/route.ts')
const data = load('lib/data.ts')
const vector = load('lib/vector-store.ts')
const { getAdminProjectTitle } = load('lib/utils.ts')
const origin = 'http://127.0.0.1:3000'
const adminCookie = `portfolio_admin_session=${session.createAdminSession('admin2026')}`
function request(url, { admin = false, method = 'GET', body } = {}) {
  return new NextRequest(origin + url, {
    method, headers: { host: '127.0.0.1:3000', origin, ...(admin ? { cookie: adminCookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
const translation = title => ({ en: { title, content: `<p>${title} body</p>` } })

test('CMS titles use the populated language when a new private document has an empty English translation', () => {
  const project = { id: 'private-document', visibility: 'private', translations: {
    en: { title: '' }, ko: { title: '비공개 문서 제목' },
  } }
  assert.equal(getAdminProjectTitle(project), '비공개 문서 제목')
  assert.equal(getAdminProjectTitle({ ...project, translations: { en: { title: '   ' }, it: { title: 'Titolo' } } }), 'Titolo')
  assert.equal(getAdminProjectTitle({ ...project, title: 'Legacy title', translations: { en: { title: '' } } }), 'Legacy title')
  assert.equal(getAdminProjectTitle({ id: 'untitled-document', translations: { en: { title: '' } } }), 'untitled-document')
})

test('legacy visibility remains public; private and invalid visibility never leak', () => {
  const projects = [{ id: 'legacy' }, { id: 'public', visibility: 'public' }, { id: 'draft', visibility: 'private' }, { id: 'invalid', visibility: null }]
  assert.deepEqual(visibility.visibleProjects(projects).map(p => p.id), ['legacy', 'public'])
  assert.equal(visibility.visibleProjects(projects, true).length, 4)
})

test('Blob records encrypt all private metadata and fail closed without the correct key', () => {
  const projects = [{ id: 'legacy', translations: translation('Public') }, { id: 'draft', visibility: 'private', translations: translation('SECRET DOCUMENT TITLE') }]
  const encoded = storage.encodeStoredProjects(projects)
  assert.ok(!JSON.stringify(encoded).includes('SECRET DOCUMENT TITLE'))
  assert.ok(!JSON.stringify(encoded).includes('draft'))
  assert.deepEqual(storage.decodeStoredProjects(encoded).map(p => p.id), ['legacy'])
  assert.deepEqual(storage.decodeStoredProjects(encoded, true), projects)
  const key = process.env.PROJECT_CONTENT_ENCRYPTION_KEY
  try {
    process.env.PROJECT_CONTENT_ENCRYPTION_KEY = 'a-different-encryption-key-32-characters'
    assert.throws(() => storage.decodeStoredProjects(encoded, true))
    // Visitors can still read public records when private records cannot be decrypted.
    assert.equal(storage.decodeStoredProjects(encoded).length, 1)
  } finally { process.env.PROJECT_CONTENT_ENCRYPTION_KEY = key }
  const ciphertext = crypto.encryptPrivateContent(Buffer.from('private bytes'))
  ciphertext[ciphertext.length - 1] ^= 1
  assert.throws(() => crypto.decryptPrivateContent(ciphertext))
})

test('new documents default to private; APIs and search enforce updates immediately', async () => {
  await storage.writeStoredProjects([{ id: 'legacy', translations: translation('Public legacy') }])
  const saved = await api.POST(request('/api/admin/projects', { admin: true, method: 'POST', body: { id: 'draft', translations: translation('Secret document') } }))
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).project.visibility, 'private')
  let publicList = await api.GET(request('/api/admin/projects?includePrivate=true'))
  assert.deepEqual((await publicList.json()).map(p => p.id), ['legacy'])
  const authenticatedPortfolioList = await api.GET(request('/api/admin/projects', { admin: true }))
  assert.deepEqual((await authenticatedPortfolioList.json()).map(p => p.id), ['legacy'])
  assert.equal((await api.GET(request('/api/admin/projects?scope=admin'))).status, 401)
  const adminList = await api.GET(request('/api/admin/projects?scope=admin', { admin: true }))
  assert.equal((await adminList.json()).length, 2)
  assert.match(adminList.headers.get('cache-control'), /private.*no-store/)
  assert.equal((await detailApi.GET(request('/api/admin/projects/draft'), { params: { id: 'draft' } })).status, 404)
  assert.equal((await detailApi.GET(request('/api/admin/projects/draft', { admin: true }), { params: { id: 'draft' } })).status, 200)
  assert.equal((await data.getProjects()).some(p => p.id === 'draft'), false)
  assert.equal((await data.getAllContent()).some(c => c.projectId === 'draft'), false)
  assert.deepEqual((await vector.searchVectorStore([1])).map(r => r.id), ['public-index'])
  const published = { id: 'draft', visibility: 'public', translations: translation('Published document') }
  assert.equal((await api.POST(request('/api/admin/projects', { admin: true, method: 'POST', body: published }))).status, 200)
  assert.equal((await data.getProjects()).some(p => p.id === 'draft'), true)
  assert.equal((await data.getAllContent()).some(c => c.projectId === 'draft'), true)
  assert.equal((await api.POST(request('/api/admin/projects', { admin: true, method: 'POST', body: { ...published, visibility: 'private' } }))).status, 200)
  assert.equal((await data.getProjects()).some(p => p.id === 'draft'), false)
  assert.deepEqual((await vector.searchVectorStore([1])).map(r => r.id), ['public-index'])
  assert.equal((await api.POST(request('/api/admin/projects', { method: 'POST', body: published }))).status, 401)
  assert.equal((await api.POST(request('/api/admin/projects', { admin: true, method: 'POST', body: { ...published, visibility: 'invalid' } }))).status, 400)
})

test('new project attachments are protected, then follow document publication status', async () => {
  const bytes = Buffer.from('test image bytes')
  const form = new FormData()
  form.append('image', new File([bytes], 'test.png', { type: 'image/png' }))
  form.append('scope', 'project')
  const upload = await uploadApi.POST(new NextRequest(origin + '/api/admin/upload', {
    method: 'POST', headers: { host: '127.0.0.1:3000', origin, cookie: adminCookie }, body: form,
  }))
  assert.equal(upload.status, 200)
  const { url } = await upload.json()
  assert.match(url, /^\/api\/admin\/media\/[a-f0-9]{32}$/)
  assert.equal(fs.existsSync(path.join(temp, 'public/uploads')), false)
  const params = { id: url.split('/').pop() }
  assert.equal((await mediaApi.GET(request(url), { params })).status, 404)
  const adminMedia = await mediaApi.GET(request(url, { admin: true }), { params })
  assert.deepEqual(Buffer.from(await adminMedia.arrayBuffer()), bytes)
  const project = { id: 'media-doc', visibility: 'public', thumbnail: url, translations: translation('Media') }
  await api.POST(request('/api/admin/projects', { admin: true, method: 'POST', body: project }))
  assert.equal((await mediaApi.GET(request(url), { params })).status, 200)
  await api.POST(request('/api/admin/projects', { admin: true, method: 'POST', body: { ...project, visibility: 'private' } }))
  assert.equal((await mediaApi.GET(request(url), { params })).status, 404)
  assert.equal((await mediaApi.GET(request('/api/admin/media/../../secret'), { params: { id: '../../secret' } })).status, 404)
})

test('direct browser video uploads stay encrypted and decrypt only through the authorized media API', async () => {
  const webcrypto = require('node:crypto').webcrypto
  const key = webcrypto.getRandomValues(new Uint8Array(32))
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const importedKey = await webcrypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const original = Buffer.from('private video content')
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, importedKey, original)
  const body = { blobUrl: 'https://example.public.blob.vercel-storage.com/protected-uploads/abcdef.bin',
    clientKey: Buffer.from(key).toString('base64'), clientIv: Buffer.from(iv).toString('base64'),
    contentType: 'video/mp4', filename: 'private.mp4' }
  const saved = await mediaRegisterApi.POST(request('/api/admin/media', { admin: true, method: 'POST', body }))
  assert.equal(saved.status, 200)
  const { url } = await saved.json()
  const params = { id: url.split('/').pop() }
  assert.equal((await mediaApi.GET(request(url), { params })).status, 404)
  const previousFetch = global.fetch
  try {
    global.fetch = async target => {
      assert.equal(target, body.blobUrl)
      return new Response(encrypted)
    }
    const video = await mediaApi.GET(request(url, { admin: true }), { params })
    assert.equal(video.status, 200)
    assert.deepEqual(Buffer.from(await video.arrayBuffer()), original)
    const rangeRequest = request(url, { admin: true })
    rangeRequest.headers.set('range', 'bytes=0-6')
    const ranged = await mediaApi.GET(rangeRequest, { params })
    assert.equal(ranged.status, 206)
    assert.equal(await ranged.text(), 'private')
  } finally { global.fetch = previousFetch }
  assert.equal((await mediaRegisterApi.POST(request('/api/admin/media', { admin: true, method: 'POST', body: { ...body, blobUrl: 'http://localhost/internal' } }))).status, 400)
})
