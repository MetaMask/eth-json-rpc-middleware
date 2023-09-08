import * as sigUtil from '@metamask/eth-sig-util';
import { providerErrors, rpcErrors } from '@metamask/rpc-errors';
import type {
  JsonRpcMiddleware,
} from '@metamask/json-rpc-engine';
import type {
  Json,
  JsonRpcParams,
  JsonRpcRequest,
  PendingJsonRpcResponse,
} from '@metamask/utils';
import {
  createAsyncMiddleware,
  createScaffoldMiddleware,
} from '@metamask/json-rpc-engine';

import type { Block } from './types';

export interface TransactionParams {
  from: string;
}

export interface MessageParams extends TransactionParams {
  data: string;
}

export interface TypedMessageParams extends MessageParams {
  version: string;
}

export interface WalletMiddlewareOptions {
  getAccounts: (req: JsonRpcRequest<Json>) => Promise<string[]>;
  processDecryptMessage?: (
    msgParams: MessageParams,
    req: JsonRpcRequest<JsonRpcParams>,
  ) => Promise<string>;
  processEncryptionPublicKey?: (
    address: string,
    req: JsonRpcRequest<JsonRpcParams>,
  ) => Promise<string>;
  processEthSignMessage?: (
    msgParams: MessageParams,
    req: JsonRpcRequest<JsonRpcParams>,
  ) => Promise<string>;
  processPersonalMessage?: (
    msgParams: MessageParams,
    req: JsonRpcRequest<JsonRpcParams>,
  ) => Promise<string>;
  processTransaction?: (
    txParams: TransactionParams,
    req: JsonRpcRequest<JsonRpcParams>,
  ) => Promise<string>;
  processSignTransaction?: (
    txParams: TransactionParams,
    req: JsonRpcRequest<JsonRpcParams>,
  ) => Promise<string>;
  processTypedMessage?: (
    msgParams: MessageParams,
    req: JsonRpcRequest<JsonRpcParams>,
    version: string,
  ) => Promise<string>;
  processTypedMessageV3?: (
    msgParams: TypedMessageParams,
    req: JsonRpcRequest<JsonRpcParams>,
    version: string,
  ) => Promise<string>;
  processTypedMessageV4?: (
    msgParams: TypedMessageParams,
    req: JsonRpcRequest<JsonRpcParams>,
    version: string,
  ) => Promise<string>;
}

export function createWalletMiddleware({
  getAccounts,
  processDecryptMessage,
  processEncryptionPublicKey,
  processEthSignMessage,
  processPersonalMessage,
  processTransaction,
  processSignTransaction,
  processTypedMessage,
  processTypedMessageV3,
  processTypedMessageV4,
// }: WalletMiddlewareOptions): JsonRpcMiddleware<string, Block> {
}: WalletMiddlewareOptions): JsonRpcMiddleware<any, Block> {
  if (!getAccounts) {
    throw new Error('opts.getAccounts is required');
  }

  return createScaffoldMiddleware({
    // account lookups
    eth_accounts: createAsyncMiddleware(lookupAccounts),
    eth_coinbase: createAsyncMiddleware(lookupDefaultAccount),
    // tx signatures
    eth_sendTransaction: createAsyncMiddleware(sendTransaction),
    eth_signTransaction: createAsyncMiddleware(signTransaction),
    // message signatures
    eth_sign: createAsyncMiddleware(ethSign),
    eth_signTypedData: createAsyncMiddleware(signTypedData),
    eth_signTypedData_v3: createAsyncMiddleware(signTypedDataV3),
    eth_signTypedData_v4: createAsyncMiddleware(signTypedDataV4),
    personal_sign: createAsyncMiddleware(personalSign),
    eth_getEncryptionPublicKey: createAsyncMiddleware(encryptionPublicKey),
    eth_decrypt: createAsyncMiddleware(decryptMessage),
    personal_ecRecover: createAsyncMiddleware(personalRecover),
  });

  //
  // account lookups
  //

  async function lookupAccounts(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    res.result = await getAccounts(req);
  }

  async function lookupDefaultAccount(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    const accounts = await getAccounts(req);
    res.result = accounts[0] || null;
  }

  //
  // transaction signatures
  //

  async function sendTransaction(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processTransaction) {
      throw rpcErrors.methodNotSupported();
    }

    const txParams: TransactionParams =
      (req.params as TransactionParams[])[0] || {};
    txParams.from = await validateAndNormalizeKeyholder(txParams.from, req);
    res.result = await processTransaction(txParams, req);
  }

  async function signTransaction(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processSignTransaction) {
      throw rpcErrors.methodNotSupported();
    }

    const txParams: TransactionParams =
      (req.params as TransactionParams[])[0] || {};
    txParams.from = await validateAndNormalizeKeyholder(txParams.from, req);
    res.result = await processSignTransaction(txParams, req);
  }

  //
  // message signatures
  //

  async function ethSign(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processEthSignMessage) {
      throw rpcErrors.methodNotSupported();
    }

    const address: string = await validateAndNormalizeKeyholder(
      (req.params as string[])[0],
      req,
    );
    const message: string = (req.params as string[])[1];
    const extraParams: Record<string, JsonRpcParams> =
      (req.params as Record<string, JsonRpcParams>[])[2] || {};
    const msgParams: MessageParams = {
      ...extraParams,
      from: address,
      data: message,
    };

    res.result = await processEthSignMessage(msgParams, req);
  }

  async function signTypedData(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processTypedMessage) {
      throw rpcErrors.methodNotSupported();
    }

    const message: string = (req.params as string[])[0];
    const address: string = await validateAndNormalizeKeyholder(
      (req.params as string[])[1],
      req,
    );
    const version = 'V1';
    const extraParams: Record<string, JsonRpcParams> =
      (req.params as Record<string, JsonRpcParams>[])[2] || {};
    const msgParams: MessageParams = {
      ...extraParams,
      from: address,
      data: message,
    };

    res.result = await processTypedMessage(msgParams, req, version);
  }

  async function signTypedDataV3(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processTypedMessageV3) {
      throw rpcErrors.methodNotSupported();
    }

    const address: string = await validateAndNormalizeKeyholder(
      (req.params as string[])[0],
      req,
    );
    const message: string = (req.params as string[])[1];
    const version = 'V3';
    const msgParams: TypedMessageParams = {
      data: message,
      from: address,
      version,
    };

    res.result = await processTypedMessageV3(msgParams, req, version);
  }

  async function signTypedDataV4(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processTypedMessageV4) {
      throw rpcErrors.methodNotSupported();
    }

    const address: string = await validateAndNormalizeKeyholder(
      (req.params as string[])[0],
      req,
    );
    const message: string = (req.params as string[])[1];
    const version = 'V4';
    const msgParams: TypedMessageParams = {
      data: message,
      from: address,
      version,
    };

    res.result = await processTypedMessageV4(msgParams, req, version);
  }

  async function personalSign(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processPersonalMessage) {
      throw rpcErrors.methodNotSupported();
    }

    // process normally
    const firstParam: string = (req.params as string[])[0];
    const secondParam: string = (req.params as string[])[1];
    // non-standard "extraParams" to be appended to our "msgParams" obj
    const extraParams: Record<string, JsonRpcParams> =
      (req.params as Record<string, JsonRpcParams>[])[2] || {};

    // We initially incorrectly ordered these parameters.
    // To gracefully respect users who adopted this API early,
    // we are currently gracefully recovering from the wrong param order
    // when it is clearly identifiable.
    //
    // That means when the first param is definitely an address,
    // and the second param is definitely not, but is hex.
    let address: string, message: string;
    if (resemblesAddress(firstParam) && !resemblesAddress(secondParam)) {
      let warning = `The eth_personalSign method requires params ordered `;
      warning += `[message, address]. This was previously handled incorrectly, `;
      warning += `and has been corrected automatically. `;
      warning += `Please switch this param order for smooth behavior in the future.`;
      (res as any).warning = warning;

      address = firstParam;
      message = secondParam;
    } else {
      message = firstParam;
      address = secondParam;
    }
    address = await validateAndNormalizeKeyholder(address, req);

    const msgParams: MessageParams = {
      ...extraParams,
      from: address,
      data: message,
    };

    // eslint-disable-next-line require-atomic-updates
    res.result = await processPersonalMessage(msgParams, req);
  }

  async function personalRecover(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    const message: string = (req.params as string[])[0];
    const signature: string = (req.params as string[])[1];
    const signerAddress: string = sigUtil.recoverPersonalSignature({
      data: message,
      signature,
    });

    res.result = signerAddress;
  }

  async function encryptionPublicKey(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processEncryptionPublicKey) {
      throw rpcErrors.methodNotSupported();
    }

    const address: string = await validateAndNormalizeKeyholder(
      (req.params as string[])[0],
      req,
    );

    res.result = await processEncryptionPublicKey(address, req);
  }

  async function decryptMessage(
    req: JsonRpcRequest<JsonRpcParams>,
    res: PendingJsonRpcResponse<JsonRpcParams>,
  ): Promise<void> {
    if (!processDecryptMessage) {
      throw rpcErrors.methodNotSupported();
    }

    const ciphertext: string = (req.params as string[])[0];
    const address: string = await validateAndNormalizeKeyholder(
      (req.params as string[])[1],
      req,
    );
    const extraParams: Record<string, JsonRpcParams> =
      (req.params as Record<string, JsonRpcParams>[])[2] || {};
    const msgParams: MessageParams = {
      ...extraParams,
      from: address,
      data: ciphertext,
    };

    res.result = await processDecryptMessage(msgParams, req);
  }

  //
  // utility
  //

  /**
   * Validates the keyholder address, and returns a normalized (i.e. lowercase)
   * copy of it.
   *
   * @param address - The address to validate and normalize.
   * @param req - The request object.
   * @returns {string} - The normalized address, if valid. Otherwise, throws
   * an error
   */
  async function validateAndNormalizeKeyholder(
    address: string,
    req: JsonRpcRequest<JsonRpcParams>,
  ): Promise<string> {
    if (
      typeof address === 'string' &&
      address.length > 0 &&
      resemblesAddress(address)
    ) {
      // Ensure that an "unauthorized" error is thrown if the requester does not have the `eth_accounts`
      // permission.
      const accounts = await getAccounts(req);
      const normalizedAccounts: string[] = accounts.map((_address) =>
        _address.toLowerCase(),
      );
      const normalizedAddress: string = address.toLowerCase();

      if (normalizedAccounts.includes(normalizedAddress)) {
        return normalizedAddress;
      }
      throw providerErrors.unauthorized();
    }
    throw rpcErrors.invalidParams({
      message: `Invalid parameters: must provide an Ethereum address.`,
    });
  }
}

function resemblesAddress(str: string): boolean {
  // hex prefix 2 + 20 bytes
  return str.length === 2 + 20 * 2;
}
