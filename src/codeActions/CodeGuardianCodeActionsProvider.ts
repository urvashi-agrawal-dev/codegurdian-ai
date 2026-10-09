import * as vscode from 'vscode';
import { CodeIssue } from '@codeguardian/shared';
import { Logger } from '../utils/Logger';

export class CodeGuardianCodeActionsProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor
    ];

    private diagnosticsProvider: any; // Will be injected

    constructor(diagnosticsProvider: any) {
        this.diagnosticsProvider = diagnosticsProvider;
    }

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        
        const actions: vscode.CodeAction[] = [];

        // Look for CodeGuardian diagnostics in the range
        const codeGuardianDiagnostics = context.diagnostics.filter(
            diagnostic => diagnostic.source === 'CodeGuardian AI'
        );

        for (const diagnostic of codeGuardianDiagnostics) {
            // Get the corresponding CodeGuardian issue
            const issue = this.getIssueForDiagnostic(document, diagnostic);
            if (issue) {
                actions.push(...this.createActionsForIssue(document, issue, diagnostic));
            }
        }

        return actions;
    }

    private getIssueForDiagnostic(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): CodeIssue | undefined {
        if (!this.diagnosticsProvider?.getIssuesForDocument) {
            return undefined;
        }

        const issues = this.diagnosticsProvider.getIssuesForDocument(document.uri);
        return issues.find((issue: CodeIssue) => 
            issue.location.line === diagnostic.range.start.line &&
            issue.location.column === diagnostic.range.start.character &&
            issue.message === diagnostic.message
        );
    }

    private createActionsForIssue(
        document: vscode.TextDocument, 
        issue: CodeIssue, 
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction[] {
        
        const actions: vscode.CodeAction[] = [];

        // Explain Issue Action
        const explainAction = new vscode.CodeAction(
            'Explain with CodeGuardian',
            vscode.CodeActionKind.QuickFix
        );
        explainAction.command = {
            command: 'codeguardian.explainIssueAtPosition',
            title: 'Explain Issue',
            arguments: [document.uri, diagnostic.range.start, issue]
        };
        explainAction.diagnostics = [diagnostic];
        explainAction.isPreferred = true;
        actions.push(explainAction);

        // Fix Issue Action (placeholder for Phase 3)
        const fixAction = new vscode.CodeAction(
            'Fix with CodeGuardian',
            vscode.CodeActionKind.QuickFix
        );
        fixAction.command = {
            command: 'codeguardian.fixIssueAtPosition',
            title: 'Fix Issue',
            arguments: [document.uri, diagnostic.range.start, issue]
        };
        fixAction.diagnostics = [diagnostic];
        actions.push(fixAction);

        // Generate Tests Action (for functions)
        if (this.isFunctionRelated(issue)) {
            const testAction = new vscode.CodeAction(
                'Generate Tests',
                vscode.CodeActionKind.Refactor
            );
            testAction.command = {
                command: 'codeguardian.generateTestsAtPosition',
                title: 'Generate Tests',
                arguments: [document.uri, diagnostic.range.start, issue]
            };
            actions.push(testAction);
        }

        return actions;
    }

    private isFunctionRelated(issue: CodeIssue): boolean {
        const functionCategories = ['typescript', 'function-signature', 'missing-return-type'];
        return functionCategories.includes(issue.category || '') ||
               Boolean(issue.issueCode && ['missing-return-type', 'unused-variable'].includes(issue.issueCode));
    }
}