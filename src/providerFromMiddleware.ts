import {
  JsonRpcEngine,
  JsonRpcMiddleware,
} from 'json-rpc-engine';
import SafeEventEmitter from '@metamask/safe-event-emitter';
import providerFromEngine from './providerFromEngine';

export = providerFromMiddleware;

function providerFromMiddleware(middleware: JsonRpcMiddleware<string[], Record<string, unknown>>): SafeEventEmitter {
  const engine: JsonRpcEngine = new JsonRpcEngine();
  engine.push(middleware);
  const provider: SafeEventEmitter = providerFromEngine(engine);
  return provider;
}
