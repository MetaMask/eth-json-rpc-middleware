"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerFromEngine = void 0;
const safe_event_emitter_1 = __importDefault(require("@metamask/safe-event-emitter"));
function providerFromEngine(engine) {
    const provider = new safe_event_emitter_1.default();
    // handle both rpc send methods
    provider.sendAsync = (req, cb) => {
        engine.handle(req, cb);
    };
    provider.send = (req, callback) => {
        if (typeof callback !== 'function') {
            throw new Error('Must provide callback to "send" method.');
        }
        engine.handle(req, callback);
    };
    // forward notifications
    if (engine.on) {
        engine.on('notification', (message) => {
            provider.emit('data', null, message);
        });
    }
    return provider;
}
exports.providerFromEngine = providerFromEngine;
//# sourceMappingURL=providerFromEngine.js.map