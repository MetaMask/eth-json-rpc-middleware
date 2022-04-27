"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheTypeForPayload = exports.blockTagParamIndex = exports.paramsWithoutBlockTag = exports.blockTagForPayload = exports.canCache = exports.cacheIdentifierForPayload = void 0;
const json_stable_stringify_1 = __importDefault(require("json-stable-stringify"));
function cacheIdentifierForPayload(payload, skipBlockRef) {
    var _a;
    const simpleParams = skipBlockRef
        ? paramsWithoutBlockTag(payload)
        : (_a = payload.params) !== null && _a !== void 0 ? _a : [];
    if (canCache(payload)) {
        return `${payload.method}:${(0, json_stable_stringify_1.default)(simpleParams)}`;
    }
    return null;
}
exports.cacheIdentifierForPayload = cacheIdentifierForPayload;
function canCache(payload) {
    return cacheTypeForPayload(payload) !== 'never';
}
exports.canCache = canCache;
function blockTagForPayload(payload) {
    if (!payload.params) {
        return undefined;
    }
    const index = blockTagParamIndex(payload);
    // Block tag param not passed.
    if (index === undefined || index >= payload.params.length) {
        return undefined;
    }
    return payload.params[index];
}
exports.blockTagForPayload = blockTagForPayload;
function paramsWithoutBlockTag(payload) {
    if (!payload.params) {
        return [];
    }
    const index = blockTagParamIndex(payload);
    // Block tag param not passed.
    if (index === undefined || index >= payload.params.length) {
        return payload.params;
    }
    // eth_getBlockByNumber has the block tag first, then the optional includeTx? param
    if (payload.method === 'eth_getBlockByNumber') {
        return payload.params.slice(1);
    }
    return payload.params.slice(0, index);
}
exports.paramsWithoutBlockTag = paramsWithoutBlockTag;
function blockTagParamIndex(payload) {
    switch (payload.method) {
        // blockTag is at index 2
        case 'eth_getStorageAt':
            return 2;
        // blockTag is at index 1
        case 'eth_getBalance':
        case 'eth_getCode':
        case 'eth_getTransactionCount':
        case 'eth_call':
            return 1;
        // blockTag is at index 0
        case 'eth_getBlockByNumber':
            return 0;
        // there is no blockTag
        default:
            return undefined;
    }
}
exports.blockTagParamIndex = blockTagParamIndex;
function cacheTypeForPayload(payload) {
    switch (payload.method) {
        // cache permanently
        case 'web3_clientVersion':
        case 'web3_sha3':
        case 'eth_protocolVersion':
        case 'eth_getBlockTransactionCountByHash':
        case 'eth_getUncleCountByBlockHash':
        case 'eth_getCode':
        case 'eth_getBlockByHash':
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionByBlockHashAndIndex':
        case 'eth_getTransactionReceipt':
        case 'eth_getUncleByBlockHashAndIndex':
        case 'eth_getCompilers':
        case 'eth_compileLLL':
        case 'eth_compileSolidity':
        case 'eth_compileSerpent':
        case 'shh_version':
        case 'test_permaCache':
            return 'perma';
        // cache until fork
        case 'eth_getBlockByNumber':
        case 'eth_getBlockTransactionCountByNumber':
        case 'eth_getUncleCountByBlockNumber':
        case 'eth_getTransactionByBlockNumberAndIndex':
        case 'eth_getUncleByBlockNumberAndIndex':
        case 'test_forkCache':
            return 'fork';
        // cache for block
        case 'eth_gasPrice':
        case 'eth_blockNumber':
        case 'eth_getBalance':
        case 'eth_getStorageAt':
        case 'eth_getTransactionCount':
        case 'eth_call':
        case 'eth_estimateGas':
        case 'eth_getFilterLogs':
        case 'eth_getLogs':
        case 'test_blockCache':
            return 'block';
        // never cache
        default:
            return 'never';
    }
}
exports.cacheTypeForPayload = cacheTypeForPayload;
//# sourceMappingURL=cache.js.map