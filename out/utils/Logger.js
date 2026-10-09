"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
class Logger {
    static getOutputChannel() {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('CodeGuardian AI');
        }
        return this.outputChannel;
    }
    static info(message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] INFO: ${message}`;
        console.log(formattedMessage, ...args);
        this.getOutputChannel().appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
    }
    static error(message, error) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ERROR: ${message}`;
        console.error(formattedMessage, error);
        this.getOutputChannel().appendLine(formattedMessage + (error ? ' ' + (error.stack || error.toString()) : ''));
        this.getOutputChannel().show(true);
    }
    static warn(message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] WARN: ${message}`;
        console.warn(formattedMessage, ...args);
        this.getOutputChannel().appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
    }
    static debug(message, ...args) {
        const config = vscode.workspace.getConfiguration('codeguardian');
        if (config.get('debug.enableLogging', false)) {
            const timestamp = new Date().toISOString();
            const formattedMessage = `[${timestamp}] DEBUG: ${message}`;
            console.debug(formattedMessage, ...args);
            this.getOutputChannel().appendLine(formattedMessage + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
        }
    }
    static dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
            this.outputChannel = undefined;
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map