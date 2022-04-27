"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInflightCacheMiddleware = void 0;
const clone_1 = __importDefault(require("clone"));
const json_rpc_engine_1 = require("json-rpc-engine");
const cache_1 = require("./utils/cache");
function createInflightCacheMiddleware() {
    const inflightRequests = {};
    return (0, json_rpc_engine_1.createAsyncMiddleware)(async (req, res, next) => {
        // allow cach to be skipped if so specified
        if (req.skipCache) {
            return next();
        }
        // get cacheId, if cacheable
        const cacheId = (0, cache_1.cacheIdentifierForPayload)(req);
        // if not cacheable, skip
        if (!cacheId) {
            return next();
        }
        // check for matching requests
        let activeRequestHandlers = inflightRequests[cacheId];
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
    function createActiveRequestHandler(res, activeRequestHandlers) {
        const { resolve, promise } = deferredPromise();
        activeRequestHandlers.push((handledRes) => {
            // append a copy of the result and error to the response
            res.result = (0, clone_1.default)(handledRes.result);
            res.error = (0, clone_1.default)(handledRes.error);
            resolve();
        });
        return promise;
    }
    function handleActiveRequest(res, activeRequestHandlers) {
        // use setTimeout so we can resolve our original request first
        setTimeout(() => {
            activeRequestHandlers.forEach((handler) => {
                try {
                    handler(res);
                }
                catch (err) {
                    // catch error so all requests are handled correctly
                    console.error(err);
                }
            });
        });
    }
}
exports.createInflightCacheMiddleware = createInflightCacheMiddleware;
function deferredPromise() {
    let resolve;
    const promise = new Promise((_resolve) => {
        resolve = _resolve;
    });
    return { resolve, promise };
}
//# sourceMappingURL=inflight-cache.js.map