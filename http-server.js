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
    const doc = await jlinx.create({
      ownerSigningKey,
      ownerSigningKeyProof
    })
    res.json({ id: doc.id })
  })

  const KEY_ROUTE_REGEXP = /^\/([A-Za-z0-9\-_]{43})$/
  app.routes.use(KEY_ROUTE_REGEXP, async (req, res, next) => {
    req.key = req.params[0]
    console.log({ key: req.key })
    next()
  })

  // get
  app.routes.get(KEY_ROUTE_REGEXP, async (req, res) => {
    const { key } = req
    const doc = await jlinx.get(key)
    if (!doc) return res.status(404).json({})
    await doc.ready()
    let header
    if (doc.length > 0) header = await doc.get(0)
    res.json({
      id: doc.id,
      length: doc.length,
      header,
    })
  })

  // append
  app.routes.post(KEY_ROUTE_REGEXP, async (req, res) => {
    const { key } = req
    // const { did } = req
    // const { secret, value } = req.body
    // debug('amending did')
    // await jlinx.server.amendDid({
    //   did, secret, value
    // })
    // res.json({})
  })

  app.routes.use(async (error, req, res, next) => {
    res.status(500).json({
      error: `${error}`,
      stack: error.stack.split('\n'),
    })
  })

  return app
}
