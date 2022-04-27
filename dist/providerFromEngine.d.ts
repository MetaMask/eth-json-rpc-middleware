import { JsonRpcEngine } from 'json-rpc-engine';
import type { SafeEventEmitterProvider } from './types';
export declare function providerFromEngine(engine: JsonRpcEngine): SafeEventEmitterProvider;
