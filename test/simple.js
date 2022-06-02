const b4a = require('b4a')
const {
  keyToBuffer,
  sign,
  createSigningKeyPair
} = require('jlinx-util')
const { test } = require('./helpers/index.js')

test('simple', async (t, createHost) => {
  const host = await createHost()
  t.ok(host)

  const ownerKeyPair = createSigningKeyPair()
  const ownerSigningKey = ownerKeyPair.publicKey
  const ownerSigningKeyProof = sign(
    keyToBuffer(host.publicKey),
    ownerKeyPair.secretKey
  )
  const doc1Id = await host.create({
    ownerSigningKey,
    ownerSigningKeyProof,
  })
  t.ok(doc1Id)

  t.same(
    await host.getLength(doc1Id),
    0
  )

  t.deepEqual(
    await host.append(
      doc1Id,
      b4a.from('one'),
      sign(
        b4a.from('one'),
        ownerKeyPair.secretKey
      )
    ),
    1
  )

  t.same(
    await host.getLength(doc1Id),
    1
  )

  t.ok(
    b4a.equals(
      await host.getEntry(doc1Id, 0),
      b4a.from('one')
    )
  )

  t.deepEqual(
    await host.append(
      doc1Id,
      b4a.from('two'),
      sign(
        b4a.from('two'),
        ownerKeyPair.secretKey
      )
    ),
    2
  )

  t.same(
    await host.getLength(doc1Id),
    2
  )

  t.ok(
    b4a.equals(
      await host.getEntry(doc1Id, 0),
      b4a.from('one')
    )
  )

  t.ok(
    b4a.equals(
      await host.getEntry(doc1Id, 1),
      b4a.from('two')
    )
  )

})
