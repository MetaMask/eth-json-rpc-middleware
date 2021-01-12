import {
  createAsyncMiddleware,
  JsonRpcMiddleware,
  JsonRpcRequest,
} from 'json-rpc-engine';
import * as cacheUtils from './cache-utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-require-imports
const BlockTracker = require('eth-block-tracker');

// `<nil>` comes from https://github.com/ethereum/go-ethereum/issues/16925
const emptyValues: (string|null|undefined)[] = [undefined, null, '\u003cnil\u003e'];

interface BlockCacheMiddlewareOptions{
  blockTracker?: typeof BlockTracker;
}

export = createBlockCacheMiddleware;

//
// Cache Strategies
//

class BlockCacheStrategy {

  private cache: Record<string, Record<string, unknown>>;

  constructor() {
    this.cache = {};
  }

  getBlockCacheForPayload(_payload: JsonRpcRequest<string[]>, blockNumberHex: string): Record<string, unknown> {
    const blockNumber: number = Number.parseInt(blockNumberHex, 16);
    let blockCache: Record<string, unknown> = this.cache[blockNumber];
    // create new cache if necesary
    if (!blockCache) {
      const newCache: Record<string, unknown> = {};
      this.cache[blockNumber] = newCache;
      blockCache = newCache;
    }
    return blockCache;
  }

  async get(payload: JsonRpcRequest<string[]>, requestedBlockNumber: string): Promise<unknown> {
    // lookup block cache
    const blockCache: Record<string, unknown> = this.getBlockCacheForPayload(payload, requestedBlockNumber);
    if (!blockCache) {
      return undefined;
    }
    // lookup payload in block cache
    const identifier: string|null = cacheUtils.cacheIdentifierForPayload(payload, true);
    const cached: unknown = identifier ? blockCache[(identifier as string)] : undefined;
    // may be undefined
    return cached;
  }

  async set(payload: JsonRpcRequest<string[]>, requestedBlockNumber: string, result: Record<string, unknown>): Promise<void> {
    // check if we can cached this result
    const canCache: boolean = this.canCacheResult(payload, result);
    if (!canCache) {
      return;
    }
    // set the value in the cache
    const blockCache: Record<string, unknown> = this.getBlockCacheForPayload(payload, requestedBlockNumber);
    const identifier: string|null = cacheUtils.cacheIdentifierForPayload(payload, true);
    blockCache[(identifier as string)] = result;
  }

  canCacheRequest(payload: JsonRpcRequest<string[]>,): boolean {
    // check request method
    if (!cacheUtils.canCache(payload)) {
      return false;
    }
    // check blockTag
    const blockTag: string = cacheUtils.blockTagForPayload(payload) as string;
    if (blockTag === 'pending') {
      return false;
    }
    // can be cached
    return true;
  }

  canCacheResult(payload: JsonRpcRequest<string[]>, result: Record<string, unknown>): boolean {
    // never cache empty values (e.g. undefined)
    if (emptyValues.includes((result as unknown) as string)) {
      return false;
    }
    // check if transactions have block reference before caching
    if (['eth_getTransactionByHash', 'eth_getTransactionReceipt'].includes(payload.method)) {
      if (!result || !result.blockHash || result.blockHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        return false;
      }
    }
    // otherwise true
    return true;
  }

  // removes all block caches with block number lower than `oldBlockHex`
  clearBefore(oldBlockHex: string): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const oldBlockNumber: number = Number.parseInt(oldBlockHex, 16);
    // clear old caches
    Object.keys(self.cache)
      .map(Number)
      .filter((num) => num < oldBlockNumber)
      .forEach((num) => delete self.cache[num]);
  }
}

function createBlockCacheMiddleware(
  opts: BlockCacheMiddlewareOptions = {},
): JsonRpcMiddleware<string[], Record<string, unknown>> {
  // validate options
  const { blockTracker } = opts;

  if (!blockTracker) {
    throw new Error('createBlockCacheMiddleware - No BlockTracker specified');
  }

  // create caching strategies
  const blockCache: BlockCacheStrategy = new BlockCacheStrategy();
  const strategies: Record<string, BlockCacheStrategy> = {
    perma: blockCache,
    block: blockCache,
    fork: blockCache,
  };

  return createAsyncMiddleware(async (req, res, next) => {
    // allow cach to be skipped if so specified
    if (((req as unknown) as Record<string, unknown>).skipCache) {
      return next();
    }
    // check type and matching strategy
    const type: string = cacheUtils.cacheTypeForPayload(req);
    const strategy: BlockCacheStrategy = strategies[type];
    // If there's no strategy in place, pass it down the chain.
    if (!strategy) {
      return next();
    }
    // If the strategy can't cache this request, ignore it.
    if (!strategy.canCacheRequest(req)) {
      return next();
    }

    // get block reference (number or keyword)
    let blockTag: string|null = cacheUtils.blockTagForPayload(req);
    if (!blockTag) {
      blockTag = 'latest';
    }

    // get exact block number
    let requestedBlockNumber: string;
    if (blockTag === 'earliest') {
      // this just exists for symmetry with "latest"
      requestedBlockNumber = '0x00';
    } else if (blockTag === 'latest') {
      // fetch latest block number
      const latestBlockNumber: string = await blockTracker.getLatestBlock();
      // clear all cache before latest block
      blockCache.clearBefore(latestBlockNumber);
      requestedBlockNumber = latestBlockNumber;
    } else {
      // We have a hex number
      requestedBlockNumber = blockTag;
    }

    // end on a hit, continue on a miss
    const cacheResult: Record<string, unknown> = await strategy.get(req, requestedBlockNumber) as Record<string, unknown>;
    if (cacheResult === undefined) {
      // cache miss
      // wait for other middleware to handle request
      // eslint-disable-next-line node/callback-return
      await next();
      // add result to cache
      await strategy.set(req, requestedBlockNumber, (res.result as Record<string, unknown>));
    } else {
      // fill in result from cache
      res.result = (cacheResult as Record<string, unknown>);
    }
    return undefined;
  });
}
