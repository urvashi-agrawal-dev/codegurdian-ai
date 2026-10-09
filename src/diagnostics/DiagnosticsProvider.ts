import * as vscode from 'vscode';
import { CodeIssue } from '@codeguardian/shared';
import { Logger } from '../utils/Logger';
import { AnalysisEngine } from '../analyzers/AnalysisEngine';

export class DiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private issuesMap = new Map<string, CodeIssue[]>();
    private analysisEngine: AnalysisEngine;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codeguardian');
        this.analysisEngine = new AnalysisEngine();
    }

    getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<void> {
        try {
            Logger.debug(`Analyzing document: ${document.uri.fsPath}`);
            
            const issues = await this.analysisEngine.analyzeDocument(document);
            this.issuesMap.set(document.uri.toString(), issues);
            
            const diagnostics = issues.map(issue => this.createDiagnostic(issue));
            this.diagnosticCollection.set(document.uri, diagnostics);
            
            Logger.debug(`Found ${issues.length} issues in ${document.fileName}`);
        } catch (error) {
            Logger.error('Failed to analyze document', error);
        }
    }

    getIssuesForDocument(uri: vscode.Uri): CodeIssue[] {
        return this.issuesMap.get(uri.toString()) || [];
    }

    getIssueAtPosition(uri: vscode.Uri, position: vscode.Position): CodeIssue | undefined {
        const issues = this.getIssuesForDocument(uri);
        return issues.find(issue => 
            issue.location.line === position.line &&
            issue.location.column <= position.character &&
            (issue.location.endColumn ?? issue.location.column + 1) > position.character
        );
    }

    private createDiagnostic(issue: CodeIssue): vscode.Diagnostic {
        const range = new vscode.Range(
            new vscode.Position(issue.location.line, issue.location.column),
            new vscode.Position(
                issue.location.endLine ?? issue.location.line,
                issue.location.endColumn ?? issue.location.column + 1
            )
        );

        const diagnostic = new vscode.Diagnostic(
            range,
            issue.message,
            this.mapSeverity(issue.severity)
        );

        diagnostic.source = 'CodeGuardian AI';
        diagnostic.code = issue.issueCode;
        diagnostic.tags = this.getDiagnosticTags(issue.category);

        return diagnostic;
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'critical':
                return vscode.DiagnosticSeverity.Error;
            case 'high':
                return vscode.DiagnosticSeverity.Error;
            case 'medium':
                return vscode.DiagnosticSeverity.Warning;
            case 'low':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Warning;
        }
    }

    private getDiagnosticTags(category?: string): vscode.DiagnosticTag[] {
        const tags: vscode.DiagnosticTag[] = [];
        
        if (category === 'deprecated' || category === 'modern-javascript') {
            tags.push(vscode.DiagnosticTag.Deprecated);
        }
        
        return tags;
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
        this.analysisEngine.dispose();
        this.issuesMap.clear();
    }
}