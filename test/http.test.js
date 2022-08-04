const request = require('supertest')
const {
  test,
  createTestnet,
  b4a,
  keyToBuffer,
  keyToString,
  createSigningKeyPair,
  sign
} = require('./helpers/index.js')

test('http', async (t, createHost) => {
  const { createHttpServers } = await createTestnet(t)
  const [app1, app2] = await createHttpServers(2)

  let hostPublicKey
  await request(app1.url)
    .get('/')
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      const { status, publicKey } = res.body
      t.is(status, 'ok')
      t.is(typeof publicKey, 'string')
      t.is(publicKey.length, 43)
      hostPublicKey = publicKey
    })

  t.alike(
    hostPublicKey,
    keyToString(app1.jlinx.keyPair.publicKey)
  )

  await request(app1.url)
    .post('/create')
    .expect(400)

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    keyToBuffer(hostPublicKey),
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

  await request(app1.url)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      t.alike(res.body.length, 0)
    })

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

  await request(app1.url)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      t.alike(res.body.length, 1)
    })

  await request(app1.url)
    .get(`/${id1}/0`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block1.length}`)
    .expect(200)
    .then(res => {
      t.alike(res.body, block1)
    })

  await request(app2.url)
    .get(`/${id1}/0`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block1.length}`)
    .expect(200)
    .then(res => {
      t.alike(res.body, block1)
    })

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

  await request(app2.url)
    .get(`/${id1}/1`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block2.length}`)
    .expect(200)
    .then(res => {
      t.alike(res.body, block2)
    })
})
