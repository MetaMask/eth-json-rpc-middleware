import {
  JsonRpcMiddleware,
  PendingJsonRpcResponse,
} from 'json-rpc-engine';
import SafeEventEmitter from '@metamask/safe-event-emitter';

export = providerAsMiddleware;

function providerAsMiddleware(provider: SafeEventEmitter): JsonRpcMiddleware<string[], Record<string, unknown>> {
  return (req, res, _next, end) => {
    // send request to provider
    (provider as any).sendAsync(req, (err: Error, providerRes: PendingJsonRpcResponse<Record<string, unknown>>) => {
      // forward any error
      if (err) {
        return end(err);
      }
      // copy provider response onto original response
      Object.assign(res, providerRes);
      return end();
    });
  };
}
