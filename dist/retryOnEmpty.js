"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRetryOnEmptyMiddleware = void 0;
const clone_1 = __importDefault(require("clone"));
const json_rpc_engine_1 = require("json-rpc-engine");
const pify_1 = __importDefault(require("pify"));
const cache_1 = require("./utils/cache");
//
// RetryOnEmptyMiddleware will retry any request with an empty response that has
// a numbered block reference at or lower than the blockTracker's latest block.
// Its useful for dealing with load-balanced ethereum JSON RPC
// nodes that are not always in sync with each other.
//
// empty values used to determine if a request should be retried
// `<nil>` comes from https://github.com/ethereum/go-ethereum/issues/16925
const emptyValues = [
    undefined,
    null,
    '\u003cnil\u003e',
];
function createRetryOnEmptyMiddleware({ provider, blockTracker, } = {}) {
    if (!provider) {
        throw Error('RetryOnEmptyMiddleware - mandatory "provider" option is missing.');
    }
    if (!blockTracker) {
        throw Error('RetryOnEmptyMiddleware - mandatory "blockTracker" option is missing.');
    }
    return (0, json_rpc_engine_1.createAsyncMiddleware)(async (req, res, next) => {
        var _a;
        const blockRefIndex = (0, cache_1.blockTagParamIndex)(req);
        // skip if method does not include blockRef
        if (blockRefIndex === undefined) {
            return next();
        }
        // skip if not exact block references
        let blockRef = (_a = req.params) === null || _a === void 0 ? void 0 : _a[blockRefIndex];
        // omitted blockRef implies "latest"
        if (blockRef === undefined) {
            blockRef = 'latest';
        }
        // skip if non-number block reference
        if (['latest', 'pending'].includes(blockRef)) {
            return next();
        }
        // skip if block refernce is not a valid number
        const blockRefNumber = Number.parseInt(blockRef.slice(2), 16);
        if (Number.isNaN(blockRefNumber)) {
            return next();
        }
        // lookup latest block
        const latestBlockNumberHex = await blockTracker.getLatestBlock();
        const latestBlockNumber = Number.parseInt(latestBlockNumberHex.slice(2), 16);
        // skip if request block number is higher than current
        if (blockRefNumber > latestBlockNumber) {
            return next();
        }
        // create child request with specific block-ref
        const childRequest = (0, clone_1.default)(req);
        // attempt child request until non-empty response is received
        const childResponse = await retry(10, async () => {
            const attemptResponse = await (0, pify_1.default)(provider.sendAsync).call(provider, childRequest);
            // verify result
            if (emptyValues.includes(attemptResponse)) {
                throw new Error(`RetryOnEmptyMiddleware - empty response "${JSON.stringify(attemptResponse)}" for request "${JSON.stringify(childRequest)}"`);
            }
            return attemptResponse;
        });
        // copy child response onto original response
        res.result = childResponse.result;
        res.error = childResponse.error;
        return next();
    });
}
exports.createRetryOnEmptyMiddleware = createRetryOnEmptyMiddleware;
async function retry(maxRetries, asyncFn) {
    for (let index = 0; index < maxRetries; index++) {
        try {
            return await asyncFn();
        }
        catch (err) {
            await timeout(1000);
        }
    }
    throw new Error('RetryOnEmptyMiddleware - retries exhausted');
}
function timeout(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}
//# sourceMappingURL=retryOnEmpty.js.map