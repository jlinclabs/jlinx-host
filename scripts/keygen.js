#!/usr/bin/env node

const sodium = require('sodium-universal')
const b4a = require('b4a')

const buffer = b4a.allocUnsafe(sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES)
sodium.crypto_secretstream_xchacha20poly1305_keygen(buffer)
console.log(buffer.toString('hex'))
