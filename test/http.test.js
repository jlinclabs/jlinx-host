const b4a = require('b4a')
const {
  keyToBuffer,
  sign,
  createSigningKeyPair
} = require('jlinx-util')
const request = require('supertest')

const createHttpServer = require('../http-server')
const { test } = require('./helpers/index.js')

test('http', async (t, createHost) => {
  const host = await createHost()
  const app = createHttpServer(host)
  t.teardown(() => {
    app.destroy()
    host.destroy()
  })

  let hostPublicKey
  await request(app)
    .get('/')
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      console.log(res.body)
      const { status, publicKey } = res.body
      t.equal(status, 'ok')
      t.equal(typeof publicKey, 'string')
      t.equal(publicKey.length, 43)
      hostPublicKey = publicKey
    })

  console.log('???', { hostPublicKey, host })
  t.same(host.keyPair.publicKey, hostPublicKey)

  await request(app)
    .post('/create')
    .expect(400)

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    keyToBuffer(host.publicKey),
    ownerKeyPair.secretKey
  )

  const id1 = await request(app)
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

  await request(app)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      t.same(res.body.length, 0)
    })

  const block1 = b4a.from(
    JSON.stringify({ block: 1 })
  )

  await request(app)
    .post(`/${id1}`)
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Length', block1.length)
    .set(
      'jlinx-signature',
      sign(block1, ownerKeyPair.secretKey).toString('hex')
    )
    .send(block1)
    .expect(200)

  await request(app)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      t.same(res.body.length, 1)
    })

  await request(app)
    .get(`/${id1}/0`)
    .expect('Content-Type', 'application/octet-stream')
    .expect('Content-Length', `${block1.length}`)
    .expect(200)
    .then(res => {
      t.same(res.body, block1)
    })
})
