#!/usr/bin/env node

const b4a = require('b4a')

require('dotenv').config({
  path: process.env.CONFIG
})

console.log({
  JLINX_STORAGE: process.env.JLINX_STORAGE,
  URL: process.env.URL,
  PORT: process.env.PORT
})

const JlinxHost = require('../')
const createHttpServer = require('../http-server')

const jlinx = new JlinxHost({
  url: process.env.URL,
  storagePath: process.env.JLINX_STORAGE,
  keyPair: {
    publicKey: b4a.from(process.env.JLINX_PUBLIC_KEY, 'hex'),
    secretKey: b4a.from(process.env.JLINX_SECRET_KEY, 'hex')
  },
  vaultKey: b4a.from(process.env.JLINX_VAULT_KEY, 'hex')
})

const httpServer = createHttpServer(jlinx)

httpServer.start({
  url: process.env.URL,
  port: process.env.PORT
}).catch(error => {
  console.error(error)
  process.exit(1)
})
