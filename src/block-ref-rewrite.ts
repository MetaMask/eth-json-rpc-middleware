import { createAsyncMiddleware, JsonRpcMiddleware } from 'json-rpc-engine';
import { blockTagParamIndex } from './cache-utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-require-imports
const BlockTracker = require('eth-block-tracker');

interface BlockRefRewriteMiddlewareOptions{
  blockTracker?: typeof BlockTracker;
}

export = createBlockRefRewriteMiddleware;

function createBlockRefRewriteMiddleware(
  opts: BlockRefRewriteMiddlewareOptions = {},
): JsonRpcMiddleware<string[], Record<string, unknown>> {

  const { blockTracker } = opts;
  if (!blockTracker) {
    throw Error('BlockRefRewriteMiddleware - mandatory "blockTracker" option is missing.');
  }

  return createAsyncMiddleware(async (req, _res, next) => {
    const blockRefIndex: number|undefined = blockTagParamIndex(req);
    // skip if method does not include blockRef
    if (blockRefIndex === undefined) {
      return next();
    }
    // skip if not "latest"
    let blockRef: string = (req.params as string[])[blockRefIndex];
    // omitted blockRef implies "latest"
    if (blockRef === undefined) {
      blockRef = 'latest';
    }
    if (blockRef !== 'latest') {
      return next();
    }
    // rewrite blockRef to block-tracker's block number
    const latestBlockNumber: string = await blockTracker.getLatestBlock();
    // eslint-disable-next-line require-atomic-updates
    (req.params as string[])[blockRefIndex] = latestBlockNumber;
    return next();
  });

}
