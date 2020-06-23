const EthQuery = require('eth-query')
const createVm = require('ethereumjs-vm/dist/hooked').fromWeb3Provider
const blockFromRpc = require('ethereumjs-block/from-rpc')
const FakeTransaction = require('ethereumjs-tx/fake')
const scaffold = require('./scaffold')

const ethCallBlockRefIndex = 1

module.exports = function createVmMiddleware ({ provider }) {
  const ethQuery = new EthQuery(provider)

  return scaffold({
    eth_call: (req, res, _next, end) => {
      const blockRef = req.params[ethCallBlockRefIndex]
      ethQuery.getBlockByNumber(blockRef, false, (err, blockParams) => {
        if (err) {
          return end(err)
        }
        // create block
        const block = blockFromRpc(blockParams)
        runVm(req, block, (vmErr, results) => {
          if (vmErr) {
            return end(vmErr)
          }
          const returnValue = results.vm.return ? `0x${results.vm.return.toString('hex')}` : '0x'
          res.result = returnValue
          return end()
        })
        return undefined
      })
    },
  })

  function runVm (req, block, cb) {
    const [{ ...txParams }, blockRef] = req.params
    // opting to use blockRef as specified
    // instead of hardening to resolved block's number
    // for compatiblity with eth-json-rpc-ipfs
    // const blockRef = block.number.toNumber()

    // create vm with state lookup intercepted
    const vm = createVm(provider, blockRef, {
      enableHomestead: true,
    })

    // create tx
    txParams.from = txParams.from || '0x0000000000000000000000000000000000000000'
    txParams.gasLimit = txParams.gasLimit || (`0x${block.header.gasLimit.toString('hex')}`)
    const tx = new FakeTransaction(txParams)

    vm.runTx({
      tx,
      block,
      skipNonce: true,
      skipBalance: true,
    }, function (err, results) {
      if (err) {
        return cb(err)
      }
      if (results.error) {
        return cb(new Error(`VM error: ${results.error}`))
      }
      if (results.vm && results.vm.exception !== 1 && results.vm.exceptionError !== 'invalid opcode') {
        return cb(new Error(`VM Exception while executing ${req.method}: ${results.vm.exceptionError}`))
      }
      return cb(null, results)
    })
  }
}
