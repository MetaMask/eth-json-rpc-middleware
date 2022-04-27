import { PollingBlockTracker } from 'eth-block-tracker';
import { JsonRpcMiddleware } from 'json-rpc-engine';
import type { Block } from './types';
interface BlockRefRewriteMiddlewareOptions {
    blockTracker?: PollingBlockTracker;
}
export declare function createBlockRefRewriteMiddleware({ blockTracker, }?: BlockRefRewriteMiddlewareOptions): JsonRpcMiddleware<string[], Block>;
export {};
