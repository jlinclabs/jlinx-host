const Debug = require('debug')
const { promisify } = require('util')
const http = require('http')
const Path = require('path')
const express = require('express')
const ExpressPromiseRouter = require('express-promise-router')
const bodyParser = require('body-parser')
const { keyToString } = require('jlinx-util')

const debug = Debug('jlinx:http-server')


module.exports = function (jlinx) {

  const app = express()

  app.start = async function start(options = {}){
    debug('starting')

    debug('connecting to jlinx…')
    app.ready = jlinx.connected().then(async () => {
      console.log(`jlinx agent public key: ${jlinx.publicKey}`)
    })

    app.server = http.createServer(app).listen(options.port)
    // app.server = await promisify(app.listen).call(app, port)
    app.port = app.server.address().port
    app.url = options.url || `http://localhost:${app.port}`
    console.log(`jlinx http server running ${app.url}`)
  }

  app.destroy = function stop() {
    if (app.server) return app.server.close()
  }

  // app.use(express.static(__dirname + '/public'));
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json({ }))

  // ROUTES
  app.routes = new ExpressPromiseRouter
  app.use(app.routes)

  app.routes.use(async (req, res, next) => {
    debug(req.method, req.url)
    await app.ready
    next()
  })

  app.routes.get('/', async (req, res) => {
    res.json({
      status: 'ok',
      publicKey: jlinx.publicKey,
    })
  })

  app.routes.get('/status', async (req, res) => {
    const status = await jlinx.node.status()
    res.json(status)
  })

  app.routes.post('/create', async (req, res) => {
    const {
      ownerSigningKey,
      ownerSigningKeyProof
    } = req.body
    debug('creating', { ownerSigningKey })
    const id = await jlinx.create({
      ownerSigningKey: Buffer.from(ownerSigningKey, 'hex'),
      ownerSigningKeyProof: Buffer.from(ownerSigningKeyProof, 'hex')
    })
    res.json({ id })
  })

  // const KEY_ROUTE_REGEXP = /^\/([A-Za-z0-9\-_]{43})$/
  app.routes.use(/^\/([A-Za-z0-9\-_]{43})(\/|$)/, async (req, res, next) => {
    req.id = req.params[0]
    console.log({ key: req.key })
    next()
  })

  // getInfo (id)
  app.routes.get(/^\/([A-Za-z0-9\-_]{43})$/, async (req, res) => {
    const { id } = req
    debug('getInfo', { id })
    const info = await jlinx.getInfo(req.id)
    debug('getInfo', { id, info })
    if (!info) return res.status(404).json({})
    res.json(info)
    // TODO consider streaming entire core here
  })

  // getEntry (id, index)
  app.routes.get(/^\/([A-Za-z0-9\-_]{43})\/(\d+)$/, async (req, res) => {
    // const { id } = req
    const id = req.params[0]
    const index = parseInt(req.params[1], 10)
    debug('getEntry', { id, index })
    const entry = await jlinx.getEntry(id, index)
    if (!entry) return res.status(404).end()
    res.send(entry)
  })

  // append
  app.routes.post(/^\/([A-Za-z0-9\-_]{43})$/, async (req, res) => {
    debug('append', { id })
    const signature = req.header('jlinx-signature')
    await jlinx.append(req.id, req.body, signature)
    res.end()
  })

  app.routes.use(async (error, req, res, next) => {
    debug('ERROR', error)
    res.status(500).json({
      error: `${error}`,
      stack: error.stack.split('\n'),
    })
  })

  return app
}
