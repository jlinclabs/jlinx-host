const Debug = require('debug')
const Path = require('path')
const JlinxNode = require('jlinx-node')
const {
  keyToBuffer,
  keyToString,
  sign,
  verify,
  validateSigningKeyPair,
} = require('jlinx-util')
const Vault = require('jlinx-vault')
const debug = Debug('jlinx:host')

module.exports = class JlinxHost {
  constructor(opts){
    if (!opts.url){
      throw new Error('url is required')
    }
    this.url = opts.url
    if (!opts.storagePath){
      throw new Error('storagePath is required')
    }
    this.storagePath = opts.storagePath
    if (!opts.keyPair || !validateSigningKeyPair(opts.keyPair)){
      throw new Error('invalid jlinx host signing key pair')
    }
    this.keyPair = opts.keyPair
    this.publicKey = keyToString(this.keyPair.publicKey)

    this.vault = new Vault({
      path: Path.join(this.storagePath, 'vault'),
      key: opts.vaultKey,
    })
    this.hostKeys = this.vault.namespace('hostKeys', 'raw')
    this.ownerKeys = this.vault.namespace('ownerKeys', 'raw')

    this.node = new JlinxNode({
      storagePath: Path.join(opts.storagePath, 'cores'),
      bootstrap: opts.bootstrap,
      keyPair: this.keyPair,
    })
    this._ready = this._open()
  }

  [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
    return this.constructor.name + '(\n' +
      indent + '  url: ' + opts.stylize(this.url, 'string') + '\n' +
      indent + '  storagePath: ' + opts.stylize(this.storagePath, 'string') + '\n' +
      indent + ')'
  }

  async _open () {
    await this.vault.ready()
    await this.node.ready()
  }

  ready () { return this.node.ready() }

  connected () { return this.node.connected() }

  destroy () { return this.node.destroy() }

  async create (opts) {
    const {
      ownerSigningKey,
      ownerSigningKeyProof,
    } = opts
    const validProof = verify(
      keyToBuffer(this.publicKey),
      ownerSigningKeyProof,
      ownerSigningKey
    )
    if (!validProof){
      debug('invalid proof')
      throw new Error(`invalid ownerSigningKeyProof`)
    }
    // this.keys.set({ publicKey: ownerSigningKey })
    const doc = await this.node.create()
    debug('created', doc)
    await this.hostKeys.set(doc.id, doc.secretKey)
    await this.ownerKeys.set(doc.id, ownerSigningKey)
    return doc.id
  }

  async getInfo (id) {
    // const secretKey = await this.hostKeys.get(id)
    const doc = await this.node.get(id)
    debug('getInfo', { id, doc })
    if (!doc) return
    return doc.info()
  }

  async getEntry (id, index) {
    const doc = await this.node.get(id)
    if (doc) return await doc.get(index)
  }

  async append(id, block, signature){
    const secretKey = await this.hostKeys.get(id)
    const ownerSigningKey = await this.ownerKeys.get(id)
    if (!secretKey || !ownerSigningKey){
      throw new Error(`not hosted here`)
    }

    const validSignature = verify(
      block,
      signature,
      ownerSigningKey
    )
    if (!validSignature){
      throw new Error('invalid signature')
    }
    const doc = await this.node.get(id, secretKey)
    if (!doc || !doc.writable){
      throw new Error('unauthorized')
    }
    await doc.append(block)
    return {
      id: doc.id,
      length: doc.length,
    }
  }

}
