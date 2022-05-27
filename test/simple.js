import b4a from 'b4a'
import { test } from './helpers/index.js'

test('hosting a document', async (t, createHost) => {
  const host = await createHost()
  console.log({ host })

  const doc1 = await host.create()
  t.same(doc1.writable, true)
  t.same(doc1.length, 0)

  await doc1.append([
    b4a.from('one'),
    b4a.from('two'),
  ])
  t.same(doc1.length, 2)
  t.same(await doc1.get(0), b4a.from('one'))
  t.same(await doc1.get(1), b4a.from('two'))
  t.end()
})
