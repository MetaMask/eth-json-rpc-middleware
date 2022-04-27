import { JsonRpcMiddleware } from 'json-rpc-engine';
import type { Block } from './types';
export declare function createInflightCacheMiddleware(): JsonRpcMiddleware<string[], Block>;
