const EventEmitter = require('events')

module.exports = providerFromEngine

function providerFromEngine (engine) {
  const provider = new EventEmitter()
  provider.sendAsync = engine.handle.bind(engine)
  // rebroadcast the 'data' event from engine to provider
  engine.on('data', provider.emit.bind(provider, 'data'))
  return provider
}
