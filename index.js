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
const Keystore = require('jlinx-keystore')

const debug = Debug('jlinx:host')

module.exports = class JlinxHost {
  constructor(opts){
    this.url = opts.url
    if (!this.url){
      throw new Error('invalid jlinx host url')
    }
    this.keyPair = {
      publicKey: opts.publicKey,
      secretKey: opts.secretKey
    }
    if (!validateSigningKeyPair(this.keyPair)){
      throw new Error('invalid jlinx host signing key pair')
    }
    this.publicKey = keyToString(this.keyPair.publicKey)

    if (!opts.vaultKey || opts.vaultKey.length !== 32){
      throw new Error('invalid jlinx host vault key')
    }
    this.storagePath = opts.storagePath

    this.node = new JlinxNode({
      storagePath: Path.join(opts.storagePath, 'cores'),
      bootstrap: opts.bootstrap,
      keyPair: this.keyPair,
    })
    this.coreKeys = new Keystore(Path.join(opts.storagePath, 'coreKeys'))
    this.ownerKeys = new Keystore(Path.join(opts.storagePath, 'ownerKeys'))
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

  _open () {
    // this.keyPair = this.
  }

  ready () { return this.node.ready() }
  connected () { return this.node.connected() }
  destroy () { return this.node.destroy() }

  async get (id) {
    // get record from private storage
    const doc = await this.node.get(id)
    return doc
  }

  async create (opts) {
    const {
      ownerSigningKey,
      ownerSigningKeyProof,
    } = opts
    debug('create', {
      ownerSigningKey,
      ownerSigningKeyProof,
      hostPublicKey: this.publicKey,
    })
    const validProof = verify(
      keyToBuffer(this.publicKey),
      ownerSigningKeyProof,
      ownerSigningKey
    )
    if (!validProof){
      debug('invalid proof')
      throw new Error(`invalid ownerSigningKeyProof`)
    }
    this.ownerKeys.put({ publicKey: ownerSigningKey })
    const doc = await this.node.create()
    debug('created', doc)
    const { publicKey, secretKey } = doc
    this.coreKeys.put({ publicKey, secretKey })
    return doc
  }

}


// function validateOwnerSecretKey(){

// }
