import { PollingBlockTracker } from 'eth-block-tracker';
import {
  createAsyncMiddleware,
  JsonRpcMiddleware,
  PendingJsonRpcResponse,
} from 'json-rpc-engine';
import { projectLogger, createModuleLogger } from './logging-utils';

const log = createModuleLogger(projectLogger, 'block-tracker-inspector');
const futureBlockRefRequests: string[] = [
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
];

interface BlockTrackerInspectorMiddlewareOptions {
  blockTracker: PollingBlockTracker;
}

function hasProperty<Property extends string>(
  object: unknown,
  property: Property,
): object is Record<Property, unknown> {
  return Object.hasOwnProperty.call(object, property);
}

function getResultBlockNumber(
  response: PendingJsonRpcResponse<unknown>,
): string | undefined {
  const { result } = response;
  if (
    !result ||
    typeof result !== 'object' ||
    !hasProperty(result, 'blockNumber')
  ) {
    return undefined;
  }

  if (result.blockNumber && typeof result.blockNumber === 'string') {
    return result.blockNumber;
  }
  return undefined;
}

// inspect if response contains a block ref higher than our latest block
export function createBlockTrackerInspectorMiddleware({
  blockTracker,
}: BlockTrackerInspectorMiddlewareOptions): JsonRpcMiddleware<
  unknown,
  unknown
> {
  return createAsyncMiddleware(async (req, res, next) => {
    if (!futureBlockRefRequests.includes(req.method)) {
      return next();
    }
    // eslint-disable-next-line node/callback-return
    await next();
    // abort if no result or no block number
    const responseBlockNumber = getResultBlockNumber(res);
    if (!responseBlockNumber) {
      return undefined;
    }

    log('res.result.blockNumber exists, proceeding. res = %o', res);

    // if number is higher, suggest block-tracker check for a new block
    const blockNumber: number = Number.parseInt(responseBlockNumber, 16);
    // Typecast: If getCurrentBlock returns null, currentBlockNumber will be NaN, which is fine.
    const currentBlockNumber: number = Number.parseInt(
      blockTracker.getCurrentBlock() as any,
      16,
    );
    if (blockNumber > currentBlockNumber) {
      log(
        'blockNumber from response is greater than current block number, refreshing current block number',
      );
      await blockTracker.checkForLatestBlock();
    }
    return undefined;
  });
}
