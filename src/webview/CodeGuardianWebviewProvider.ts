import * as vscode from 'vscode';
import { CodeIssue } from '@codeguardian/shared';
import { Logger } from '../utils/Logger';

export class CodeGuardianWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codeguardian.panel';
    private _view?: vscode.WebviewView;
    private currentIssue?: CodeIssue;
    private currentExplanation?: string;

    constructor(private readonly _extensionContext: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionContext.extensionUri
            ]
        };

        webviewView.webview.html = this.getHtmlForWebview();
        
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'explainIssue':
                        vscode.commands.executeCommand('codeguardian.explainIssue');
                        break;
                    case 'fixIssue':
                        vscode.commands.executeCommand('codeguardian.fixWithAI');
                        break;
                    case 'generateTests':
                        vscode.commands.executeCommand('codeguardian.generateTests');
                        break;
                    case 'analyzeWorkspace':
                        vscode.commands.executeCommand('codeguardian.analyzeWorkspace');
                        break;
                    case 'refreshView':
                        this.refreshView();
                        break;
                }
            },
            undefined,
            this._extensionContext.subscriptions
        );

        Logger.info('CodeGuardian webview initialized');
    }

    public showIssueExplanation(issue: CodeIssue, explanation: string): void {
        this.currentIssue = issue;
        this.currentExplanation = explanation;
        this.refreshView();
    }

    private refreshView(): void {
        if (this._view) {
            this._view.webview.html = this.getHtmlForWebview();
        }
    }

    private getHtmlForWebview(): string {
        const issuesHtml = this.getIssuesHtml();
        const currentIssueHtml = this.getCurrentIssueHtml();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CodeGuardian AI</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    font-weight: var(--vscode-font-weight);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .logo {
                    font-size: 18px;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                    margin-bottom: 5px;
                }
                .subtitle {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
                .section {
                    margin-bottom: 20px;
                    padding: 15px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    border: 1px solid var(--vscode-panel-border);
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    margin: 4px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .button.secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .button.secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .issue-count {
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 14px;
                }
                .severity-critical { color: #f44747; }
                .severity-high { color: #ff8c00; }
                .severity-medium { color: #ffcc02; }
                .severity-low { color: #89d185; }
                .current-issue {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textLink-foreground);
                    padding: 15px;
                    margin: 15px 0;
                }
                .issue-title {
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .issue-details {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 10px;
                }
                .explanation {
                    white-space: pre-wrap;
                    margin: 10px 0;
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                    border-radius: 3px;
                }
                .placeholder {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">🛡️ CodeGuardian AI</div>
                <div class="subtitle">Context-Aware Code Review Assistant</div>
            </div>

            ${issuesHtml}
            ${currentIssueHtml}

            <div class="section">
                <div class="section-title">Quick Actions</div>
                <button class="button" onclick="sendMessage('analyzeWorkspace')">Analyze Workspace</button>
                <button class="button secondary" onclick="sendMessage('refreshView')">Refresh</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                function sendMessage(type, data = {}) {
                    vscode.postMessage({ type, ...data });
                }
            </script>
        </body>
        </html>`;
    }

    private getIssuesHtml(): string {
        // Get issues from all open documents
        const issues = this.getAllIssues();
        
        if (issues.length === 0) {
            return `
                <div class="section">
                    <div class="section-title">Workspace Analysis</div>
                    <div class="placeholder">
                        No issues detected. Run analysis to scan your code.
                    </div>
                </div>
            `;
        }

        const counts = this.getIssueCounts(issues);
        
        return `
            <div class="section">
                <div class="section-title">Issues Detected</div>
                <div class="issue-count">
                    <span class="severity-critical">🔴 Critical: ${counts.critical}</span>
                    <span class="severity-high">🟠 High: ${counts.high}</span>
                </div>
                <div class="issue-count">
                    <span class="severity-medium">🟡 Medium: ${counts.medium}</span>
                    <span class="severity-low">🟢 Low: ${counts.low}</span>
                </div>
                <div style="margin-top: 10px; font-weight: bold;">
                    Total: ${issues.length} issue(s)
                </div>
            </div>
        `;
    }

    private getCurrentIssueHtml(): string {
        if (!this.currentIssue || !this.currentExplanation) {
            return `
                <div class="section">
                    <div class="section-title">AI Analysis</div>
                    <div class="placeholder">
                        Click on an issue or use "Explain Issue" to see AI analysis
                    </div>
                </div>
            `;
        }

        const severityClass = `severity-${this.currentIssue.severity}`;
        
        return `
            <div class="current-issue">
                <div class="issue-title ${severityClass}">
                    ${this.currentIssue.message}
                </div>
                <div class="issue-details">
                    📍 ${this.currentIssue.location.file}:${this.currentIssue.location.line + 1}:${this.currentIssue.location.column + 1}
                    | 📊 ${this.currentIssue.severity.toUpperCase()}
                    ${this.currentIssue.category ? `| 🏷️ ${this.currentIssue.category}` : ''}
                </div>
                
                <div class="explanation">
                    ${this.currentExplanation}
                </div>
                
                <div>
                    <button class="button" onclick="sendMessage('fixIssue')">🔧 Fix Issue</button>
                    <button class="button secondary" onclick="sendMessage('generateTests')">🧪 Generate Tests</button>
                </div>
            </div>
        `;
    }

    private getAllIssues(): CodeIssue[] {
        // For Phase 1, we'll return empty array since we don't have access to diagnostics provider here
        // This will be improved in later phases
        return [];
    }

    private getIssueCounts(issues: CodeIssue[]) {
        return {
            critical: issues.filter(i => i.severity === 'critical').length,
            high: issues.filter(i => i.severity === 'high').length,
            medium: issues.filter(i => i.severity === 'medium').length,
            low: issues.filter(i => i.severity === 'low').length
        };
    }
}