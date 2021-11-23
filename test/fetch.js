const http = require('http');
const url = require('url');
const test = require('tape');
const concat = require('concat-stream');
const series = require('async/series');
const btoa = require('btoa');
const { createFetchMiddleware, createFetchConfigFromReq } = require('../dist');

test('fetch - basic', (t) => {
  const req = {
    method: 'eth_getBlockByNumber',
    params: ['0x482103', true],
  };
  const rpcUrl = 'http://www.xyz.io/rabbit:3456';
  const { fetchUrl, fetchParams } = createFetchConfigFromReq({ req, rpcUrl });

  t.equals(fetchUrl, rpcUrl);
  t.deepEquals(fetchParams, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });
  t.end();
});

test('fetch - origin header', (t) => {
  const req = {
    method: 'eth_getBlockByNumber',
    params: ['0x482103', true],
    origin: 'happydapp.gov',
  };
  const reqSanitized = Object.assign({}, req);
  delete reqSanitized.origin;

  const rpcUrl = 'http://www.xyz.io/rabbit:3456';
  const originHttpHeaderKey = 'x-dapp-origin';
  const { fetchUrl, fetchParams } = createFetchConfigFromReq({
    req,
    rpcUrl,
    originHttpHeaderKey,
  });

  t.equals(fetchUrl, rpcUrl);
  t.deepEquals(fetchParams, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-dapp-origin': 'happydapp.gov',
    },
    body: JSON.stringify(reqSanitized),
  });
  t.end();
});

test('fetch - auth in url', (t) => {
  const req = {
    method: 'eth_getBlockByNumber',
    params: ['0x482103', true],
  };

  const rpcUrl = 'https://user:password@www.xyz.io:3456/rabbit';
  const normalizedUrl = 'https://www.xyz.io:3456/rabbit';
  const encodedAuth = btoa('user:password');

  const { fetchUrl, fetchParams } = createFetchConfigFromReq({ req, rpcUrl });

  t.equals(fetchUrl, normalizedUrl);
  t.deepEquals(fetchParams, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${encodedAuth}`,
    },
    body: JSON.stringify(req),
  });
  t.end();
});

serverTest('fetch - server test', {
  createReq() {
    return {
      id: 1,
      json_rpc: '2.0',
      method: 'eth_getBalance',
      params: ['0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 'latest'],
    };
  },
  handleReq() {
    return {
      id: 1,
      result: 42,
    };
  },
  afternFn(t, res) {
    t.deepEquals(res, {
      id: 1,
      result: 42,
    });
  },
});

serverTest('fetch - server with error code', {
  createReq() {
    return {
      id: 1,
      json_rpc: '2.0',
      method: 'eth_getBalance',
      params: ['0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 'latest'],
    };
  },
  handleReq() {
    return {
      id: 1,
      error: {
        code: 42,
        message: 'dank',
      },
    };
  },
  afternFn(t, res) {
    t.deepEquals(res, {
      id: 1,
      error: {
        code: 42,
        message: 'dank',
      },
    });
  },
});

serverTest('fetch - server with NO error code', {
  createReq() {
    return {
      id: 1,
      json_rpc: '2.0',
      method: 'eth_getBalance',
      params: ['0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 'latest'],
    };
  },
  handleReq() {
    return {
      id: 1,
      error: {
        message: 'big baloo',
      },
    };
  },
  afternFn(t, res) {
    t.deepEquals(res, {
      id: 1,
      error: {
        message: 'big baloo',
      },
    });
  },
});

function serverTest(label, { createReq, handleReq, afternFn }) {
  test(label, (t) => {
    const rpcUrl = 'http://localhost:3000/abc/xyz';
    const clientReq = createReq();
    const clientRes = { id: clientReq.id };

    let server;
    let serverSideNetworkRequest;
    let serverSideReq;
    let serverSideRes;

    series([createServer, makeRequest, closeServer], (err) => {
      t.ifError(err, 'should not error');
      // validate request
      t.equals(serverSideNetworkRequest.headers.accept, 'application/json');
      t.equals(
        serverSideNetworkRequest.headers['content-type'],
        'application/json',
      );
      t.equals(serverSideNetworkRequest.method, 'POST');
      // eslint-disable-next-line node/no-deprecated-api
      t.equals(serverSideNetworkRequest.url, url.parse(rpcUrl).path);
      afternFn(t, serverSideRes);
      t.end();
    });

    function requestHandler(request, response) {
      request.pipe(
        concat((rawRequestBody) => {
          // save request details
          serverSideNetworkRequest = request;
          serverSideReq = JSON.parse(rawRequestBody.toString());
          serverSideRes = handleReq(serverSideReq);
          // send response
          const responseBody = JSON.stringify(serverSideRes);
          response.end(responseBody);
        }),
      );
    }

    function createServer(cb) {
      server = http.createServer(requestHandler);
      server.listen(3000, cb);
    }

    function closeServer(cb) {
      server.close(cb);
    }

    function makeRequest(cb) {
      const middleware = createFetchMiddleware({ rpcUrl });
      middleware(clientReq, clientRes, failTest, (err) => cb());
    }

    function failTest() {
      t.fail('something broke');
    }
  });
}
