const test = require('brittle')
const { timeout } = require('nonsynchronous')
const _createTestnet = require('@hyperswarm/testnet')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const ram = require('random-access-memory')
const tmp = require('tmp-promise')
const b4a = require('b4a')
const fs = require('node:fs/promises')
const {
  keyToString,
  keyToBuffer,
  createSigningKeyPair,
  sign,
} = require('jlinx-util')
const Vault = require('jlinx-vault')

const JlinxHost = require('../..')

Object.assign(exports, {
  test,
  timeout,
  b4a,
  keyToString,
  keyToBuffer,
  createSigningKeyPair,
  sign,
  createTestnet,
  coreValues,
  JlinxHost,
})

async function createTestnet(t, size = 3){
  const testnet = await _createTestnet(size, t.teardown)

  const newTmpDir = async () => {
    const { path } = await tmp.dir()
    t.teardown(() => {
      fs.rm(path, { recursive: true })
    })
    return path
  }

  testnet.hosts = new Map
  testnet.createJlinxHosts = async (size = 2) => {
    const hosts = []
    while(hosts.length < size){
      const host = new JlinxHost({
        topic: Buffer.from('_testing_jlinx_host_on_hypercore'),
        storagePath: await newTmpDir(),
        bootstrap: testnet.bootstrap,
        url: `http://${Vault.generateKey().toString('hex')}.com`,
        keyPair: createSigningKeyPair(),
        vaultKey: Vault.generateKey()
      })
      t.teardown(() => { host.destroy() })
      hosts.push(host)
      testnet.hosts.set(host.node.id, host)
    }
    await Promise.all(
      hosts.map(host => host.connected())
    )
    const ids = testnet.hosts.keys()
    for (const host of hosts){
      for (const otherhost of testnet.hosts.values()){
        if (host === otherhost) continue
        t.ok(host.node.swarm.peers.has(otherhost.node.id), `host has peer`)
      }
    }
    for (const host of hosts){
      await host.ready()
    }
    return hosts
  }

  return testnet
}

async function coreValues(core){
  const values = []
  for (let n = 0; n < core.length; n++){
    values[n] = (await core.get(n)).toString()
  }
  return values
}


// const tape = require('tape')
// const tmp = require('tmp-promise')
// const fs = require('node:fs/promises')
// const HyperDHT = require('@hyperswarm/dht')
// const Vault = require('jlinx-vault')
// const { createSigningKeyPair } = require('jlinx-util')

// const JlinxHost = require('../../index.js')

// module.exports.test = function (name, fn, _tape = tape) {
//   return _tape(name, run)
//   async function run (t) {
//     const bootstrappers = []
//     const nodes = []

//     while (bootstrappers.length < 3) {
//       bootstrappers.push(new HyperDHT({ ephemeral: true, bootstrap: [] }))
//     }

//     const bootstrap = []
//     for (const node of bootstrappers) {
//       await node.ready()
//       bootstrap.push({ host: '127.0.0.1', port: node.address().port })
//     }

//     while (nodes.length < 3) {
//       const node = new HyperDHT({ ephemeral: false, bootstrap })
//       await node.ready()
//       nodes.push(node)
//     }

//     const tmpDirs = []
//     const newTmpDir = async () => {
//       const { path } = await tmp.dir()
//       const destroy = () => fs.rm(path, { recursive: true })
//       tmpDirs.push({ path, destroy })
//       return path
//     }

//     const jlinxHosts = []
//     const create = async () => {
//       const jlinxHost = new JlinxHost({
//         storagePath: await newTmpDir(),
//         bootstrap,
//         url: `http://${Vault.generateKey().toString('hex')}.com`,
//         keyPair: createSigningKeyPair(),
//         vaultKey: Vault.generateKey()
//       })
//       jlinxHosts.push(jlinxHost)
//       await jlinxHost.connected()
//       return jlinxHost
//     }
//     await fn(t, create)

//     t.teardown(() => {
//       destroy(jlinxHosts)
//       destroy(tmpDirs)
//       destroy(bootstrappers)
//       destroy(nodes)
//     })
//   }
// }
// exports.test.only = (name, fn) => exports.test(name, fn, tape.only)
// exports.test.skip = (name, fn) => exports.test(name, fn, tape.skip)

// function destroy (...nodes) {
//   for (const node of nodes) {
//     if (Array.isArray(node)) destroy(...node)
//     else node.destroy()
//   }
// }
