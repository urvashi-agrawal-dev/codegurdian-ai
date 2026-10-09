import * as vscode from 'vscode';
import { ESLint } from 'eslint';
import { CodeIssue } from '@codeguardian/shared';
import { IAnalyzer } from './IAnalyzer';
import { Logger } from '../utils/Logger';
import * as path from 'path';

export class ESLintAnalyzer implements IAnalyzer {
    readonly name = 'eslint';
    readonly supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
    
    private eslintCache = new Map<string, ESLint>();

    isEnabled(config: vscode.WorkspaceConfiguration): boolean {
        return config.get('codeguardian.analysis.eslint.enabled', true);
    }

    canAnalyze(document: vscode.TextDocument): boolean {
        return this.supportedLanguages.includes(document.languageId);
    }

    async analyze(document: vscode.TextDocument): Promise<CodeIssue[]> {
        if (!this.canAnalyze(document)) {
            return [];
        }

        try {
            Logger.debug(`Running ESLint analysis on ${document.fileName}`);
            
            const eslint = await this.getESLintInstance(document);
            if (!eslint) {
                Logger.debug('ESLint not available for this file');
                return [];
            }

            const text = document.getText();
            const results = await eslint.lintText(text, {
                filePath: document.uri.fsPath
            });

            const issues: CodeIssue[] = [];
            
            for (const result of results) {
                for (const message of result.messages) {
                    const issue: CodeIssue = {
                        id: `eslint-${document.uri.toString()}-${message.line}-${message.column}-${message.ruleId}`,
                        severity: this.mapESLintSeverity(message.severity),
                        message: message.message,
                        source: 'eslint',
                        location: {
                            file: document.uri.fsPath,
                            line: Math.max(0, message.line - 1), // ESLint is 1-based, VS Code is 0-based
                            column: Math.max(0, message.column - 1),
                            endLine: message.endLine ? Math.max(0, message.endLine - 1) : undefined,
                            endColumn: message.endColumn ? Math.max(0, message.endColumn - 1) : undefined
                        },
                        issueCode: message.ruleId || 'eslint-error',
                        category: this.getESLintCategory(message.ruleId || undefined)
                    };
                    
                    issues.push(issue);
                }
            }

            Logger.debug(`ESLint analysis found ${issues.length} issues`);
            return issues;
        } catch (error) {
            Logger.error(`ESLint analysis failed for ${document.fileName}`, error);
            return [];
        }
    }

    private async getESLintInstance(document: vscode.TextDocument): Promise<ESLint | null> {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            const cacheKey = workspaceFolder?.uri.fsPath || 'default';
            
            if (this.eslintCache.has(cacheKey)) {
                return this.eslintCache.get(cacheKey)!;
            }

            const eslintOptions: ESLint.Options = {
                baseConfig: {
                    rules: {
                        'no-console': 'warn',
                        'no-eval': 'error',
                        'no-var': 'warn',
                        'eqeqeq': 'warn'
                    }
                },
                cwd: workspaceFolder?.uri.fsPath || path.dirname(document.uri.fsPath)
            };

            // Try to create ESLint instance
            const eslint = new ESLint(eslintOptions);
            
            // Verify ESLint can handle this file
            const isPathIgnored = await eslint.isPathIgnored(document.uri.fsPath);
            if (isPathIgnored) {
                Logger.debug(`File ${document.fileName} is ignored by ESLint`);
                return null;
            }

            this.eslintCache.set(cacheKey, eslint);
            return eslint;
        } catch (error) {
            Logger.warn(`Failed to create ESLint instance: ${error}`);
            return null;
        }
    }

    private mapESLintSeverity(eslintSeverity: number): 'critical' | 'high' | 'medium' | 'low' {
        switch (eslintSeverity) {
            case 2: // Error
                return 'high';
            case 1: // Warning
                return 'medium';
            default:
                return 'low';
        }
    }

    private getESLintCategory(ruleId?: string): string {
        if (!ruleId) {return 'eslint';}
        
        // Categorize common ESLint rules
        const securityRules = ['no-eval', 'no-implied-eval', 'no-new-func', 'no-script-url'];
        const bestPracticeRules = ['no-console', 'no-debugger', 'no-alert'];
        const styleRules = ['semi', 'quotes', 'indent', 'comma-dangle'];
        const errorRules = ['no-undef', 'no-unused-vars', 'no-redeclare'];
        
        if (securityRules.includes(ruleId)) {return 'security';}
        if (bestPracticeRules.includes(ruleId)) {return 'best-practices';}
        if (styleRules.includes(ruleId)) {return 'style';}
        if (errorRules.includes(ruleId)) {return 'error';}
        
        return 'eslint';
    }

    dispose(): void {
        this.eslintCache.clear();
    }
}