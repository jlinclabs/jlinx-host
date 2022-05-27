import tape from 'tape'
import tmp from 'tmp-promise'
import fs from 'node:fs/promises'
import HyperDHT from '@hyperswarm/dht'

import JlinxHost from '../../index.js'

export async function test (name, fn, _tape = tape) {
  return _tape(name, run)
  async function run (t) {
    const bootstrappers = []
    const nodes = []

    while (bootstrappers.length < 3) {
      bootstrappers.push(new HyperDHT({ ephemeral: true, bootstrap: [] }))
    }

    const bootstrap = []
    for (const node of bootstrappers) {
      await node.ready()
      bootstrap.push({ host: '127.0.0.1', port: node.address().port })
    }

    while (nodes.length < 3) {
      const node = new HyperDHT({ ephemeral: false, bootstrap })
      await node.ready()
      nodes.push(node)
    }

    const tmpDirs = []
    const newTmpDir = async () => {
      const { path } = await tmp.dir()
      const destroy = () => fs.rm(path, { recursive: true })
      tmpDirs.push({ path, destroy })
      return path
    }

    const jlinxHosts = []
    const create = async () => {
      const jlinxHost = new JlinxHost({
        storagePath: await newTmpDir(),
        bootstrap,
      })
      jlinxHosts.push(jlinxHost)
      await jlinxHost.ready()
      return jlinxHost
    }
    await fn(t, create)

    destroy(jlinxHosts)
    destroy(tmpDirs)
    destroy(bootstrappers)
    destroy(nodes)
  }
}
test.only = (name, fn) => test(name, fn, tape.only)
test.skip = (name, fn) => test(name, fn, tape.skip)

function destroy (...nodes) {
  for (const node of nodes) {
    if (Array.isArray(node)) destroy(...node)
    else node.destroy()
  }
}
