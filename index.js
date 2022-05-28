const Debug = require('debug')
const Path = require('path')
const JlinxNode = require('jlinx-node')
const {
  keyToBuffer,
  validateSigningKeyPair,
} = require('jlinx-util')
const Keystore = require('jlinx-keystore')

const debug = Debug('jlinx:host')

module.exports = class JlinxHost {
  constructor(opts){
    if (!opts.url){
      throw new Error('invalid jlinx host url')
    }
    if (!validateSigningKeyPair({ publicKey: opts.publicKey, secretKey: opts.secretKey })){
      throw new Error('invalid jlinx host signing key pair')
    }
    console.log(opts.vaultKey.length)
    if (!opts.vaultKey || opts.vaultKey.length !== 32){
      throw new Error('invalid jlinx host vault key')
    }
    this.url = opts.url
    this.storagePath = opts.storagePath
    this.publicKey = opts.publicKey
    this.secretKey = opts.secretKey

    this.vaultKey = opts.vaultKey

    this.node = new JlinxNode({
      storagePath: Path.join(opts.storagePath, 'cores'),
      bootstrap: opts.bootstrap,
    })
    this.coreKeys = new Keystore({
      storagePath: Path.join(opts.storagePath, 'coreKeys'),
    })
    this.ownerKeys = new Keystore({
      storagePath: Path.join(opts.storagePath, 'ownerKeys'),
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

  _open () {
    // this.keyPair = this.
  }

  ready () { return this.node.ready() }
  connected () { return this.node.connected() }
  destroy () { return this.node.destroy() }

  async get (id) {
    // get record from private storage
    const doc = await this.node.get(id)
  }

  async create (opts) {
    opts.ownerSecretKey
    opts.ownerSecretKeyProof

    const doc = await this.node.create()
    const { publicKey, secretKey } = doc
    this.keys.put(publicKey, secretKey)
    debug('created', doc)
    debug({
      id: doc.id,
      secretKey: doc.doc,
    })
    return doc
  }


}


function validateOwnerSecretKey(){

}
