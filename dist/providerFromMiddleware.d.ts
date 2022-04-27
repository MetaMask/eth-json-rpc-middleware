import { JsonRpcMiddleware } from 'json-rpc-engine';
import type { SafeEventEmitterProvider, Block } from './types';
export declare function providerFromMiddleware(middleware: JsonRpcMiddleware<string[], Block>): SafeEventEmitterProvider;
