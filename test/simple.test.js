const {
  test,
  createTestnet,
  b4a,
  createSigningKeyPair,
  sign
} = require('./helpers/index.js')

test('simple', async (t) => {
  const { createJlinxHosts } = await createTestnet(t)
  const [host] = await createJlinxHosts(2)

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    host.publicKey,
    ownerKeyPair.secretKey
  )

  const doc = await host.create({
    ownerSigningKey,
    ownerSigningKeyProof
  })
  t.ok(doc)
  t.alike(doc.length, 0)
  t.ok(doc.writable)

  await doc.append(
    b4a.from('one'),
    sign(
      b4a.from('one'),
      ownerKeyPair.secretKey
    )
  )
  t.alike(doc.length, 1)

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
  t.alike(doc.length, 2)

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
  const { createJlinxHosts } = await createTestnet(t)
  const [host1, host2] = await createJlinxHosts(2)

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    host1.publicKey,
    ownerKeyPair.secretKey
  )
  const doc1 = await host1.create({
    ownerSigningKey,
    ownerSigningKeyProof
  })

  t.not(doc1.id, ownerKeyPair.publicKey)
  t.alike(doc1.length, 0)
  t.ok(doc1.writable)

  await doc1.append(
    b4a.from('hey steve, wanna sign a contract?'),
    sign(
      b4a.from('hey steve, wanna sign a contract?'),
      ownerKeyPair.secretKey
    )
  )

  const doc1copy = await host2.get(doc1.id)
  t.alike(doc1copy.id, doc1.id)
  t.alike(doc1copy.length, 0)
  t.ok(!doc1copy.writable)
  await doc1copy.update()
  await doc1copy.get(0) // HACK FIX :(

  t.alike(doc1copy.length, 1)
  t.ok(
    b4a.equals(
      await doc1copy.get(0),
      b4a.from('hey steve, wanna sign a contract?')
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
    })()
  ])

  t.alike(doc1copyUpdate, [2])
  t.alike(doc1.length, 2)
  t.alike(doc1copy.length, 2)
  t.ok(
    b4a.equals(
      await doc1copy.get(1),
      b4a.from('here is the copy')
    )
  )

  const [host3] = await createJlinxHosts(1)
  await host3.connected()

  const doc1copy2 = await host3.get(doc1.id)
  await doc1copy2.update()
  await doc1copy2.get(0) // HACK FIX :(
  t.alike(doc1copy2.length, 2)
  t.ok(
    b4a.equals(
      await doc1copy2.get(1),
      b4a.from('here is the copy')
    )
  )
})
