const Debug = require('debug')
const b4a = require('b4a')
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
    app.port = app.server.address().port
    app.url = options.url || `http://localhost:${app.port}`
    console.log(`jlinx http server running ${app.url}`)
  }

  app.destroy = function stop() {
    if (app.server) return app.server.close()
  }

  // app.use(express.static(__dirname + '/public'));
  // app.use(bodyParser.urlencoded({ extended: false }))
  // app.use(bodyParser.json({ }))

  const jsonBodyParser = bodyParser.json({ })

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

  // create
  app.routes.post(
    '/create',
    jsonBodyParser,
    async (req, res) => {
      const {
        ownerSigningKey,
        ownerSigningKeyProof
      } = req.body
      if (
        !ownerSigningKey ||
        !ownerSigningKeyProof
      ) return res.status(400).end()
      const id = await jlinx.create({
        ownerSigningKey: Buffer.from(ownerSigningKey, 'hex'),
        ownerSigningKeyProof: Buffer.from(ownerSigningKeyProof, 'hex')
      })
      res.status(201).json({ id, legnth: 0 })
    }
  )

  // getLength (id)
  app.routes.get(/^\/([A-Za-z0-9\-_]{43})$/, async (req, res) => {
    const id = req.params[0]
    debug('getLength', { id })
    const length = await jlinx.getLength(id)
    res.json({ length })
    // TODO consider streaming entire core here if accepts
  })

  // getEntry (id, index)
  app.routes.get(/^\/([A-Za-z0-9\-_]{43})\/(\d+)$/, async (req, res) => {
    const id = req.params[0]
    const index = parseInt(req.params[1], 10)
    debug('getEntry', { id, index })
    const entry = await jlinx.getEntry(id, index)
    res.set("Content-Disposition", `attachment; filename="${id}-${index}"`)
    res.send(entry)
  })

  // append
  app.routes.post(
    /^\/([A-Za-z0-9\-_]{43})$/,
    bodyParser.raw(),
    async (req, res) => {
      const id = req.params[0]
      let signature = req.header('jlinx-signature')
      const block = req.body
      debug('append', { id, blockLength: block.length })
      if (signature) signature = b4a.from(signature, 'hex')
      try{
        const length = await jlinx.append(id, block, signature)
        res.status(200).json({ length })
        debug('append success', { id, length })
      }catch(error){
        if (error.message === 'invalid signature'){
          debug('append: invalid signature')
          res.statusMessage = error.message
          return res.status(400).send(error.message)
        }
        throw error
      }
    }
  )

  app.routes.get(
    /^\/([A-Za-z0-9\-_]{43})\/(\d+|-1)\/next$/,
    async (req, res) => {
      const id = req.params[0]
      const index = parseInt(req.params[1], 10)
      const length = index + 1
      debug('waitForUpdate', { id, length })
      const newLength = await jlinx.waitForUpdate(id, length)
      res.json({ length: newLength })
    }
  )
  // onChange

  app.routes.get(/^\/([A-Za-z0-9\-_]{43})\/onchange$/, async (req, res) => {
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
