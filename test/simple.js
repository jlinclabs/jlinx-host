const b4a = require('b4a')
const {
  keyToBuffer,
  keyToString,
  sign,
  createSigningKeyPair
} = require('jlinx-util')
const { test } = require('./helpers/index.js')

test('simple', async (t, createHost) => {
  const host = await createHost()
  t.ok(host)
  await host.connected()

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    keyToBuffer(host.publicKey),
    ownerKeyPair.secretKey
  )
  const doc = await host.create({
    ownerSigningKey,
    ownerSigningKeyProof,
  })
  t.ok(doc)
  t.equal(doc.length, 0)
  t.ok(doc.writable)

  await doc.append(
    b4a.from('one'),
    sign(
      b4a.from('one'),
      ownerKeyPair.secretKey
    )
  ),
  t.equal(doc.length, 1)

  t.ok(
    b4a.equals(
      await doc.get(0),
      b4a.from('one')
    )
  )

  await doc.append(
    b4a.from('two'),
    sign(
      b4a.from('two'),
      ownerKeyPair.secretKey
    )
  )
  t.equal(doc.length, 2)

  t.ok(
    b4a.equals(
      await doc.get(0),
      b4a.from('one')
    )
  )

  t.ok(
    b4a.equals(
      await doc.get(1),
      b4a.from('two')
    )
  )

})


test('sync across hosts', async (t, createHost) => {
  const host1 = await createHost()
  const host2 = await createHost()

  await Promise.all([
    host1.connected(),
    host2.connected(),
  ])

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    keyToBuffer(host1.publicKey),
    ownerKeyPair.secretKey
  )
  const doc1 = await host1.create({
    ownerSigningKey,
    ownerSigningKeyProof,
  })

  t.notEqual(doc1.id, keyToString(ownerKeyPair.publicKey))
  t.equal(doc1.length, 0)
  t.ok(doc1.writable)

  await doc1.append(
    b4a.from('hey steve, wanna sign a contract?'),
    sign(
      b4a.from('hey steve, wanna sign a contract?'),
      ownerKeyPair.secretKey
    )
  )

  const doc1copy = await host2.get(doc1.id)
  t.equal(doc1copy.id, doc1.id)
  t.equal(doc1copy.length, 0)
  t.ok(!doc1copy.writable)
  await doc1copy.update()

  t.equal(doc1copy.length, 1)
  t.ok(
    b4a.equals(
      await doc1copy.get(0),
      b4a.from('hey steve, wanna sign a contract?'),
    )
  )

  let doc1copyUpdate = []
  await Promise.all([
    doc1copy.waitForUpdate().then((...args) => {
      doc1copyUpdate = args
    }),

    (async () => {
      await doc1.append(
        b4a.from('here is the copy'),
        sign(
          b4a.from('here is the copy'),
          ownerKeyPair.secretKey
        )
      )
    })(),
  ])

  t.deepEqual(doc1copyUpdate, [2])
  t.equal(doc1.length, 2)
  t.equal(doc1copy.length, 2)
  t.ok(
    b4a.equals(
      await doc1copy.get(1),
      b4a.from('here is the copy'),
    )
  )

  const host3 = await createHost()
  await host3.connected()

  const doc1copy2 = await host3.get(doc1.id)
  await doc1copy2.update()
  t.equal(doc1copy2.length, 2)
  t.ok(
    b4a.equals(
      await doc1copy2.get(1),
      b4a.from('here is the copy'),
    )
  )
})
