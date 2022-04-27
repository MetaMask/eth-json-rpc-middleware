"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlockCacheMiddleware = void 0;
const json_rpc_engine_1 = require("json-rpc-engine");
const cache_1 = require("./utils/cache");
// `<nil>` comes from https://github.com/ethereum/go-ethereum/issues/16925
const emptyValues = [undefined, null, '\u003cnil\u003e'];
//
// Cache Strategies
//
class BlockCacheStrategy {
    constructor() {
        this.cache = {};
    }
    getBlockCacheForPayload(_payload, blockNumberHex) {
        const blockNumber = Number.parseInt(blockNumberHex, 16);
        let blockCache = this.cache[blockNumber];
        // create new cache if necesary
        if (!blockCache) {
            const newCache = {};
            this.cache[blockNumber] = newCache;
            blockCache = newCache;
        }
        return blockCache;
    }
    async get(payload, requestedBlockNumber) {
        // lookup block cache
        const blockCache = this.getBlockCacheForPayload(payload, requestedBlockNumber);
        // lookup payload in block cache
        const identifier = (0, cache_1.cacheIdentifierForPayload)(payload, true);
        return identifier ? blockCache[identifier] : undefined;
    }
    async set(payload, requestedBlockNumber, result) {
        // check if we can cached this result
        const canCacheResult = this.canCacheResult(payload, result);
        if (!canCacheResult) {
            return;
        }
        // set the value in the cache
        const identifier = (0, cache_1.cacheIdentifierForPayload)(payload, true);
        if (!identifier) {
            return;
        }
        const blockCache = this.getBlockCacheForPayload(payload, requestedBlockNumber);
        blockCache[identifier] = result;
    }
    canCacheRequest(payload) {
        // check request method
        if (!(0, cache_1.canCache)(payload)) {
            return false;
        }
        // check blockTag
        const blockTag = (0, cache_1.blockTagForPayload)(payload);
        if (blockTag === 'pending') {
            return false;
        }
        // can be cached
        return true;
    }
    canCacheResult(payload, result) {
        // never cache empty values (e.g. undefined)
        if (emptyValues.includes(result)) {
            return false;
        }
        // check if transactions have block reference before caching
        if (payload.method &&
            ['eth_getTransactionByHash', 'eth_getTransactionReceipt'].includes(payload.method)) {
            if (!result ||
                !result.blockHash ||
                result.blockHash ===
                    '0x0000000000000000000000000000000000000000000000000000000000000000') {
                return false;
            }
        }
        // otherwise true
        return true;
    }
    // removes all block caches with block number lower than `oldBlockHex`
    clearBefore(oldBlockHex) {
        const oldBlockNumber = Number.parseInt(oldBlockHex, 16);
        // clear old caches
        Object.keys(this.cache)
            .map(Number)
            .filter((num) => num < oldBlockNumber)
            .forEach((num) => delete this.cache[num]);
    }
}
function createBlockCacheMiddleware({ blockTracker, } = {}) {
    // validate options
    if (!blockTracker) {
        throw new Error('createBlockCacheMiddleware - No PollingBlockTracker specified');
    }
    // create caching strategies
    const blockCache = new BlockCacheStrategy();
    const strategies = {
        perma: blockCache,
        block: blockCache,
        fork: blockCache,
    };
    return (0, json_rpc_engine_1.createAsyncMiddleware)(async (req, res, next) => {
        // allow cach to be skipped if so specified
        if (req.skipCache) {
            return next();
        }
        // check type and matching strategy
        const type = (0, cache_1.cacheTypeForPayload)(req);
        const strategy = strategies[type];
        // If there's no strategy in place, pass it down the chain.
        if (!strategy) {
            return next();
        }
        // If the strategy can't cache this request, ignore it.
        if (!strategy.canCacheRequest(req)) {
            return next();
        }
        // get block reference (number or keyword)
        let blockTag = (0, cache_1.blockTagForPayload)(req);
        if (!blockTag) {
            blockTag = 'latest';
        }
        // get exact block number
        let requestedBlockNumber;
        if (blockTag === 'earliest') {
            // this just exists for symmetry with "latest"
            requestedBlockNumber = '0x00';
        }
        else if (blockTag === 'latest') {
            // fetch latest block number
            const latestBlockNumber = await blockTracker.getLatestBlock();
            // clear all cache before latest block
            blockCache.clearBefore(latestBlockNumber);
            requestedBlockNumber = latestBlockNumber;
        }
        else {
            // We have a hex number
            requestedBlockNumber = blockTag;
        }
        // end on a hit, continue on a miss
        const cacheResult = await strategy.get(req, requestedBlockNumber);
        if (cacheResult === undefined) {
            // cache miss
            // wait for other middleware to handle request
            // eslint-disable-next-line node/callback-return
            await next();
            // add result to cache
            // it's safe to cast res.result as Block, due to runtime type checks
            // performed when strategy.set is called
            await strategy.set(req, requestedBlockNumber, res.result);
        }
        else {
            // fill in result from cache
            res.result = cacheResult;
        }
        return undefined;
    });
}
exports.createBlockCacheMiddleware = createBlockCacheMiddleware;
//# sourceMappingURL=block-cache.js.map