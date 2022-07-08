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

  console.log({
    host1,
    host2,
  })

  await Promise.all([
    host1.connected(),
    host2.connected(),
  ])

  console.log({
    host1,
    host2,
  })

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
  console.log({ doc1, doc1copy })
  console.log({
    doc1: doc1.core,
    doc1copy: doc1copy.core,
  })
  t.equal(doc1copy.length, 1)
  t.ok(
    b4a.equals(
      await doc1copy.get(0),
      b4a.from('hey steve, wanna sign a contract?'),
    )
  )

  let doc1copyUpdates = []
  doc1copy.waitForUpdate((...args) => {
    doc1copyUpdates.push(args)
  })

  await doc1.append(
    b4a.from('hey steve, wanna sign a contract?'),
    sign(
      b4a.from('hey steve, wanna sign a contract?'),
      ownerKeyPair.secretKey
    )
  )

})
