const Debug = require('debug')
const b4a = require('b4a')
const http = require('http')
const express = require('express')
const ExpressPromiseRouter = require('express-promise-router')
const bodyParser = require('body-parser')
const multibase = require('jlinx-util/multibase')

const debug = Debug('jlinx:host:http-server')

module.exports = function (jlinx) {
  const app = express()

  app.jlinx = jlinx

  app.start = async function start (options = {}) {
    debug('starting')

    debug('connecting to jlinx…')
    app.ready = jlinx.connected().then(async () => {
      console.log(`jlinx agent public key: ${multibase.encode(jlinx.publicKey)}`)
    })

    app.server = http.createServer(app).listen(options.port)
    app.port = app.server.address().port
    app.url = options.url || `http://localhost:${app.port}`
    console.log(`jlinx http server running ${app.url}`)
  }

  app.destroy = function stop () {
    if (app.server) return app.server.close()
  }

  const jsonBodyParser = bodyParser.json({
    // limit: 999999,
    limit: 102400 * 10
  })

  // ROUTES
  app.routes = new ExpressPromiseRouter()
  app.use(app.routes)

  let idSeq = 0
  app.routes.use(async (req, res, next) => {
    const id = idSeq++
    debug('REQ open', id, req.method, req.url)
    res.on('close', () => {
      debug('REQ close', id, {
        statusCode: res.statusCode,
        headers: res._headers
      })
    })

    try {
      await app.ready
    } catch (error) {
      console.error(error)
    }

    debug('hypercore status', await jlinx.node.status())
    next()
  })

  app.routes.get('/', async (req, res) => {
    res.json({
      status: 'ok',
      publicKey: multibase.encode(jlinx.publicKey)
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
      const doc = await jlinx.create({
        ownerSigningKey: Buffer.from(ownerSigningKey, 'hex'),
        ownerSigningKeyProof: Buffer.from(ownerSigningKeyProof, 'hex')
      })
      const body = { id: doc.id, length: doc.length }
      await doc.close()
      res.status(201).json(body)
    }
  )

  // getHeader (id)
  app.routes.get(/^\/(jlinx:[^/]+)$/, async (req, res) => {
    const id = req.params[0]
    debug('getHeader', { id })
    const doc = await jlinx.get(id)
    debug('getHeader updating', { doc })
    await doc.update()
    debug('getHeader updated', { doc })
    const header = await doc.getHeader()
    await doc.close()
    res.json(header)
  })

  // stream (id)
  app.routes.get(/^\/(jlinx:[^/]+)\/stream$/, async (req, res) => {
    const id = req.params[0]
    debug('stream', { id })
    const doc = await jlinx.get(id)
    let closed = false
    req.on('close', function () {
      closed = true
      doc.close()
    })
    res.set({
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive'
    })

    res.flushHeaders()
    await doc.update()
    let cursor = 0
    while (true) {
      if (closed) break
      while (cursor < doc.length) {
        if (closed) break
        let entry = await doc.get(cursor)
        debug('STREAM', { i: cursor, entry })
        try {
          entry = JSON.stringify(JSON.parse(entry), null, 2)
        } catch (e) {}
        res.write(entry)
        res.write('\n')
        cursor++
      }
      if (closed) break
      await doc.waitForUpdate(cursor)
    }
  })

  // getEntry (id, index)
  app.routes.get(/^\/(jlinx:[^/]+)\/(\d+)$/, async (req, res) => {
    const id = req.params[0]
    const index = parseInt(req.params[1], 10)
    debug('getEntry', { id, index })
    const doc = await jlinx.get(id)
    await doc.update()
    res.set('Content-Disposition', `attachment; filename="${id}-${index}"`)
    res.set('Cache-Control', 'immutable')
    res.set('Content-Disposition', 'inline')

    if (doc.length > 0) {
      const header = await doc.get(0)
      if (header) {
        try {
          const { contentType } = JSON.parse(header)
          if (contentType) {
            res.set('Content-Type', contentType)
          }
        } catch (e) {
          debug('failed to parse doc header', e)
        }
      }
    }
    const entry = await doc.get(index)
    await doc.close()
    res.send(entry)
  })

  // append
  app.routes.post(
    /^\/(jlinx:[^/]+)$/,
    bodyParser.raw({
      limit: 102400 * 10
    }),
    async (req, res) => {
      const id = req.params[0]
      let signature = req.header('jlinx-signature')
      const block = req.body
      debug('append', { id, blockLength: block.length })
      if (signature) signature = b4a.from(signature, 'hex')
      try {
        const doc = await jlinx.get(id)
        if (!doc || doc.writeable) {
          throw new Error(`${id} is not not hosted here`)
        }
        await doc.append(block, signature)
        const length = doc.length
        await doc.close()
        res.status(200).json({ length })
        debug('append success', { id, length })
      } catch (error) {
        if (error.message === 'invalid signature') {
          debug('append: invalid signature')
          res.statusMessage = error.message
          return res.status(400).send(error.message)
        }
        throw error
      }
    }
  )

  // wait for next update
  app.routes.get(
    /^\/(jlinx:[^/]+)\/(\d+|-1)\/next$/,
    async (req, res) => {
      const id = req.params[0]
      const index = parseInt(req.params[1], 10)
      const length = index + 1
      debug('waitForUpdate', { id, length })
      const doc = await jlinx.get(id)
      await doc.waitForUpdate(length)
      const nextLength = doc.length
      await doc.close()
      debug('waitForUpdate', { id, length, nextLength })
      res.json({ length: nextLength })
    }
  )

  app.routes.use('*', async (req, res, next) => {
    // catchall
    debug('catchall route', req.url)
    res.status(404).end()
  })

  app.routes.use(async (error, req, res, next) => {
    debug('ERROR', error)
    if (res.headersSent) {
      console.error(error)
      return next()
    } else {
      res.status(500).json({
        error: `${error}`,
        stack: error.stack.split('\n')
      })
    }
  })

  return app
}
