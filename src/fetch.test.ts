import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import type { Json, JsonRpcParams, JsonRpcRequest } from '@metamask/utils';

import { createFetchConfigFromReq } from '.';
import { createFetchMiddleware } from './fetch';
import type { AbstractRpcService } from './types';

/**
 * Generate a base64-encoded string from a binary string. This should be equivalent to
 * `window.btoa`.
 *
 * @param stringToEncode - The string to encode.
 * @returns The base64-encoded string.
 */
// eslint-disable-next-line @typescript-eslint/no-shadow
function btoa(stringToEncode: string) {
  return Buffer.from(stringToEncode).toString('base64');
}

describe('createFetchMiddleware', () => {
  it('calls the RPC service with the correct request headers and body when no `originHttpHeaderKey` option given', async () => {
    const rpcService = buildRpcService();
    const requestSpy = jest.spyOn(rpcService, 'request');
    const middleware = createFetchMiddleware({
      rpcService,
    });

    const engine = new JsonRpcEngine();
    engine.push(middleware);
    await engine.handle({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      },
      {
        headers: {},
      },
    );
  });

  it('includes the `origin` from the given request in the request headers under the given `originHttpHeaderKey`', async () => {
    const rpcService = buildRpcService();
    const requestSpy = jest.spyOn(rpcService, 'request');
    const middleware = createFetchMiddleware({
      rpcService,
      options: {
        originHttpHeaderKey: 'X-Dapp-Origin',
      },
    });

    const engine = new JsonRpcEngine();
    engine.push(middleware);
    // Type assertion: This isn't really a proper JSON-RPC request, but we have
    // to get `json-rpc-engine` to think it is.
    await engine.handle({
      id: 1,
      jsonrpc: '2.0' as const,
      method: 'eth_chainId',
      params: [],
      origin: 'somedapp.com',
    } as JsonRpcRequest);

    expect(requestSpy).toHaveBeenCalledWith(
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      },
      {
        headers: {
          'X-Dapp-Origin': 'somedapp.com',
        },
      },
    );
  });

  describe('if the response from the service does not contain an `error` field', () => {
    it('returns a successful JSON-RPC response containing the value of the `result` field', async () => {
      const rpcService = buildRpcService();
      jest.spyOn(rpcService, 'request').mockResolvedValue({
        id: 1,
        jsonrpc: '2.0',
        result: 'the result',
      });
      const middleware = createFetchMiddleware({
        rpcService,
      });

      const engine = new JsonRpcEngine();
      engine.push(middleware);
      const result = await engine.handle({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      });

      expect(result).toStrictEqual({
        id: 1,
        jsonrpc: '2.0',
        result: 'the result',
      });
    });
  });

  describe('if the response from the service contains an `error` field with a standard JSON-RPC error object', () => {
    it('returns an unsuccessful JSON-RPC response containing the error, wrapped in an "internal" error', async () => {
      const rpcService = buildRpcService();
      jest.spyOn(rpcService, 'request').mockResolvedValue({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -1000,
          message: 'oops',
        },
      });
      const middleware = createFetchMiddleware({
        rpcService,
      });

      const engine = new JsonRpcEngine();
      engine.push(middleware);
      const result = await engine.handle({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      });

      expect(result).toStrictEqual({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal JSON-RPC error.',
          stack: expect.stringContaining('Internal JSON-RPC error.'),
          data: {
            code: -1000,
            message: 'oops',
            cause: null,
          },
        },
      });
    });
  });

  describe('if the response from the service contains an `error` field with a non-standard JSON-RPC error object', () => {
    it('returns an unsuccessful JSON-RPC response containing the error, wrapped in an "internal" error', async () => {
      const rpcService = buildRpcService();
      jest.spyOn(rpcService, 'request').mockResolvedValue({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -32000,
          data: {
            foo: 'bar',
          },
          message: 'VM Exception while processing transaction: revert',
          // @ts-expect-error The `name` property is not strictly part of the
          // JSON-RPC error object.
          name: 'RuntimeError',
          stack:
            'RuntimeError: VM Exception while processing transaction: revert at exactimate (/Users/elliot/code/metamask/metamask-mobile/node_modules/ganache/dist/node/webpack:/Ganache/ethereum/ethereum/lib/src/helpers/gas-estimator.js:257:23)',
        },
      });
      const middleware = createFetchMiddleware({
        rpcService,
      });

      const engine = new JsonRpcEngine();
      engine.push(middleware);
      const result = await engine.handle({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      });

      expect(result).toStrictEqual({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal JSON-RPC error.',
          stack: expect.stringContaining('Internal JSON-RPC error.'),
          data: {
            code: -32000,
            data: {
              foo: 'bar',
            },
            message: 'VM Exception while processing transaction: revert',
            name: 'RuntimeError',
            stack:
              'RuntimeError: VM Exception while processing transaction: revert at exactimate (/Users/elliot/code/metamask/metamask-mobile/node_modules/ganache/dist/node/webpack:/Ganache/ethereum/ethereum/lib/src/helpers/gas-estimator.js:257:23)',
            cause: null,
          },
        },
      });
    });
  });

  describe('if the request throws', () => {
    it('returns an unsuccessful JSON-RPC response containing the error', async () => {
      const rpcService = buildRpcService();
      jest.spyOn(rpcService, 'request').mockRejectedValue(new Error('oops'));
      const middleware = createFetchMiddleware({
        rpcService,
      });

      const engine = new JsonRpcEngine();
      engine.push(middleware);
      const result = await engine.handle({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      });

      expect(result).toStrictEqual({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'oops',
          data: {
            cause: {
              message: 'oops',
              stack: expect.stringContaining('Error: oops'),
            },
          },
        },
      });
    });
  });
});

describe('createFetchConfigFromReq', () => {
  it('should create a fetch config from a request', async () => {
    const req = {
      id: 1,
      jsonrpc: '2.0' as const,
      method: 'eth_getBlockByNumber',
      params: ['0x482103', true],
    };
    const rpcUrl = 'http://www.xyz.io/rabbit:3456?id=100';
    const { fetchUrl, fetchParams } = createFetchConfigFromReq({
      btoa,
      req,
      rpcUrl,
    });
    expect(fetchUrl).toStrictEqual(rpcUrl);
    expect(fetchParams).toStrictEqual({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });
  });

  it('should create a fetch config with origin header', async () => {
    const request = {
      id: 1,
      jsonrpc: '2.0' as const,
      method: 'eth_getBlockByNumber',
      params: ['0x482103', true],
    };
    const requestWithOrigin = { ...request, origin: 'happydapp.gov' };
    const rpcUrl = 'http://www.xyz.io/rabbit:3456?id=100';
    const originHttpHeaderKey = 'x-dapp-origin';
    const { fetchUrl, fetchParams } = createFetchConfigFromReq({
      btoa,
      req: requestWithOrigin,
      rpcUrl,
      originHttpHeaderKey,
    });
    expect(fetchUrl).toStrictEqual(rpcUrl);
    expect(fetchParams).toStrictEqual({
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-dapp-origin': 'happydapp.gov',
      },
      body: JSON.stringify(request),
    });
  });
});

/**
 * Constructs a fake RPC service for use as a failover in tests.
 *
 * @returns The fake failover service.
 */
function buildRpcService(): AbstractRpcService {
  return {
    async request<Params extends JsonRpcParams, Result extends Json>(
      jsonRpcRequest: JsonRpcRequest<Params>,
      _fetchOptions?: RequestInit,
    ) {
      return {
        id: jsonRpcRequest.id,
        jsonrpc: jsonRpcRequest.jsonrpc,
        result: 'ok' as Result,
      };
    },
    onRetry() {
      return {
        dispose() {
          // do nothing
        },
      };
    },
    onBreak() {
      return {
        dispose() {
          // do nothing
        },
      };
    },
    onDegraded() {
      return {
        dispose() {
          // do nothing
        },
      };
    },
  };
}
