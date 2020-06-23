const createAsyncMiddleware = require('json-rpc-engine/src/createAsyncMiddleware')
const createScaffoldMiddleware = require('json-rpc-engine/src/createScaffoldMiddleware')
const sigUtil = require('eth-sig-util')

module.exports = function createWalletMiddleware (opts = {}) {
  // parse + validate options
  const { getAccounts } = opts
  const { processTypedMessage } = opts
  const { processTypedMessageV3 } = opts
  const { processTypedMessageV4 } = opts
  const { processPersonalMessage } = opts
  const { processEthSignMessage } = opts
  const { processTransaction } = opts
  const { processDecryptMessage } = opts
  const { processEncryptionPublicKey } = opts

  if (!getAccounts) {
    throw new Error('WalletMiddleware - opts.getAccounts not provided')
  }

  return createScaffoldMiddleware({
    // account lookups
    'eth_accounts': createAsyncMiddleware(lookupAccounts),
    'eth_coinbase': createAsyncMiddleware(lookupDefaultAccount),
    // tx signatures
    'eth_sendTransaction': createAsyncMiddleware(sendTransaction),
    // message signatures
    'eth_sign': createAsyncMiddleware(ethSign),
    'eth_signTypedData': createAsyncMiddleware(signTypedData),
    'eth_signTypedData_v3': createAsyncMiddleware(signTypedDataV3),
    'eth_signTypedData_v4': createAsyncMiddleware(signTypedDataV4),
    'personal_sign': createAsyncMiddleware(personalSign),
    'eth_getEncryptionPublicKey': createAsyncMiddleware(encryptionPublicKey),
    'eth_decrypt': createAsyncMiddleware(decryptMessage),
    'personal_ecRecover': createAsyncMiddleware(personalRecover),
  })

  //
  // account lookups
  //

  async function lookupAccounts (req, res) {
    res.result = await getAccounts(req)
  }

  async function lookupDefaultAccount (req, res) {
    const accounts = await getAccounts(req)
    res.result = accounts[0] || null
  }

  //
  // transaction signatures
  //

  async function sendTransaction (req, res) {

    if (!processTransaction) {
      throw new Error('WalletMiddleware - opts.processTransaction not provided')
    }

    const txParams = req.params[0] || {}
    await validateAndNormalizeKeyholder(txParams.from, req)
    res.result = await processTransaction(txParams, req)
  }

  //
  // message signatures
  //

  async function ethSign (req, res) {

    if (!processEthSignMessage) {
      throw new Error('WalletMiddleware - opts.processEthSignMessage not provided')
    }

    const [address, message, extraParams = {}] = req.params
    const msgParams = {
      ...extraParams,
      from: await validateAndNormalizeKeyholder(address, req),
      data: message,
    }

    res.result = await processEthSignMessage(msgParams, req)
  }

  async function signTypedData (req, res) {

    if (!processTypedMessage) {
      throw new Error('WalletMiddleware - opts.processTypedMessage not provided')
    }

    const [message, address, extraParams = {}] = req.params
    const version = 'V1'
    const msgParams = {
      ...extraParams,
      from: await validateAndNormalizeKeyholder(address, req),
      data: message,
    }

    res.result = await processTypedMessage(msgParams, req, version)
  }

  async function signTypedDataV3 (req, res) {

    if (!processTypedMessageV3) {
      throw new Error('WalletMiddleware - opts.processTypedMessage not provided')
    }

    const [address, message] = req.params
    const version = 'V3'
    const msgParams = {
      data: message,
      from: await validateAndNormalizeKeyholder(address, req),
      version,
    }

    res.result = await processTypedMessageV3(msgParams, req, version)
  }

  async function signTypedDataV4 (req, res) {

    if (!processTypedMessageV4) {
      throw new Error('WalletMiddleware - opts.processTypedMessage not provided')
    }

    const [address, message] = req.params
    const version = 'V4'
    const msgParams = {
      data: message,
      from: await validateAndNormalizeKeyholder(address, req),
      version,
    }

    res.result = await processTypedMessageV4(msgParams, req, version)
  }

  async function personalSign (req, res) {

    if (!processPersonalMessage) {
      throw new Error('WalletMiddleware - opts.processPersonalMessage not provided')
    }

    const [firstParam, secondParam, extraParams = {}] = req.params

    // We initially incorrectly ordered these parameters.
    // To gracefully respect users who adopted this API early,
    // we are currently gracefully recovering from the wrong param order
    // when it is clearly identifiable.
    //
    // That means when the first param is definitely an address,
    // and the second param is definitely not, but is hex.
    let address, message
    if (resemblesAddress(firstParam) && !resemblesAddress(secondParam)) {
      let warning = `The eth_personalSign method requires params ordered `
      warning += `[message, address]. This was previously handled incorrectly, `
      warning += `and has been corrected automatically. `
      warning += `Please switch this param order for smooth behavior in the future.`
      res.warning = warning

      address = firstParam
      message = secondParam
    } else {
      message = firstParam
      address = secondParam
    }
    address = await validateAndNormalizeKeyholder(address, req)

    const msgParams = {
      ...extraParams,
      from: address,
      data: message,
    }

    res.result = await processPersonalMessage(msgParams, req)
  }

  async function personalRecover (req, res) {

    const [message, signature, extraParams = {}] = req.params
    const msgParams = {
      ...extraParams,
      sig: signature,
      data: message,
    }
    const signerAddress = sigUtil.recoverPersonalSignature(msgParams)

    res.result = signerAddress
  }

  async function encryptionPublicKey (req, res) {

    if (!processEncryptionPublicKey) {
      throw new Error('WalletMiddleware - opts.processEncryptionPublicKey not provided')
    }

    const address = await validateAndNormalizeKeyholder(req.params[0], req)

    res.result = await processEncryptionPublicKey(address, req)
  }

  async function decryptMessage (req, res) {

    if (!processDecryptMessage) {
      throw new Error('WalletMiddleware - opts.processDecryptMessage not provided')
    }

    const [ciphertext, address, extraParams = {}] = req.params
    const msgParams = {
      ...extraParams,
      from: await validateAndNormalizeKeyholder(address, req),
      data: ciphertext,
    }

    res.result = await processDecryptMessage(msgParams, req)
  }

  //
  // utility
  //

  /**
   * Validates the keyholder address, and returns a normalized (i.e. lowercase)
   * copy of it.
   *
   * @param {string} address - The address to validate and normalize.
   * @param {Object} req - The request object.
   * @returns {string} - The normalized address, if valid. Otherwise, throws
   * an error
   */
  async function validateAndNormalizeKeyholder (address, req) {

    if (typeof address === 'string' && address.length > 0) {

      // ensure address is included in provided accounts
      const accounts = await getAccounts(req)
      const normalizedAccounts = accounts.map((_address) => _address.toLowerCase())
      const normalizedAddress = address.toLowerCase()

      if (normalizedAccounts.includes(normalizedAddress)) {
        return normalizedAddress
      }
    }
    throw new Error('WalletMiddleware - Invalid keyholder address.')
  }
}

function resemblesAddress (string) {
  // hex prefix 2 + 20 bytes
  return string.length === (2 + (20 * 2))
}
