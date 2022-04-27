"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWalletMiddleware = void 0;
const json_rpc_engine_1 = require("json-rpc-engine");
const sigUtil = __importStar(require("eth-sig-util"));
const eth_rpc_errors_1 = require("eth-rpc-errors");
function createWalletMiddleware({ getAccounts, processDecryptMessage, processEncryptionPublicKey, processEthSignMessage, processPersonalMessage, processTransaction, processSignTransaction, processTypedMessage, processTypedMessageV3, processTypedMessageV4, }) {
    if (!getAccounts) {
        throw new Error('opts.getAccounts is required');
    }
    return (0, json_rpc_engine_1.createScaffoldMiddleware)({
        // account lookups
        eth_accounts: (0, json_rpc_engine_1.createAsyncMiddleware)(lookupAccounts),
        eth_coinbase: (0, json_rpc_engine_1.createAsyncMiddleware)(lookupDefaultAccount),
        // tx signatures
        eth_sendTransaction: (0, json_rpc_engine_1.createAsyncMiddleware)(sendTransaction),
        eth_signTransaction: (0, json_rpc_engine_1.createAsyncMiddleware)(signTransaction),
        // message signatures
        eth_sign: (0, json_rpc_engine_1.createAsyncMiddleware)(ethSign),
        eth_signTypedData: (0, json_rpc_engine_1.createAsyncMiddleware)(signTypedData),
        eth_signTypedData_v3: (0, json_rpc_engine_1.createAsyncMiddleware)(signTypedDataV3),
        eth_signTypedData_v4: (0, json_rpc_engine_1.createAsyncMiddleware)(signTypedDataV4),
        personal_sign: (0, json_rpc_engine_1.createAsyncMiddleware)(personalSign),
        eth_getEncryptionPublicKey: (0, json_rpc_engine_1.createAsyncMiddleware)(encryptionPublicKey),
        eth_decrypt: (0, json_rpc_engine_1.createAsyncMiddleware)(decryptMessage),
        personal_ecRecover: (0, json_rpc_engine_1.createAsyncMiddleware)(personalRecover),
    });
    //
    // account lookups
    //
    async function lookupAccounts(req, res) {
        res.result = await getAccounts(req);
    }
    async function lookupDefaultAccount(req, res) {
        const accounts = await getAccounts(req);
        res.result = accounts[0] || null;
    }
    //
    // transaction signatures
    //
    async function sendTransaction(req, res) {
        if (!processTransaction) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const txParams = req.params[0] || {};
        txParams.from = await validateAndNormalizeKeyholder(txParams.from, req);
        res.result = await processTransaction(txParams, req);
    }
    async function signTransaction(req, res) {
        if (!processSignTransaction) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const txParams = req.params[0] || {};
        txParams.from = await validateAndNormalizeKeyholder(txParams.from, req);
        res.result = await processSignTransaction(txParams, req);
    }
    //
    // message signatures
    //
    async function ethSign(req, res) {
        if (!processEthSignMessage) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const address = await validateAndNormalizeKeyholder(req.params[0], req);
        const message = req.params[1];
        const extraParams = req.params[2] || {};
        const msgParams = Object.assign(Object.assign({}, extraParams), { from: address, data: message });
        res.result = await processEthSignMessage(msgParams, req);
    }
    async function signTypedData(req, res) {
        if (!processTypedMessage) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const message = req.params[0];
        const address = await validateAndNormalizeKeyholder(req.params[1], req);
        const version = 'V1';
        const extraParams = req.params[2] || {};
        const msgParams = Object.assign(Object.assign({}, extraParams), { from: address, data: message });
        res.result = await processTypedMessage(msgParams, req, version);
    }
    async function signTypedDataV3(req, res) {
        if (!processTypedMessageV3) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const address = await validateAndNormalizeKeyholder(req.params[0], req);
        const message = req.params[1];
        const version = 'V3';
        const msgParams = {
            data: message,
            from: address,
            version,
        };
        res.result = await processTypedMessageV3(msgParams, req, version);
    }
    async function signTypedDataV4(req, res) {
        if (!processTypedMessageV4) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const address = await validateAndNormalizeKeyholder(req.params[0], req);
        const message = req.params[1];
        const version = 'V4';
        const msgParams = {
            data: message,
            from: address,
            version,
        };
        res.result = await processTypedMessageV4(msgParams, req, version);
    }
    async function personalSign(req, res) {
        if (!processPersonalMessage) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        // process normally
        const firstParam = req.params[0];
        const secondParam = req.params[1];
        // non-standard "extraParams" to be appended to our "msgParams" obj
        const extraParams = req.params[2] || {};
        // We initially incorrectly ordered these parameters.
        // To gracefully respect users who adopted this API early,
        // we are currently gracefully recovering from the wrong param order
        // when it is clearly identifiable.
        //
        // That means when the first param is definitely an address,
        // and the second param is definitely not, but is hex.
        let address, message;
        if (resemblesAddress(firstParam) && !resemblesAddress(secondParam)) {
            let warning = `The eth_personalSign method requires params ordered `;
            warning += `[message, address]. This was previously handled incorrectly, `;
            warning += `and has been corrected automatically. `;
            warning += `Please switch this param order for smooth behavior in the future.`;
            res.warning = warning;
            address = firstParam;
            message = secondParam;
        }
        else {
            message = firstParam;
            address = secondParam;
        }
        address = await validateAndNormalizeKeyholder(address, req);
        const msgParams = Object.assign(Object.assign({}, extraParams), { from: address, data: message });
        // eslint-disable-next-line require-atomic-updates
        res.result = await processPersonalMessage(msgParams, req);
    }
    async function personalRecover(req, res) {
        const message = req.params[0];
        const signature = req.params[1];
        const extraParams = req.params[2] || {};
        const msgParams = Object.assign(Object.assign({}, extraParams), { sig: signature, data: message });
        const signerAddress = sigUtil.recoverPersonalSignature(msgParams);
        res.result = signerAddress;
    }
    async function encryptionPublicKey(req, res) {
        if (!processEncryptionPublicKey) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const address = await validateAndNormalizeKeyholder(req.params[0], req);
        res.result = await processEncryptionPublicKey(address, req);
    }
    async function decryptMessage(req, res) {
        if (!processDecryptMessage) {
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotSupported();
        }
        const ciphertext = req.params[0];
        const address = await validateAndNormalizeKeyholder(req.params[1], req);
        const extraParams = req.params[2] || {};
        const msgParams = Object.assign(Object.assign({}, extraParams), { from: address, data: ciphertext });
        res.result = await processDecryptMessage(msgParams, req);
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
    async function validateAndNormalizeKeyholder(address, req) {
        if (typeof address === 'string' &&
            address.length > 0 &&
            resemblesAddress(address)) {
            // ensure address is included in provided accounts. `suppressUnauthorized: false` is passed to `getAccounts`
            // so that an "unauthorized" error is thrown if the requester does not have the `eth_accounts`
            // permission.
            const accounts = await getAccounts(req, {
                suppressUnauthorized: false,
            });
            const normalizedAccounts = accounts.map((_address) => _address.toLowerCase());
            const normalizedAddress = address.toLowerCase();
            if (normalizedAccounts.includes(normalizedAddress)) {
                return normalizedAddress;
            }
            throw eth_rpc_errors_1.ethErrors.provider.unauthorized();
        }
        throw eth_rpc_errors_1.ethErrors.rpc.invalidParams({
            message: `Invalid parameters: must provide an Ethereum address.`,
        });
    }
}
exports.createWalletMiddleware = createWalletMiddleware;
function resemblesAddress(str) {
    // hex prefix 2 + 20 bytes
    return str.length === 2 + 20 * 2;
}
//# sourceMappingURL=wallet.js.map