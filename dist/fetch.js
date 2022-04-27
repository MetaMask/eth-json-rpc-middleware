"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFetchConfigFromReq = exports.createFetchMiddleware = void 0;
const json_rpc_engine_1 = require("json-rpc-engine");
const eth_rpc_errors_1 = require("eth-rpc-errors");
/* eslint-disable node/global-require,@typescript-eslint/no-require-imports */
const fetch = global.fetch || require('node-fetch');
const btoa = global.btoa || require('btoa');
/* eslint-enable node/global-require,@typescript-eslint/no-require-imports */
const RETRIABLE_ERRORS = [
    // ignore server overload errors
    'Gateway timeout',
    'ETIMEDOUT',
    // ignore server sent html error pages
    // or truncated json responses
    'failed to parse response body',
    // ignore errors where http req failed to establish
    'Failed to fetch',
];
function createFetchMiddleware({ rpcUrl, originHttpHeaderKey, }) {
    return (0, json_rpc_engine_1.createAsyncMiddleware)(async (req, res, _next) => {
        const { fetchUrl, fetchParams } = createFetchConfigFromReq({
            req,
            rpcUrl,
            originHttpHeaderKey,
        });
        // attempt request multiple times
        const maxAttempts = 5;
        const retryInterval = 1000;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const fetchRes = await fetch(fetchUrl, fetchParams);
                // check for http errrors
                checkForHttpErrors(fetchRes);
                // parse response body
                const rawBody = await fetchRes.text();
                let fetchBody;
                try {
                    fetchBody = JSON.parse(rawBody);
                }
                catch (_) {
                    throw new Error(`FetchMiddleware - failed to parse response body: "${rawBody}"`);
                }
                const result = parseResponse(fetchRes, fetchBody);
                // set result and exit retry loop
                res.result = result;
                return;
            }
            catch (err) {
                const errMsg = err.toString();
                const isRetriable = RETRIABLE_ERRORS.some((phrase) => errMsg.includes(phrase));
                // re-throw error if not retriable
                if (!isRetriable) {
                    throw err;
                }
            }
            // delay before retrying
            await timeout(retryInterval);
        }
    });
}
exports.createFetchMiddleware = createFetchMiddleware;
function checkForHttpErrors(fetchRes) {
    // check for errors
    switch (fetchRes.status) {
        case 405:
            throw eth_rpc_errors_1.ethErrors.rpc.methodNotFound();
        case 418:
            throw createRatelimitError();
        case 503:
        case 504:
            throw createTimeoutError();
        default:
            break;
    }
}
function parseResponse(fetchRes, body) {
    // check for error code
    if (fetchRes.status !== 200) {
        throw eth_rpc_errors_1.ethErrors.rpc.internal({
            message: `Non-200 status code: '${fetchRes.status}'`,
            data: body,
        });
    }
    // check for rpc error
    if (body.error) {
        throw eth_rpc_errors_1.ethErrors.rpc.internal({
            data: body.error,
        });
    }
    // return successful result
    return body.result;
}
function createFetchConfigFromReq({ req, rpcUrl, originHttpHeaderKey, }) {
    const parsedUrl = new URL(rpcUrl);
    const fetchUrl = normalizeUrlFromParsed(parsedUrl);
    // prepare payload
    // copy only canonical json rpc properties
    const payload = {
        id: req.id,
        jsonrpc: req.jsonrpc,
        method: req.method,
        params: req.params,
    };
    // extract 'origin' parameter from request
    const originDomain = req.origin;
    // serialize request body
    const serializedPayload = JSON.stringify(payload);
    // configure fetch params
    const fetchParams = {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: serializedPayload,
    };
    // encoded auth details as header (not allowed in fetch url)
    if (parsedUrl.username && parsedUrl.password) {
        const authString = `${parsedUrl.username}:${parsedUrl.password}`;
        const encodedAuth = btoa(authString);
        fetchParams.headers.Authorization = `Basic ${encodedAuth}`;
    }
    // optional: add request origin as header
    if (originHttpHeaderKey && originDomain) {
        fetchParams.headers[originHttpHeaderKey] = originDomain;
    }
    return { fetchUrl, fetchParams };
}
exports.createFetchConfigFromReq = createFetchConfigFromReq;
function normalizeUrlFromParsed(parsedUrl) {
    let result = '';
    result += parsedUrl.protocol;
    result += `//${parsedUrl.hostname}`;
    if (parsedUrl.port) {
        result += `:${parsedUrl.port}`;
    }
    result += `${parsedUrl.pathname}`;
    result += `${parsedUrl.search}`;
    return result;
}
function createRatelimitError() {
    return eth_rpc_errors_1.ethErrors.rpc.internal({ message: `Request is being rate limited.` });
}
function createTimeoutError() {
    let msg = `Gateway timeout. The request took too long to process. `;
    msg += `This can happen when querying logs over too wide a block range.`;
    return eth_rpc_errors_1.ethErrors.rpc.internal({ message: msg });
}
function timeout(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}
//# sourceMappingURL=fetch.js.map