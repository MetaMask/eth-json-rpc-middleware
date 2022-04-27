import { JsonRpcMiddleware } from 'json-rpc-engine';
import type { Payload, Block } from './types';
export interface PayloadWithOrigin extends Payload {
    origin?: string;
}
interface Request {
    method: string;
    headers: Record<string, string>;
    body: string;
}
interface FetchConfig {
    fetchUrl: string;
    fetchParams: Request;
}
interface FetchMiddlewareOptions {
    rpcUrl: string;
    originHttpHeaderKey?: string;
}
interface FetchMiddlewareFromReqOptions extends FetchMiddlewareOptions {
    req: PayloadWithOrigin;
}
export declare function createFetchMiddleware({ rpcUrl, originHttpHeaderKey, }: FetchMiddlewareOptions): JsonRpcMiddleware<string[], Block>;
export declare function createFetchConfigFromReq({ req, rpcUrl, originHttpHeaderKey, }: FetchMiddlewareFromReqOptions): FetchConfig;
export {};
