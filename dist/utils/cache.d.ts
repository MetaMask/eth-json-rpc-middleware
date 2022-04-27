import type { Payload } from '../types';
export declare function cacheIdentifierForPayload(payload: Payload, skipBlockRef?: boolean): string | null;
export declare function canCache(payload: Payload): boolean;
export declare function blockTagForPayload(payload: Payload): string | undefined;
export declare function paramsWithoutBlockTag(payload: Payload): string[];
export declare function blockTagParamIndex(payload: Payload): number | undefined;
export declare function cacheTypeForPayload(payload: Payload): string;
