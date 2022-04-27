"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ethersProviderAsMiddleware = exports.providerAsMiddleware = void 0;
function providerAsMiddleware(provider) {
    return (req, res, _next, end) => {
        // send request to provider
        provider.sendAsync(req, (err, providerRes) => {
            // forward any error
            if (err instanceof Error) {
                return end(err);
            }
            // copy provider response onto original response
            Object.assign(res, providerRes);
            return end();
        });
    };
}
exports.providerAsMiddleware = providerAsMiddleware;
function ethersProviderAsMiddleware(provider) {
    return (req, res, _next, end) => {
        // send request to provider
        provider.send(req, (err, providerRes) => {
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
exports.ethersProviderAsMiddleware = ethersProviderAsMiddleware;
//# sourceMappingURL=providerAsMiddleware.js.map