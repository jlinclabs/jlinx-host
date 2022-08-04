const test = require('brittle')
const { timeout } = require('nonsynchronous')
const _createTestnet = require('@hyperswarm/testnet')
const tmp = require('tmp-promise')
const b4a = require('b4a')
const fs = require('node:fs/promises')
const {
  keyToString,
  keyToBuffer,
  createSigningKeyPair,
  sign
} = require('jlinx-util')
const Vault = require('jlinx-vault')

const JlinxHost = require('../..')
const createHttpServer = require('../../http-server')

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
  JlinxHost
})

async function createTestnet (t, size = 3) {
  const testnet = await _createTestnet(size, t.teardown)

  testnet.newTmpDir = async () => {
    const { path } = await tmp.dir()
    t.teardown(() => {
      fs.rm(path, { recursive: true })
    })
    return path
  }

  testnet.hosts = new Map()
  testnet.createJlinxHosts = async (size = 2) => {
    const hosts = []
    while (hosts.length < size) {
      const host = new JlinxHost({
        topic: Buffer.from('_testing_jlinx_host_on_hypercore'),
        storagePath: await testnet.newTmpDir(),
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
    for (const host of hosts) {
      for (const id of testnet.hosts.keys()) {
        if (host.node.id !== id) {
          t.ok(
            host.node.swarm.peers.has(id),
            `host ${host.node.id} should have peer ${id}`
          )
        }
      }
    }
    return hosts
  }

  testnet.createHttpServers = async (size = 3) => {
    const hosts = await testnet.createJlinxHosts(size)
    const apps = hosts.map(createHttpServer)
    t.teardown(() => {
      apps.forEach(app => app.destroy())
    })
    return apps
  }

  return testnet
}

async function coreValues (core) {
  const values = []
  for (let n = 0; n < core.length; n++) {
    values[n] = (await core.get(n)).toString()
  }
  return values
}

