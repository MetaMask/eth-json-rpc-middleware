import { normalizeEIP712TypedMessageData } from './normalizer';

describe('normalizeEIP712TypedMessageData', () => {
  const messageData = {
    types: {
      Permit: [
        {
          name: 'owner',
          type: 'address',
        },
        {
          name: 'spender',
          type: 'address',
        },
        {
          name: 'value',
          type: 'uint256',
        },
        {
          name: 'nonce',
          type: 'uint256',
        },
        {
          name: 'deadline',
          type: 'uint256',
        },
      ],
      EIP712Domain: [
        {
          name: 'name',
          type: 'string',
        },
        {
          name: 'version',
          type: 'string',
        },
        {
          name: 'chainId',
          type: 'uint256',
        },
        {
          name: 'verifyingContract',
          type: 'address',
        },
      ],
    },
    domain: {
      name: 'Liquid staked Ether 2.0',
      version: '2',
      chainId: '0x1',
      verifyingContract: '996101235222674412020337938588541139382869425796',
    },
    primaryType: 'Permit',
    message: {
      owner: '0x6d404afe1a6a07aa3cbcbf9fd027671df628ebfc',
      spender: '0x63605E53D422C4F1ac0e01390AC59aAf84C44A51',
      value:
        '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      nonce: '0',
      deadline: '4482689033',
    },
  };

  function parseNormalizerResult(data: Record<string, unknown>) {
    return JSON.parse(normalizeEIP712TypedMessageData(JSON.stringify(data)));
  }

  it('should normalize verifyingContract address in domain', () => {
    const normalizedData = parseNormalizerResult(messageData);
    expect(normalizedData.domain.verifyingContract).toBe(
      '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
    );
  });

  it('should handle non-hexadecimal verifyingContract address by normalizing it', () => {
    const messageDataWithNonHexAddress = {
      ...messageData,
      domain: {
        ...messageData.domain,
        verifyingContract: '123',
      },
    };

    const normalizedData = parseNormalizerResult(messageDataWithNonHexAddress);

    expect(normalizedData.domain.verifyingContract).toBe('0x7b');
  });

  it('should handle octal verifyingContract address by normalizing it', () => {
    const expectedNormalizedOctalAddress = '0x53';
    const messageDataWithOctalAddress = {
      ...messageData,
      domain: {
        ...messageData.domain,
        verifyingContract: '0o123',
      },
    };

    const normalizedData = parseNormalizerResult(messageDataWithOctalAddress);

    expect(normalizedData.domain.verifyingContract).toBe(
      expectedNormalizedOctalAddress,
    );
  });

  it('should not modify if verifyingContract is already hexadecimal', () => {
    const expectedVerifyingContract =
      '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
    const messageDataWithHexAddress = {
      ...messageData,
      domain: {
        ...messageData.domain,
        verifyingContract: expectedVerifyingContract,
      },
    };

    const normalizedData = parseNormalizerResult(messageDataWithHexAddress);

    expect(normalizedData.domain.verifyingContract).toBe(
      expectedVerifyingContract,
    );
  });

  it('should not modify other parts of the message data', () => {
    const normalizedData = parseNormalizerResult(messageData);
    expect(normalizedData.message).toStrictEqual(messageData.message);
    expect(normalizedData.types).toStrictEqual(messageData.types);
    expect(normalizedData.primaryType).toStrictEqual(messageData.primaryType);
  });

  it('should throw if data is not parsable or an array', () => {
    expect(() => normalizeEIP712TypedMessageData('uh oh')).toThrow(
      'Invalid message "data" for normalization. data: uh oh',
    );
  });
});
