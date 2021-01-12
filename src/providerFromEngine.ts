import {
  JsonRpcEngine,
  JsonRpcRequest,
} from 'json-rpc-engine';
import SafeEventEmitter from '@metamask/safe-event-emitter';

export = providerFromEngine;

function providerFromEngine(engine: JsonRpcEngine): SafeEventEmitter {
  const provider: SafeEventEmitter = new SafeEventEmitter();
  // handle both rpc send methods
  (provider as any).sendAsync = engine.handle.bind(engine);
  (provider as any).send = (req: JsonRpcRequest<string[]>, callback: () => void) => {
    if (!callback) {
      throw new Error('Web3 Provider - must provider callback to "send" method');
    }
    engine.handle(req, callback);
  };
  // forward notifications
  if (engine.on) {
    engine.on('notification', (message: string) => {
      provider.emit('data', null, message);
    });
  }
  return provider;

}
