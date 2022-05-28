#!/usr/bin/env node

require('dotenv').config()
const JlinxHost = require('../')

const host = new JlinxHost({
  port: process.env.PORT,
  storagePath: process.env.JLINX_STORAGE,
})

host.start().catch(error => {
  console.error(error)
  process.exit(1)
})
