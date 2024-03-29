const { timeout } = require('nonsynchronous')
const request = require('supertest')
const multibase = require('jlinx-util/multibase')
const { isPublicKey } = require('jlinx-util')
const {
  test,
  createTestnet,
  b4a,
  createSigningKeyPair,
  sign
} = require('./helpers/index.js')

test('http', async (t, createHost) => {
  const { createHttpServers } = await createTestnet(t)
  const [app1, app2] = await createHttpServers(2)

  const expectNoCoresToBeOpen = async () => {
    await timeout(100)
    t.is(app1.jlinx.node.cores._sessions.size, 0, 'app1 left some hypercores open')
    t.is(app2.jlinx.node.cores._sessions.size, 0, 'app2 left some hypercores open')
  }

  let hostPublicKey
  await request(app1.url)
    .get('/')
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      const { status, publicKey } = res.body
      t.is(status, 'ok')
      t.is(typeof publicKey, 'string')
      t.is(publicKey.length, 65)
      t.ok(isPublicKey(publicKey), 'invalid publicKey')
      hostPublicKey = publicKey
    })

  await expectNoCoresToBeOpen()

  t.alike(
    multibase.toBuffer(hostPublicKey),
    app1.jlinx.keyPair.publicKey
  )

  await request(app1.url)
    .post('/create')
    .expect(400)

  await expectNoCoresToBeOpen()

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    multibase.toBuffer(hostPublicKey),
    ownerKeyPair.secretKey
  )

  const id1 = await request(app1.url)
    .post('/create')
    .send({
      ownerSigningKey: ownerSigningKey.toString('hex'),
      ownerSigningKeyProof: ownerSigningKeyProof.toString('hex')
    })
    .expect('Content-Type', /json/)
    .expect(201)
    .then(res => {
      const { id } = res.body
      return id
    })

  await expectNoCoresToBeOpen()

  await request(app1.url)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      t.alike(res.body.length, 0)
    })

  await expectNoCoresToBeOpen()

  const block1 = b4a.from(
    JSON.stringify({ block: 1 })
  )

  await request(app1.url)
    .post(`/${id1}`)
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Length', block1.length)
    .set(
      'jlinx-signature',
      sign(block1, ownerKeyPair.secretKey).toString('hex')
    )
    .send(block1)
    .expect(200)

  await expectNoCoresToBeOpen()

  await request(app1.url)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      t.alike(res.body.length, 1)
    })

  await expectNoCoresToBeOpen()

  await request(app1.url)
    .get(`/${id1}/0`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block1.length}`)
    .expect(200)
    .then(res => {
      t.alike(res.body, block1)
    })

  await expectNoCoresToBeOpen()

  await request(app2.url)
    .get(`/${id1}/0`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block1.length}`)
    .expect(200)
    .then(res => {
      t.alike(res.body, block1)
    })

  await expectNoCoresToBeOpen()

  const block2 = b4a.from(
    JSON.stringify({ block: 2 })
  )

  const gotNextUpdate = t.test('gotNextUpdate')
  gotNextUpdate.plan(1)

  const nextRequestPromise = request(app2.url)
    .get(`/${id1}/0/next`)
    .expect('Content-Type', 'application/json; charset=utf-8')
    .expect(200)
    .then(res => {
      t.alike(res.body, { length: 2 })
      gotNextUpdate.pass(JSON.stringify(res.body))
    })

  await request(app1.url)
    .post(`/${id1}`)
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Length', block2.length)
    .set(
      'jlinx-signature',
      sign(block2, ownerKeyPair.secretKey).toString('hex')
    )
    .send(block2)
    .expect(200)
    .then(() => {})

  await gotNextUpdate
  await nextRequestPromise

  await expectNoCoresToBeOpen()

  await request(app2.url)
    .get(`/${id1}/1`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block2.length}`)
    .expect(200)
    .then(res => {
      t.alike(res.body, block2)
    })

  await expectNoCoresToBeOpen()
})

// TODO test that hypercores are closed after each request
test.skip('hypercores are closed')
