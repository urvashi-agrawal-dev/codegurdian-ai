import * as vscode from 'vscode';
import { CommandManager } from './commands/CommandManager';
import { DiagnosticsProvider } from './diagnostics/DiagnosticsProvider';
import { CodeGuardianWebviewProvider } from './webview/CodeGuardianWebviewProvider';
import { ContextCollector } from './context/ContextCollector';
import { CodeGuardianCodeActionsProvider } from './codeActions/CodeGuardianCodeActionsProvider';
import { Logger } from './utils/Logger';

let diagnosticsProvider: DiagnosticsProvider;
let commandManager: CommandManager;
let webviewProvider: CodeGuardianWebviewProvider;
let codeActionsProvider: CodeGuardianCodeActionsProvider;

export function activate(context: vscode.ExtensionContext) {
    Logger.info('CodeGuardian AI extension is activating...');

    try {
        // Initialize core components
        const contextCollector = new ContextCollector();
        diagnosticsProvider = new DiagnosticsProvider();
        webviewProvider = new CodeGuardianWebviewProvider(context);
        commandManager = new CommandManager(diagnosticsProvider, webviewProvider, contextCollector);
        codeActionsProvider = new CodeGuardianCodeActionsProvider(diagnosticsProvider);

        // Register diagnostics
        context.subscriptions.push(diagnosticsProvider.getDiagnosticCollection());

        // Register commands
        commandManager.registerCommands(context);

        // Register code actions provider
        const selector: vscode.DocumentSelector = [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'javascriptreact' },
            { scheme: 'file', language: 'typescriptreact' }
        ];
        
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                selector,
                codeActionsProvider,
                { providedCodeActionKinds: CodeGuardianCodeActionsProvider.providedCodeActionKinds }
            )
        );

        // Register webview provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                'codeguardian.panel',
                webviewProvider,
                { webviewOptions: { retainContextWhenHidden: true } }
            )
        );

        // Set up file watchers for real-time analysis
        setupFileWatchers(context);

        // Initialize workspace analysis if enabled
        const config = vscode.workspace.getConfiguration('codeguardian');
        if (config.get('analysis.enableRealTimeDiagnostics')) {
            analyzeActiveEditor();
        }

        Logger.info('CodeGuardian AI extension activated successfully');

        // Show welcome message on first activation
        if (context.globalState.get('codeguardian.firstActivation', true)) {
            showWelcomeMessage();
            context.globalState.update('codeguardian.firstActivation', false);
        }

    } catch (error) {
        Logger.error('Failed to activate CodeGuardian AI extension', error);
        vscode.window.showErrorMessage(`CodeGuardian AI failed to activate: ${error}`);
    }
}

export function deactivate() {
    Logger.info('CodeGuardian AI extension is deactivating...');
    
    if (diagnosticsProvider) {
        diagnosticsProvider.dispose();
    }
    
    if (commandManager) {
        commandManager.dispose();
    }
}

function setupFileWatchers(context: vscode.ExtensionContext) {
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

let analysisTimeout: NodeJS.Timeout | undefined;

function debounceAnalysis(document: vscode.TextDocument, delay: number = 1000) {
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

async function analyzeDocument(document: vscode.TextDocument) {
    try {
        if (diagnosticsProvider) {
            await diagnosticsProvider.analyzeDocument(document);
        }
    } catch (error) {
        Logger.error('Failed to analyze document', error);
    }
}

function isSupported(document: vscode.TextDocument): boolean {
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
        } else if (selection === configure) {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:codeguardian-ai-extension');
        }
    });
}