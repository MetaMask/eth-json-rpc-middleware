import clone from 'clone';
import { createAsyncMiddleware, JsonRpcMiddleware, PendingJsonRpcResponse } from 'json-rpc-engine';
import * as cacheUtils from './cache-utils';

type RequestHandlers = (handledRes: PendingJsonRpcResponse<Record<string, unknown>>) => void;
export = createInflightCache;

function createInflightCache(): JsonRpcMiddleware<string[], Record<string, unknown>> {
  const inflightRequests: Record<string, RequestHandlers[]> = {};

  return createAsyncMiddleware(async (req, res, next) => {
    // allow cach to be skipped if so specified
    if (((req as unknown) as Record<string, unknown>).skipCache) {
      return next();
    }
    // get cacheId, if cacheable
    const cacheId = cacheUtils.cacheIdentifierForPayload(req);
    // if not cacheable, skip
    if (!cacheId) {
      return next();
    }
    // check for matching requests
    let activeRequestHandlers: RequestHandlers[] = inflightRequests[cacheId];
    // if found, wait for the active request to be handled
    if (activeRequestHandlers) {
      // setup the response listener and wait for it to be called
      // it will handle copying the result and request fields
      await createActiveRequestHandler(res, activeRequestHandlers);
      return undefined;
    }
    // setup response handler array for subsequent requests
    activeRequestHandlers = [];
    inflightRequests[cacheId] = activeRequestHandlers;
    // allow request to be handled normally
    // eslint-disable-next-line node/callback-return
    await next();
    // clear inflight requests
    delete inflightRequests[cacheId];
    // schedule activeRequestHandlers to be handled
    handleActiveRequest(res, activeRequestHandlers);
    // complete
    return undefined;
  });

  function createActiveRequestHandler(
    res: PendingJsonRpcResponse<Record<string, unknown>>,
    activeRequestHandlers: RequestHandlers[]
  ): Promise<unknown> {
    const { resolve, promise } = deferredPromise();
    activeRequestHandlers.push((handledRes: PendingJsonRpcResponse<Record<string, unknown>>) => {
      // append a copy of the result and error to the response
      res.result = clone(handledRes.result);
      res.error = clone(handledRes.error);
      resolve();
    });
    return promise;
  }

  function handleActiveRequest(
    res: PendingJsonRpcResponse<Record<string, unknown>>,
    activeRequestHandlers: RequestHandlers[]
  ) {
    // use setTimeout so we can resolve our original request first
    setTimeout(() => {
      activeRequestHandlers.forEach((handler) => {
        try {
          handler(res);
        } catch (err) {
          // catch error so all requests are handled correctly
          console.error(err);
        }
      });
    });
  }
}

function deferredPromise() {
  let resolve: any;
  const promise: Promise<unknown> = new Promise((_resolve) => {
    resolve = _resolve;
  });
  return { resolve, promise };
}
