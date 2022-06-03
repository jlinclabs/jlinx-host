const Debug = require('debug')
const Path = require('path')
const JlinxNode = require('jlinx-node')
const {
  keyToBuffer,
  keyToString,
  // sign,
  verify,
  createSigningKeyPair,
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

  async create ({
    ownerSigningKey,
    ownerSigningKeyProof,
  }) {
    debug('create', { ownerSigningKey })
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
    // const doc = await this.node.create()
    const { publicKey, secretKey } = createSigningKeyPair()
    const id = keyToString(publicKey)
    debug('created', { id })
    await this.hostKeys.set(id, secretKey)
    await this.ownerKeys.set(id, ownerSigningKey)
    return id
  }

  async getLength (id) {
    debug('getLength', { id })
    return await this.node.getLength(id)
  }

  async getEntry (id, index) {
    debug('getEntry', { id, index })
    return this.node.getEntry(id, index)
  }

  async append(id, block, signature){
    debug('append', { id, blockLength: block.length })
    const secretKey = await this.hostKeys.get(id)
    const ownerSigningKey = await this.ownerKeys.get(id)
    if (!secretKey || !ownerSigningKey){
      throw new Error(`not hosted here`)
    }
    debug('append verify signature', {
      block,
      signature,
      ownerSigningKey
    })
    const validSignature = verify(
      block,
      signature,
      ownerSigningKey
    )
    if (!validSignature){
      throw new Error('invalid signature')
    }
    const length = await this.node.append(id, secretKey, [block])
    return length
  }

}



// class Document {
//   constructor (node, core, secretKey) {
//     this.node = node
//     this.core = core
//     this.secretKey = secretKey
//     this.id = keyToString(core.key)
//     this._subs = new Set()
//     this.core.on('close', () => this._close())
//     this.core.on('append', () => this._onAppend())
//   }

//   // get key () { return this.core.key }
//   // get publicKey () { return keyToBuffer(this.core.key) }
//   get writable () { return this.core.writable }
//   get length () { return this.core.length }
//   ready () { return this.core.ready() }
//   _close () {
//     console.log('??_close', this.key)
//   }

//   _onAppend () {
//     this._subs.forEach(handler => {
//       Promise.resolve()
//         .then(() => handler(this))
//         .catch(error => {
//           console.error(error)
//         })
//     })
//   }

//   async info() {
//     await this.ready()
//     return {
//       id: this.id,
//       length: this.length,
//       // consider more metadata here like host or docType
//     }
//   }
//   get (index) {
//     return this.core.get(index)
//   }

//   append (blocks) {
//     if (!this.writable){
//       throw new Error(`jlinx document is not writable`)
//     }
//     return this.core.append(blocks)
//   }

//   sub (handler) {
//     this._subs.add(handler)
//     return () => { this._subs.delete(handler) }
//   }

//   [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
//     let indent = ''
//     if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
//     return this.constructor.name + '(\n' +
//       indent + '  id: ' + opts.stylize(this.id, 'string') + '\n' +
//       indent + '  writable: ' + opts.stylize(this.writable, 'boolean') + '\n' +
//       indent + '  length: ' + opts.stylize(this.length, 'number') + '\n' +
//       indent + ')'
//   }
// }
