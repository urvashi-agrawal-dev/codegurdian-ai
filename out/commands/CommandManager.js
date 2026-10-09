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
exports.CommandManager = void 0;
const vscode = __importStar(require("vscode"));
const Logger_1 = require("../utils/Logger");
class CommandManager {
    constructor(diagnosticsProvider, webviewProvider, contextCollector) {
        this.diagnosticsProvider = diagnosticsProvider;
        this.webviewProvider = webviewProvider;
        this.contextCollector = contextCollector;
    }
    registerCommands(context) {
        const commands = [
            vscode.commands.registerCommand('codeguardian.analyzeCurrentFile', this.analyzeCurrentFile.bind(this)),
            vscode.commands.registerCommand('codeguardian.analyzeSelection', this.analyzeSelection.bind(this)),
            vscode.commands.registerCommand('codeguardian.explainIssue', this.explainIssue.bind(this)),
            vscode.commands.registerCommand('codeguardian.explainIssueAtPosition', this.explainIssueAtPosition.bind(this)),
            vscode.commands.registerCommand('codeguardian.fixWithAI', this.fixWithAI.bind(this)),
            vscode.commands.registerCommand('codeguardian.fixIssueAtPosition', this.fixIssueAtPosition.bind(this)),
            vscode.commands.registerCommand('codeguardian.generateTests', this.generateTests.bind(this)),
            vscode.commands.registerCommand('codeguardian.generateTestsAtPosition', this.generateTestsAtPosition.bind(this)),
            vscode.commands.registerCommand('codeguardian.openPanel', this.openPanel.bind(this)),
            vscode.commands.registerCommand('codeguardian.analyzeWorkspace', this.analyzeWorkspace.bind(this)),
            vscode.commands.registerCommand('codeguardian.chatWithAI', this.chatWithAI.bind(this))
        ];
        commands.forEach(command => context.subscriptions.push(command));
        Logger_1.Logger.info('CodeGuardian commands registered successfully');
    }
    async analyzeCurrentFile() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }
            const document = editor.document;
            if (!this.isSupportedLanguage(document.languageId)) {
                vscode.window.showWarningMessage(`Language ${document.languageId} is not currently supported`);
                return;
            }
            vscode.window.showInformationMessage('Analyzing current file...');
            Logger_1.Logger.info(`Analyzing file: ${document.fileName}`);
            await this.diagnosticsProvider.analyzeDocument(document);
            const issues = this.diagnosticsProvider.getIssuesForDocument(document.uri);
            const message = `Analysis complete. Found ${issues.length} issue(s) in ${document.fileName}`;
            if (issues.length > 0) {
                const viewIssues = 'View Issues';
                const result = await vscode.window.showInformationMessage(message, viewIssues);
                if (result === viewIssues) {
                    this.openPanel();
                }
            }
            else {
                vscode.window.showInformationMessage(message);
            }
        }
        catch (error) {
            Logger_1.Logger.error('Failed to analyze current file', error);
            vscode.window.showErrorMessage(`Failed to analyze file: ${error}`);
        }
    }
    async analyzeSelection() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }
            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showWarningMessage('No code selected');
                return;
            }
            const document = editor.document;
            if (!this.isSupportedLanguage(document.languageId)) {
                vscode.window.showWarningMessage(`Language ${document.languageId} is not currently supported`);
                return;
            }
            vscode.window.showInformationMessage('Analyzing selected code...');
            Logger_1.Logger.info(`Analyzing selection in: ${document.fileName}`);
            const context = await this.contextCollector.collectContext(document, selection);
            // For now, just show the context collected (in Phase 1)
            const selectedText = document.getText(selection);
            const lines = selectedText.split('\\n').length;
            vscode.window.showInformationMessage(`Selected ${lines} lines for analysis. Context collected successfully.`);
            // TODO: Send to AI for analysis in later phases
            this.openPanel();
        }
        catch (error) {
            Logger_1.Logger.error('Failed to analyze selection', error);
            vscode.window.showErrorMessage(`Failed to analyze selection: ${error}`);
        }
    }
    async explainIssue() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }
            const position = editor.selection.active;
            const issue = this.diagnosticsProvider.getIssueAtPosition(editor.document.uri, position);
            if (!issue) {
                vscode.window.showWarningMessage('No issue found at cursor position');
                return;
            }
            vscode.window.showInformationMessage('Preparing issue explanation...');
            Logger_1.Logger.info(`Explaining issue: ${issue.message}`);
            // For Phase 1, just show issue details
            const explanation = `**Issue**: ${issue.message}\\n\\n` +
                `**Severity**: ${issue.severity}\\n` +
                `**Category**: ${issue.category || 'Unknown'}\\n` +
                `**Location**: Line ${issue.location.line + 1}, Column ${issue.location.column + 1}\\n\\n` +
                `*AI explanation coming in Phase 3...*`;
            this.webviewProvider.showIssueExplanation(issue, explanation);
            this.openPanel();
        }
        catch (error) {
            Logger_1.Logger.error('Failed to explain issue', error);
            vscode.window.showErrorMessage(`Failed to explain issue: ${error}`);
        }
    }
    async fixWithAI() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }
            const position = editor.selection.active;
            const issue = this.diagnosticsProvider.getIssueAtPosition(editor.document.uri, position);
            if (!issue) {
                vscode.window.showWarningMessage('No issue found at cursor position');
                return;
            }
            // For Phase 1, just show placeholder
            vscode.window.showInformationMessage(`Fix generation for "${issue.message}" will be available in Phase 4`);
            Logger_1.Logger.info(`Fix requested for issue: ${issue.message}`);
        }
        catch (error) {
            Logger_1.Logger.error('Failed to generate fix', error);
            vscode.window.showErrorMessage(`Failed to generate fix: ${error}`);
        }
    }
    async generateTests() {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found');
                return;
            }
            // For Phase 1, just show placeholder
            vscode.window.showInformationMessage('Test generation will be available in Phase 4');
            Logger_1.Logger.info(`Test generation requested for: ${editor.document.fileName}`);
        }
        catch (error) {
            Logger_1.Logger.error('Failed to generate tests', error);
            vscode.window.showErrorMessage(`Failed to generate tests: ${error}`);
        }
    }
    async openPanel() {
        try {
            await vscode.commands.executeCommand('workbench.view.extension.codeguardian');
        }
        catch (error) {
            Logger_1.Logger.error('Failed to open CodeGuardian panel', error);
            vscode.window.showErrorMessage('Failed to open CodeGuardian panel');
        }
    }
    async analyzeWorkspace() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage('No workspace folder found');
                return;
            }
            const config = vscode.workspace.getConfiguration('codeguardian');
            const maxFiles = config.get('analysis.maxFilesAnalyzed', 100);
            vscode.window.showInformationMessage('Starting workspace analysis...');
            Logger_1.Logger.info('Starting workspace analysis');
            const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', '{node_modules,dist,build,out}/**', maxFiles);
            let totalIssues = 0;
            let analyzedFiles = 0;
            const progress = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Analyzing workspace...',
                cancellable: true
            }, async (progress, token) => {
                for (let i = 0; i < files.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    const file = files[i];
                    try {
                        const document = await vscode.workspace.openTextDocument(file);
                        await this.diagnosticsProvider.analyzeDocument(document);
                        const issues = this.diagnosticsProvider.getIssuesForDocument(file);
                        totalIssues += issues.length;
                        analyzedFiles++;
                        progress.report({
                            increment: (100 / files.length),
                            message: `Analyzed ${analyzedFiles}/${files.length} files (${totalIssues} issues found)`
                        });
                    }
                    catch (error) {
                        Logger_1.Logger.warn(`Failed to analyze ${file.fsPath}`, error);
                    }
                }
            });
            const message = `Workspace analysis complete. Analyzed ${analyzedFiles} files and found ${totalIssues} issues.`;
            const viewReport = 'View Report';
            const result = await vscode.window.showInformationMessage(message, viewReport);
            if (result === viewReport) {
                this.openPanel();
            }
            Logger_1.Logger.info(`Workspace analysis complete: ${analyzedFiles} files, ${totalIssues} issues`);
        }
        catch (error) {
            Logger_1.Logger.error('Failed to analyze workspace', error);
            vscode.window.showErrorMessage(`Workspace analysis failed: ${error}`);
        }
    }
    async explainIssueAtPosition(uri, position, issue) {
        try {
            Logger_1.Logger.info(`Explaining issue at position: ${issue.message}`);
            // For Phase 2, just show issue details (AI explanation comes in Phase 3)
            const explanation = `**Issue**: ${issue.message}\n\n` +
                `**Severity**: ${issue.severity}\n` +
                `**Source**: ${issue.source}\n` +
                `**Rule ID**: ${issue.issueCode || 'N/A'}\n` +
                `**Category**: ${issue.category || 'Unknown'}\n` +
                `**Location**: Line ${issue.location.line + 1}, Column ${issue.location.column + 1}\n\n` +
                `*AI explanation will be available in Phase 3...*`;
            this.webviewProvider.showIssueExplanation(issue, explanation);
            this.openPanel();
        }
        catch (error) {
            Logger_1.Logger.error('Failed to explain issue at position', error);
            vscode.window.showErrorMessage(`Failed to explain issue: ${error}`);
        }
    }
    async fixIssueAtPosition(uri, position, issue) {
        try {
            // For Phase 2, just show placeholder (AI fix generation comes in Phase 4)
            vscode.window.showInformationMessage(`Fix generation for "${issue.message}" will be available in Phase 4`);
            Logger_1.Logger.info(`Fix requested for issue at position: ${issue.message}`);
        }
        catch (error) {
            Logger_1.Logger.error('Failed to generate fix at position', error);
            vscode.window.showErrorMessage(`Failed to generate fix: ${error}`);
        }
    }
    async generateTestsAtPosition(uri, position, issue) {
        try {
            // For Phase 2, just show placeholder (test generation comes in Phase 4)
            vscode.window.showInformationMessage('Test generation will be available in Phase 4');
            Logger_1.Logger.info(`Test generation requested for issue at position: ${issue.message}`);
        }
        catch (error) {
            Logger_1.Logger.error('Failed to generate tests at position', error);
            vscode.window.showErrorMessage('Failed to generate tests');
        }
    }
    async chatWithAI() {
        try {
            // For Phase 2, just open the panel with chat placeholder
            this.openPanel();
            vscode.window.showInformationMessage('AI chat will be available in Phase 7');
        }
        catch (error) {
            Logger_1.Logger.error('Failed to start AI chat', error);
            vscode.window.showErrorMessage('Failed to start AI chat');
        }
    }
    isSupportedLanguage(languageId) {
        const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
        return supportedLanguages.includes(languageId);
    }
    dispose() {
        // Command disposables are automatically handled by VS Code
        Logger_1.Logger.info('CommandManager disposed');
    }
}
exports.CommandManager = CommandManager;
//# sourceMappingURL=CommandManager.js.map