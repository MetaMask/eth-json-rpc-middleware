import { JsonRpcRequest } from 'json-rpc-engine';
import stringify from 'json-stable-stringify';

export function cacheIdentifierForPayload(payload: JsonRpcRequest<string[]>, skipBlockRef?: boolean): string|null {
  const simpleParams: string[] = skipBlockRef ? paramsWithoutBlockTag(payload) : (payload.params as string[]);
  if (canCache(payload)) {
    return `${payload.method}:${stringify(simpleParams)}`;
  }
  return null;

}

export function canCache(payload: JsonRpcRequest<string[]>): boolean {
  return cacheTypeForPayload(payload) !== 'never';
}

export function blockTagForPayload(payload: JsonRpcRequest<string[]>): string|null {
  const index: number = (blockTagParamIndex(payload) as number);

  // Block tag param not passed.
  if (index >= (payload.params as string[]).length) {
    return null;
  }

  return (payload.params as string[])[index];
}

export function paramsWithoutBlockTag(payload: JsonRpcRequest<string[]>): string[] {
  const index = (blockTagParamIndex(payload) as number);

  // Block tag param not passed.
  if (index >= (payload.params as string[]).length) {
    return (payload.params as string[]);
  }

  // eth_getBlockByNumber has the block tag first, then the optional includeTx? param
  if (payload.method === 'eth_getBlockByNumber') {
    return (payload.params as string[]).slice(1);
  }

  return (payload.params as string[]).slice(0, index);
}

export function blockTagParamIndex(payload: JsonRpcRequest<string[]>): number|undefined {
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

export function cacheTypeForPayload(payload: JsonRpcRequest<string[]>): string {
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
