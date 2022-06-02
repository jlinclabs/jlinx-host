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
  app.routes = new ExpressPromiseRouter({ mergeParams: true })
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
    const id = await jlinx.create({
      ownerSigningKey: Buffer.from(ownerSigningKey, 'hex'),
      ownerSigningKeyProof: Buffer.from(ownerSigningKeyProof, 'hex')
    })
    res.json({ id })
  })


  const slashId = new ExpressPromiseRouter
  app.routes.use(
    /^\/([A-Za-z0-9\-_]{43})(?:\/.+|$)/,
    (req, res, next) => {
      req.id = req.params[0]
      debug({ id: req.id })
      return slashId(req, res, next)
    }
  )

  slashId.use(async (req, res, next) => {
    debug({ url: req.url })
    next()
  })

  // getLength (id)
  // GET /:id
  slashId.get('/', async (req, res) => {
    const length = await jlinx.getLength(req.id)
    res.json({ length })
    // TODO consider streaming entire core here if accepts
  })

  // getEntry (id, index)
  // GET /:id/:index
  slashId.get(/^\/(\d+)$/, async (req, res) => {
    debug({ params: req.params })
    const index = parseInt(req.params[0], 10)
    const entry = await jlinx.getEntry(req.id, index)
    res.send(entry)
  })

  // append
  // POST /:id
  slashId.post('/', async (req, res) => {
    const signature = req.header('jlinx-signature')
    await jlinx.append(req.id, req.body, signature)
    res.end()
  })

  // onChange
  // GET /:id/change
  slashId.get('change', async (req, res) => {
    res.json({ TBD: true })
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
