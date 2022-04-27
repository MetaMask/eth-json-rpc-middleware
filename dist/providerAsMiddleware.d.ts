import { JsonRpcMiddleware } from 'json-rpc-engine';
import type { Block, SafeEventEmitterProvider } from './types';
export declare function providerAsMiddleware(provider: SafeEventEmitterProvider): JsonRpcMiddleware<string[], Block>;
export declare function ethersProviderAsMiddleware(provider: SafeEventEmitterProvider): JsonRpcMiddleware<string[], Block>;
