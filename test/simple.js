const b4a = require('b4a')
const { createSigningKeyPair } = require('jlinx-util')
const { test } = require('./helpers/index.js')

test('hosting a document', async (t, createHost) => {
  const host = await createHost()
  console.log({ host })
  t.same(typeof host.httpServer.port, 'number')

  const signingKeyPair = createSigningKeyPair()


  // const doc1 = await host.create()
  // t.same(doc1.writable, true)
  // t.same(doc1.length, 0)

  // await doc1.append([
  //   b4a.from('one'),
  //   b4a.from('two'),
  // ])
  // t.same(doc1.length, 2)
  // t.same(await doc1.get(0), b4a.from('one'))
  // t.same(await doc1.get(1), b4a.from('two'))
  // t.end()
})


// test('creating a MicroLedger', async t => {
//   const keyPair = createSigningKeyPair()

//   const jlinx = new JlinxServer({
//     publicKey: keyToString(keyPair.publicKey),
//     storagePath: await getTmpDirPath()
//   })
//   await jlinx.keys.set(keyPair)
//   await jlinx.ready()
//   const events1 = await jlinx.create('MicroLedger')
//   t.same(events1.writable, true)
//   t.same(events1.length, 0)
//   t.deepEqual(await events1.all(), [])

//   await events1.append([
//     { eventOne: 1 }
//   ])
//   t.same(events1.length, 1)
//   t.deepEqual(await events1.all(), [
//     { eventOne: 1 }
//   ])

//   await events1.append([
//     { eventTwo: 2 },
//     { eventThree: 3 }
//   ])
//   console.log(await events1.all())
//   t.same(events1.length, 3)
//   t.deepEqual(await events1.all(), [
//     { eventThree: 3 },
//     { eventTwo: 2 },
//     { eventOne: 1 }
//   ])

//   t.end()
// })
