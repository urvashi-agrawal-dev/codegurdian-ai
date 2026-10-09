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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const CommandManager_1 = require("./commands/CommandManager");
const DiagnosticsProvider_1 = require("./diagnostics/DiagnosticsProvider");
const CodeGuardianWebviewProvider_1 = require("./webview/CodeGuardianWebviewProvider");
const ContextCollector_1 = require("./context/ContextCollector");
const CodeGuardianCodeActionsProvider_1 = require("./codeActions/CodeGuardianCodeActionsProvider");
const Logger_1 = require("./utils/Logger");
let diagnosticsProvider;
let commandManager;
let webviewProvider;
let codeActionsProvider;
function activate(context) {
    Logger_1.Logger.info('CodeGuardian AI extension is activating...');
    try {
        // Initialize core components
        const contextCollector = new ContextCollector_1.ContextCollector();
        diagnosticsProvider = new DiagnosticsProvider_1.DiagnosticsProvider();
        webviewProvider = new CodeGuardianWebviewProvider_1.CodeGuardianWebviewProvider(context);
        commandManager = new CommandManager_1.CommandManager(diagnosticsProvider, webviewProvider, contextCollector);
        codeActionsProvider = new CodeGuardianCodeActionsProvider_1.CodeGuardianCodeActionsProvider(diagnosticsProvider);
        // Register diagnostics
        context.subscriptions.push(diagnosticsProvider.getDiagnosticCollection());
        // Register commands
        commandManager.registerCommands(context);
        // Register code actions provider
        const selector = [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'javascriptreact' },
            { scheme: 'file', language: 'typescriptreact' }
        ];
        context.subscriptions.push(vscode.languages.registerCodeActionsProvider(selector, codeActionsProvider, { providedCodeActionKinds: CodeGuardianCodeActionsProvider_1.CodeGuardianCodeActionsProvider.providedCodeActionKinds }));
        // Register webview provider
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('codeguardian.panel', webviewProvider, { webviewOptions: { retainContextWhenHidden: true } }));
        // Set up file watchers for real-time analysis
        setupFileWatchers(context);
        // Initialize workspace analysis if enabled
        const config = vscode.workspace.getConfiguration('codeguardian');
        if (config.get('analysis.enableRealTimeDiagnostics')) {
            analyzeActiveEditor();
        }
        Logger_1.Logger.info('CodeGuardian AI extension activated successfully');
        // Show welcome message on first activation
        if (context.globalState.get('codeguardian.firstActivation', true)) {
            showWelcomeMessage();
            context.globalState.update('codeguardian.firstActivation', false);
        }
    }
    catch (error) {
        Logger_1.Logger.error('Failed to activate CodeGuardian AI extension', error);
        vscode.window.showErrorMessage(`CodeGuardian AI failed to activate: ${error}`);
    }
}
function deactivate() {
    Logger_1.Logger.info('CodeGuardian AI extension is deactivating...');
    if (diagnosticsProvider) {
        diagnosticsProvider.dispose();
    }
    if (commandManager) {
        commandManager.dispose();
    }
}
function setupFileWatchers(context) {
    // Watch for document changes
    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
        const config = vscode.workspace.getConfiguration('codeguardian');
        if (config.get('analysis.enableRealTimeDiagnostics') && isSupported(event.document)) {
            // Debounce analysis to avoid excessive calls
            const debounceMs = config.get('analysis.debounceMs', 1000);
            debounceAnalysis(event.document, debounceMs);
        }
    });
    // Watch for active editor changes
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && isSupported(editor.document)) {
            analyzeDocument(editor.document);
        }
    });
    // Watch for file saves
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const config = vscode.workspace.getConfiguration('codeguardian');
        if (config.get('analysis.onSave') && isSupported(document)) {
            await analyzeDocument(document);
        }
    });
    context.subscriptions.push(documentChangeDisposable, editorChangeDisposable, saveDisposable);
}
let analysisTimeout;
function debounceAnalysis(document, delay = 1000) {
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }
    analysisTimeout = setTimeout(() => {
        analyzeDocument(document);
    }, delay);
}
function analyzeActiveEditor() {
    const editor = vscode.window.activeTextEditor;
    if (editor && isSupported(editor.document)) {
        analyzeDocument(editor.document);
    }
}
async function analyzeDocument(document) {
    try {
        if (diagnosticsProvider) {
            await diagnosticsProvider.analyzeDocument(document);
        }
    }
    catch (error) {
        Logger_1.Logger.error('Failed to analyze document', error);
    }
}
function isSupported(document) {
    const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    return supportedLanguages.includes(document.languageId) && !document.uri.scheme.startsWith('git');
}
function showWelcomeMessage() {
    const message = 'Welcome to CodeGuardian AI! Your intelligent code review and debugging assistant is now active.';
    const openPanel = 'Open CodeGuardian';
    const configure = 'Configure';
    vscode.window.showInformationMessage(message, openPanel, configure).then(selection => {
        if (selection === openPanel) {
            vscode.commands.executeCommand('codeguardian.openPanel');
        }
        else if (selection === configure) {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:codeguardian-ai-extension');
        }
    });
}
//# sourceMappingURL=extension.js.map