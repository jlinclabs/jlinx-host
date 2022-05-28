const Debug = require('debug')
const { promisify } = require('util')
const http = require('http')
const Path = require('path')
const express = require('express')
const ExpressPromiseRouter = require('express-promise-router')
const bodyParser = require('body-parser')

const debug = Debug('jlinx:http-server')


module.exports = function (opts) {

  const app = express()

  // app.port = opts.port
  app.jlinx = opts.jlinx

  app.start = async function start(port){
    debug('starting')

    debug('connecting to jlinx…')
    app.ready = app.jlinx.connected().then(async () => {
      const agentPublicKey = await app.jlinx.publicKey
      app.locals.agentPublicKey = agentPublicKey
      console.log(`jlinx agent public key: ${agentPublicKey}`)
    })

    app.server = http.createServer(app).listen(port)
    // app.server = await promisify(app.listen).call(app, port)
    app.port = app.server.address().port
    console.log(`jlinx http server running http://localhost:${app.port}`)
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

  app.routes.get('/', async (req, res, next) => {
    const { did } = req.query
    if (did && did.startsWith('did:')) return res.redirect(`/${did}`)

    if (req.accepts('html')) return res.render('index')
    next()
  })

  // get
  app.routes.use(/^([A-Za-z0-9\-_]{43})$/, async (req, res, next) => {
    req.key = req.params[0]
    console.log({ key: req.key })
    next()
    // if (!isJlinxDid(req.did))
    //   renderError(req, res, `invalid did DID=${req.did}`, 400)
    // else
    //   next()
  })


  app.routes.get('/status', async (req, res, next) => {
    const status = await app.jlinx.server.hypercore.status()
    res.json({
      hypercore: status,
    })
  })

  app.routes.post('/new', async (req, res, next) => {
    const { did, secret } = await app.jlinx.server.createDid()
    res.json({ did, secret })
  })

  app.routes.post(/^\/(did:.+)$/, async (req, res, next) => {
    const { did } = req
    const { secret, value } = req.body
    debug('amending did')
    await app.jlinx.server.amendDid({
      did, secret, value
    })
    res.json({})
  })

  return app
}
