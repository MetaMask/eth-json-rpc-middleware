import { JsonRpcRequest, JsonRpcResponse } from 'json-rpc-engine';
import SafeEventEmitter from '@metamask/safe-event-emitter';
export declare type Payload = Partial<JsonRpcRequest<any[]>>;
export interface JsonRpcRequestToCache extends JsonRpcRequest<string[]> {
    skipCache: boolean;
}
export declare type BlockData = string | string[];
export declare type Block = Record<string, BlockData>;
export declare type BlockCache = Record<string, Block>;
export declare type Cache = Record<number, BlockCache>;
export declare type SendAsyncCallBack<T> = (err: unknown, providerRes: JsonRpcResponse<T>) => void;
export declare type SendCallBack = (err: any, providerRes: JsonRpcResponse<any>) => void;
export interface SafeEventEmitterProvider extends SafeEventEmitter {
    sendAsync: <T, U>(req: JsonRpcRequest<T>, cb: SendAsyncCallBack<U>) => void;
    send: (req: JsonRpcRequest<any>, callback: SendCallBack) => void;
}
