import { PollingBlockTracker } from 'eth-block-tracker';
import { createAsyncMiddleware, JsonRpcMiddleware } from 'json-rpc-engine';
import { projectLogger, createModuleLogger } from './logging-utils';
import { blockTagParamIndex } from './utils/cache';
import type { Block, SafeEventEmitterProvider } from './types';

interface BlockRefMiddlewareOptions {
  blockTracker?: PollingBlockTracker;
  provider?: SafeEventEmitterProvider;
}

const log = createModuleLogger(projectLogger, 'block-ref');

export function createBlockRefMiddleware({
  provider,
  blockTracker,
}: BlockRefMiddlewareOptions = {}): JsonRpcMiddleware<string[], Block> {
  if (!provider) {
    throw Error('BlockRefMiddleware - mandatory "provider" option is missing.');
  }

  if (!blockTracker) {
    throw Error(
      'BlockRefMiddleware - mandatory "blockTracker" option is missing.',
    );
  }

  return createAsyncMiddleware(async (req, _res, next) => {
    const blockRefIndex = blockTagParamIndex(req);

    if (blockRefIndex === undefined) {
      return next();
    }

    const blockRef = req.params?.[blockRefIndex] ?? 'latest';

    if (blockRef !== 'latest') {
      log('blockRef is not "latest", carrying request forward');
      return next();
    }

    const latestBlock = await blockTracker.getLatestBlock();
    log(
      `blockRef is "latest", setting param ${blockRefIndex} to latest block ${latestBlock}`,
    );

    if (req.params === undefined) {
      req.params = [];
    }

    req.params[blockRefIndex] = latestBlock;

    return next();
  });
}
