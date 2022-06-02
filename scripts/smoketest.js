#!/usr/bin/env node

const b4a = require('b4a')
const request = require('supertest')
const assert = require('assert')

const {
  keyToBuffer,
  createSigningKeyPair,
  validateSigningKeyPair,
  sign,
} = require('jlinx-util')


const host = process.argv[process.argv.length - 1]

const bail = error => {
  console.error(error)
  process.exit(1)
}

if (!host) {
  bail(`host argument required`)
}
console.log({ host })

if (host.endsWith('.test')){
  console.log('disabling certificate verification')
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const signingKeyPair = createSigningKeyPair()
// const signingKeyPair = {
//   publicKey: b4a.from('e5b9efc97c5bb2c85302d83212076b3800fe54120123ca02fa708498516b671c', 'hex'),
//   secretKey: b4a.from('846f5eda538270cdfed216af152b8e6c6ba25205554770f3a927190ba376891ce5b9efc97c5bb2c85302d83212076b3800fe54120123ca02fa708498516b671c', 'hex'),
// }

if (!validateSigningKeyPair(signingKeyPair)){
  bail('invalid keypair')
}


async function main(){
  let hostPublicKey
  await request(host)
    .get('/')
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      console.log(res.body)
      const { status, publicKey } = res.body
      assert(status === 'ok')
      assert(typeof publicKey, 'string')
      assert(publicKey.length === 43)
      hostPublicKey = publicKey
    })

  await request(host)
    .post('/create')
    .expect(400)

  const id1 = await request(host)
    .post('/create')
    .send({
      ownerSigningKey: signingKeyPair.publicKey.toString('hex'),
      ownerSigningKeyProof: sign(
        keyToBuffer(hostPublicKey),
        signingKeyPair.secretKey
      ).toString('hex')
    })
    .expect('Content-Type', /json/)
    .expect(201)
    .then(res => {
      const { id } = res.body
      return id
    })

  await request(host)
    .get(`/${id1}`)
    .expect('Content-Type', /json/)
    .expect(200)
    .then(res => {
      assert(res.body.length === 0)
    })


  console.log('SUCCESS!')
}

main().then(
  () => { process.exit(0) },
  error => { bail(error) }
)

// async function fetch (method, path, options = {}) {
//   const { default: fetch } = await import('node-fetch')
//   const url = `${host}`.replace(/\/+$/, '') + '/' + `${path}`.replace(/^\/+/, '')
//   console.log('fetch', url, options)
//   if (options.body) options.body = JSON.stringify(options.body)
//   const response = await fetch(url, {
//     method,
//     headers: {
//       Accept: 'application/json',
//       ...options.headers,
//     }
//   })
//   if (response.status >= 500) {
//     console.error({
//       url,
//       status: response.status,
//       statusText: response.statusText
//     })
//     throw new Error(`request failed url="${url}"`)
//   }
//   console.log('fetch', { url, options, status: response.status })
//   return response
// }

// // async function getJson (path, options = {}) {
// //   const response = await fetch(
// //     path,
// //     {
// //       ...options,
// //       headers: {
// //         ...options.headers,
// //         Accept: 'application/json'
// //       }
// //     }
// //   )
// //   if (response.status < 300) {
// //     return await response.json()
// //   }
// // }

// // async function postJson (path, body, options = {}) {
// //   const response = await fetch(
// //     path,
// //     {
// //       ...options,
// //       method: 'post',
// //       body: JSON.stringify(body),
// //       headers: {
// //         ...options.headers,
// //         'Content-Type': 'application/json'
// //       }
// //     }
// //   )
// //   return await response.json()
// // }


// // function getJson(path){
// //   const url = `${host}`.replace(/\/+$/, '') + '/' + path
// //   const response = fetch(url, {
// //     method: 'get'
// //   })
// //   if (!response.ok){
// //     console.error({
// //       status: response.status
// //     })
// //     throw new Error(`request failed`)
// //   }

// // }
