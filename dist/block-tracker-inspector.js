"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlockTrackerInspectorMiddleware = void 0;
const json_rpc_engine_1 = require("json-rpc-engine");
const futureBlockRefRequests = [
    'eth_getTransactionByHash',
    'eth_getTransactionReceipt',
];
// inspect if response contains a block ref higher than our latest block
function createBlockTrackerInspectorMiddleware({ blockTracker, }) {
    return (0, json_rpc_engine_1.createAsyncMiddleware)(async (req, res, next) => {
        var _a;
        if (!futureBlockRefRequests.includes(req.method)) {
            return next();
        }
        // eslint-disable-next-line node/callback-return
        await next();
        // abort if no result or no block number
        if (!((_a = res.result) === null || _a === void 0 ? void 0 : _a.blockNumber)) {
            return undefined;
        }
        if (typeof res.result.blockNumber === 'string') {
            // if number is higher, suggest block-tracker check for a new block
            const blockNumber = Number.parseInt(res.result.blockNumber, 16);
            // Typecast: If getCurrentBlock returns null, currentBlockNumber will be NaN, which is fine.
            const currentBlockNumber = Number.parseInt(blockTracker.getCurrentBlock(), 16);
            if (blockNumber > currentBlockNumber) {
                await blockTracker.checkForLatestBlock();
            }
        }
        return undefined;
    });
}
exports.createBlockTrackerInspectorMiddleware = createBlockTrackerInspectorMiddleware;
//# sourceMappingURL=block-tracker-inspector.js.map