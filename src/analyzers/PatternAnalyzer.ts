import * as vscode from 'vscode';
import { CodeIssue } from '@codeguardian/shared';
import { IAnalyzer } from './IAnalyzer';
import { Logger } from '../utils/Logger';

export class PatternAnalyzer implements IAnalyzer {
    readonly name = 'pattern';
    readonly supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];

    isEnabled(config: vscode.WorkspaceConfiguration): boolean {
        return true; // Pattern analysis is always enabled
    }

    canAnalyze(document: vscode.TextDocument): boolean {
        return this.supportedLanguages.includes(document.languageId);
    }

    async analyze(document: vscode.TextDocument): Promise<CodeIssue[]> {
        Logger.debug(`Running pattern analysis on ${document.fileName}`);
        
        const issues: CodeIssue[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        // Basic static analysis patterns
        const patterns = [
            {
                regex: /console\.(log|error|warn|debug)\s*\(/g,
                severity: 'low' as const,
                message: 'Console statement found - consider using proper logging',
                category: 'best-practices',
                ruleId: 'no-console'
            },
            {
                regex: /==\s*null|!=\s*null/g,
                severity: 'medium' as const,
                message: 'Use strict equality (=== / !==) when comparing with null',
                category: 'potential-bug',
                ruleId: 'eqeqeq'
            },
            {
                regex: /var\s+/g,
                severity: 'low' as const,
                message: 'Use const or let instead of var',
                category: 'modern-javascript',
                ruleId: 'no-var'
            },
            {
                regex: /\.innerHTML\s*=/g,
                severity: 'high' as const,
                message: 'Direct innerHTML assignment may lead to XSS vulnerabilities',
                category: 'security',
                ruleId: 'no-inner-html'
            },
            {
                regex: /eval\s*\(/g,
                severity: 'critical' as const,
                message: 'Use of eval() is dangerous and should be avoided',
                category: 'security',
                ruleId: 'no-eval'
            },
            {
                regex: /\[\d+\]/g,
                severity: 'medium' as const,
                message: 'Array access without bounds checking - potential runtime error',
                category: 'potential-bug',
                ruleId: 'array-bounds-check'
            }
        ];

        // Check each line for patterns
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];
            
            for (const pattern of patterns) {
                let match;
                pattern.regex.lastIndex = 0; // Reset regex
                
                while ((match = pattern.regex.exec(line)) !== null) {
                    const issue: CodeIssue = {
                        id: `pattern-${document.uri.toString()}-${lineNumber}-${match.index}`,
                        severity: pattern.severity,
                        message: pattern.message,
                        source: 'codeguardian-pattern',
                        location: {
                            file: document.uri.fsPath,
                            line: lineNumber,
                            column: match.index,
                            endLine: lineNumber,
                            endColumn: match.index + match[0].length
                        },
                        issueCode: pattern.ruleId,
                        category: pattern.category
                    };
                    
                    issues.push(issue);
                }
            }
        }

        // Additional TypeScript-specific checks
        if (document.languageId === 'typescript' || document.languageId === 'typescriptreact') {
            issues.push(...this.analyzeTypeScriptPatterns(document, lines));
        }

        Logger.debug(`Pattern analysis found ${issues.length} issues`);
        return issues;
    }

    private analyzeTypeScriptPatterns(document: vscode.TextDocument, lines: string[]): CodeIssue[] {
        const issues: CodeIssue[] = [];

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];
            
            // Check for functions without return types
            const functionRegex = /function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*\{/;
            if (functionRegex.test(line) && !line.includes(': ')) {
                issues.push({
                    id: `pattern-${document.uri.toString()}-${lineNumber}-return-type`,
                    severity: 'medium',
                    message: 'Function missing return type annotation',
                    source: 'codeguardian-pattern-ts',
                    location: {
                        file: document.uri.fsPath,
                        line: lineNumber,
                        column: 0,
                        endLine: lineNumber,
                        endColumn: line.length
                    },
                    issueCode: 'missing-return-type',
                    category: 'typescript'
                });
            }

            // Check for any types
            if (line.includes(': any') || line.includes('<any>')) {
                const match = line.indexOf(': any') !== -1 ? line.indexOf(': any') : line.indexOf('<any>');
                issues.push({
                    id: `pattern-${document.uri.toString()}-${lineNumber}-any-type`,
                    severity: 'medium',
                    message: 'Avoid using "any" type - use specific types instead',
                    source: 'codeguardian-pattern-ts',
                    location: {
                        file: document.uri.fsPath,
                        line: lineNumber,
                        column: match,
                        endLine: lineNumber,
                        endColumn: match + 5
                    },
                    issueCode: 'any-type',
                    category: 'typescript'
                });
            }
        }

        return issues;
    }
}