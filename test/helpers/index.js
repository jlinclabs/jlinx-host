const tape = require('tape')
const tmp = require('tmp-promise')
const fs = require('node:fs/promises')
const HyperDHT = require('@hyperswarm/dht')
const Vault = require('jlinx-vault')
const { createSigningKeyPair } = require('jlinx-util')

const JlinxHost = require('../../index.js')

module.exports.test = function(name, fn, _tape = tape) {
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
        url: `http://example.com`,
        keyPair: createSigningKeyPair(),
        vaultKey: Vault.generateKey()
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
exports.test.only = (name, fn) => exports.test(name, fn, tape.only)
exports.test.skip = (name, fn) => exports.test(name, fn, tape.skip)

function destroy (...nodes) {
  for (const node of nodes) {
    if (Array.isArray(node)) destroy(...node)
    else node.destroy()
  }
}
