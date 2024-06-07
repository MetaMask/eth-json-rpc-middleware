import BN from 'bn.js';
import { add0x, isValidHexAddress } from '@metamask/utils';
import type { Hex } from '@metamask/utils';

type EIP712Domain = {
  verifyingContract: string;
};

type SignTypedMessageDataV3V4 = {
  types: Record<string, unknown>;
  domain: EIP712Domain;
  primaryType: string;
  message: unknown;
};

/**
 * Normalizes the messageData for the eth_signTypedData
 *
 * @param messageData - The messageData to normalize.
 * @returns The normalized messageData.
 */
export function normalizeEIP712TypedMessageData(messageData: string) {
  const data = parseMessageDataForEIP712Normalization(
    messageData,
  ) as unknown as SignTypedMessageDataV3V4;

  const { verifyingContract } = data.domain;

  if (verifyingContract) {
    data.domain.verifyingContract = normalizeAddress(verifyingContract);
  }

  return JSON.stringify(data);
}

/**
 * Parses the messageData to obtain the data object for EIP712 normalization
 *
 * @param data - The messageData to parse.
 * @returns The data object for EIP712 normalization.
 */
function parseMessageDataForEIP712Normalization(data: string) {
  let parsedData = data;
  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      throw new Error(
        `Invalid message "data" for normalization. data: ${data}`,
      );
    }
  }
  return parsedData;
}

/**
 * Normalizes the address to a hexadecimal format
 *
 * @param address - The address to normalize.
 * @returns The normalized address.
 */
function normalizeAddress(address: string): Hex {
  if (isValidHexAddress(address as Hex)) {
    return address as Hex;
  }

  // Check if the address is in octal format, convert to hexadecimal
  if (address.startsWith('0o')) {
    // If octal, convert to hexadecimal
    const decimalAddress = parseInt(address.slice(2), 8).toString(16);
    return add0x(decimalAddress);
  }

  // Check if the address is in decimal format, convert to hexadecimal
  const parsedAddress = parseInt(address, 10);
  if (!isNaN(parsedAddress)) {
    const hexString = new BN(address.toString(), 10).toString(16);
    return add0x(hexString);
  }

  // Returning the original address without normalization
  return address as unknown as Hex;
}
