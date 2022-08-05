const Debug = require('debug')
const Path = require('path')
const JlinxNode = require('jlinx-node')
const JlinxId = require('jlinx-util/JlinxId')
const {
  verify,
  createSigningKeyPair,
  validateSigningKeyPair
} = require('jlinx-util')
const Vault = require('jlinx-vault')
const Document = require('./Document')

const debug = Debug('jlinx:host')

module.exports = class JlinxHost {
  constructor (opts) {
    if (!opts.url) {
      throw new Error('url is required')
    }
    this.url = opts.url
    if (!opts.storagePath) {
      throw new Error('storagePath is required')
    }
    this.storagePath = opts.storagePath
    if (!opts.keyPair || !validateSigningKeyPair(opts.keyPair)) {
      throw new Error('invalid jlinx host signing key pair')
    }
    this.keyPair = opts.keyPair
    this.publicKey = this.keyPair.publicKey

    this.vault = new Vault({
      path: Path.join(this.storagePath, 'vault'),
      key: opts.vaultKey
    })
    this.hostKeys = this.vault.namespace('hostKeys', 'raw')
    this.ownerKeys = this.vault.namespace('ownerKeys', 'raw')

    this.node = new JlinxNode({
      topic: opts.topic,
      storagePath: Path.join(opts.storagePath, 'cores'),
      bootstrap: opts.bootstrap,
      keyPair: this.keyPair
    })
    this._ready = this._open()
  }

  [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
    return this.constructor.name + '(\n' +
      indent + '  url: ' + opts.stylize(this.url, 'string') + '\n' +
      indent + '  storagePath: ' + opts.stylize(this.storagePath, 'string') + '\n' +
      indent + '  peers: ' + opts.stylize(this.node.numberOfPeers, 'number') + '\n' +
      indent + ')'
  }

  async _open () {
    await this.vault.ready()
    await this.node.ready()
  }

  ready () { return this.node.ready() }

  connected () { return this.node.connected() }

  destroy () { return this.node.destroy() }

  async create ({
    ownerSigningKey,
    ownerSigningKeyProof
  }) {
    debug('create', { ownerSigningKey })
    const validProof = verify(
      this.publicKey,
      ownerSigningKeyProof,
      ownerSigningKey
    )
    if (!validProof) {
      debug('invalid proof')
      throw new Error('invalid ownerSigningKeyProof')
    }
    const { publicKey, secretKey } = createSigningKeyPair()
    const id = JlinxId.toString(publicKey)
    debug('created', { id })
    await this.hostKeys.set(id, secretKey)
    await this.ownerKeys.set(id, ownerSigningKey)
    const core = await this.node.get(id, secretKey)
    const doc = Document.open({ id, core, ownerSigningKey })
    return doc
  }

  async get (id) {
    debug('get', { id })
    const secretKey = await this.hostKeys.get(id)
    const core = await this.node.get(id, secretKey)
    debug('get', { core })
    const ownerSigningKey = await this.ownerKeys.get(id)
    const doc = Document.open({ id, core, ownerSigningKey })
    return doc
  }
}
