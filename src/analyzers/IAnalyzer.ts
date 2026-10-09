import * as vscode from 'vscode';
import { CodeIssue } from '@codeguardian/shared';

export interface IAnalyzer {
    readonly name: string;
    readonly supportedLanguages: string[];
    
    isEnabled(config: vscode.WorkspaceConfiguration): boolean;
    canAnalyze(document: vscode.TextDocument): boolean;
    analyze(document: vscode.TextDocument): Promise<CodeIssue[]>;
    dispose?(): void;
}

export interface AnalyzerResult {
    analyzer: string;
    issues: CodeIssue[];
    duration: number;
    error?: Error;
}