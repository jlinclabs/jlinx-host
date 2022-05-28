const JlinxNode = require('jlinx-node')
const createHttpServer = require('./http-server')

module.exports = class JlinxHost {
  constructor(opts){
    this.node = new JlinxNode({
      storagePath: opts.storagePath,
      bootstrap: opts.bootstrap,
    })

    this.httpServer = createHttpServer({
      port: opts.port,
      jlinx: this,
    })
    // this.rpc = //TBD rpc

    this._ready = this._start()
  }

  [Symbol.for('nodejs.util.inspect.custom')] (depth, opts) {
    let indent = ''
    if (typeof opts.indentationLvl === 'number') { while (indent.length < opts.indentationLvl) indent += ' ' }
    return this.constructor.name + '(\n' +
      indent + '  port: ' + opts.stylize(this.httpServer.port, 'number') + '\n' +
      indent + '  storagePath: ' + opts.stylize(this.node.storagePath, 'string') + '\n' +
      indent + ')'
  }

  async _start() {
    await this.httpServer.start()
  }

  connected () { return this.node.connected() }

  async ready () { return this._ready }

  destroy(){
    return Promise.all([
      this.node.destroy(),
      this.httpServer.destroy()
    ])
  }
}
