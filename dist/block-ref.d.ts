import { PollingBlockTracker } from 'eth-block-tracker';
import { JsonRpcMiddleware } from 'json-rpc-engine';
import type { Block, SafeEventEmitterProvider } from './types';
interface BlockRefMiddlewareOptions {
    blockTracker?: PollingBlockTracker;
    provider?: SafeEventEmitterProvider;
}
export declare function createBlockRefMiddleware({ provider, blockTracker, }?: BlockRefMiddlewareOptions): JsonRpcMiddleware<string[], Block>;
export {};
