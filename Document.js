const Debug = require('debug')

const debug = Debug('jlinx:host:document')

const {
  verify
} = require('jlinx-util')

module.exports = class Document {
  static async open (opts) {
    const DocumentClass = Document
    // if opts changes type
    const doc = new DocumentClass(opts)
    await doc.ready()
    return doc
  }

  constructor (opts) {
    this.id = opts.id
    this.core = opts.core
    this.ownerSigningKey = opts.ownerSigningKey
    this._opening = this._open()
  }

  get length () { return this.core.length || 0 }
  get writable () { return this.core.writable || false }

  [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
    return this.constructor.name + '(\n' +
      indent + '  id: ' + opts.stylize(this.id, 'string') + '\n' +
      indent + '  writable: ' + opts.stylize(this.writable, 'boolean') + '\n' +
      indent + '  length: ' + opts.stylize(this.length, 'number') + '\n' +
      indent + ')'
  }

  ready () { return this._opening }

  async _open () {
    await this.core.ready()
    debug('open', this)
  }

  async update () {
    await this.core.update()
  }

  async get (index) {
    debug('get', this.id, index)
    await this.ready()
    const entry = await this.core.get(index)
    debug('get', index, entry)
    return entry
  }

  async getHeader () {
    await this.ready()
    const length = this.core.length
    if (length === 0) return { length: 0 }

    const buffer = await this.core.get(0)
    let header = {}
    try {
      header = JSON.parse(buffer)
    } catch (error) {
      header.errorParsingHeader = `${error.message}`
    }
    header = {
      ...header,
      id: this.id,
      length: this.core.length
    }
    debug('getHeader ->', header)
    return header
  }

  async append (block, signature) {
    debug('append', this, { blockLength: block.length })
    debug('append verify signature', {
      block,
      signature,
      ownerSigningKey: this.ownerSigningKey
    })
    const validSignature = verify(
      block,
      signature,
      this.ownerSigningKey
    )
    if (!validSignature) {
      throw new Error('append failed: invalid signature')
    }
    await this.core.append([block])
  }

  sub (/* handler */) {
    throw new Error('sub is not supported yet')
  }

  async waitForUpdate (theirLength = this.length) {
    debug('waitForUpdate', this, { theirLength })
    await this.ready()
    await this.update()
    const ourLength = this.length
    debug('waitForUpdate', this, { theirLength, ourLength })
    if (theirLength > ourLength) {
      throw Error(
        'waitForUpdate given invalid length ' +
        `"${theirLength}" expected <= "${ourLength}"`
      )
    }
    if (theirLength < ourLength) {
      debug('waitForUpdate', 'already longer')
      return Promise.resolve(ourLength)
    }
    if (theirLength >= ourLength) {
      return new Promise((resolve, reject) => {
        this.core.once('append', async () => {
          debug('waitForUpdate APPEND!', this, {
            theirLength,
            newLength: this.core.length
          })
          debug('waitForUpdate', 'append!', this.core.length)
          resolve(this.core.length)
        })
      })
    }
  }
}
