"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerFromMiddleware = void 0;
const json_rpc_engine_1 = require("json-rpc-engine");
const providerFromEngine_1 = require("./providerFromEngine");
function providerFromMiddleware(middleware) {
    const engine = new json_rpc_engine_1.JsonRpcEngine();
    engine.push(middleware);
    const provider = (0, providerFromEngine_1.providerFromEngine)(engine);
    return provider;
}
exports.providerFromMiddleware = providerFromMiddleware;
//# sourceMappingURL=providerFromMiddleware.js.map