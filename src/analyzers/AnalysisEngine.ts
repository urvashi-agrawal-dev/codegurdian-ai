import * as vscode from 'vscode';
import { CodeIssue } from '@codeguardian/shared';
import { IAnalyzer, AnalyzerResult } from './IAnalyzer';
import { PatternAnalyzer } from './PatternAnalyzer';
import { ESLintAnalyzer } from './ESLintAnalyzer';
import { TypeScriptAnalyzer } from './TypeScriptAnalyzer';
import { Logger } from '../utils/Logger';

export class AnalysisEngine {
    private analyzers: IAnalyzer[];
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.analyzers = [
            new PatternAnalyzer(),
            new ESLintAnalyzer(),
            new TypeScriptAnalyzer()
        ];
        
        this.config = vscode.workspace.getConfiguration('codeguardian');
        
        // Update config when it changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codeguardian')) {
                this.config = vscode.workspace.getConfiguration('codeguardian');
            }
        });
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<CodeIssue[]> {
        if (!this.shouldAnalyzeDocument(document)) {
            return [];
        }

        Logger.debug(`Starting unified analysis for ${document.fileName}`);
        
        const results: AnalyzerResult[] = [];
        const enabledAnalyzers = this.analyzers.filter(analyzer => 
            analyzer.isEnabled(this.config) && analyzer.canAnalyze(document)
        );

        // Run all analyzers
        const analyzerPromises = enabledAnalyzers.map(async (analyzer): Promise<AnalyzerResult> => {
            const startTime = Date.now();
            try {
                const issues = await analyzer.analyze(document);
                const duration = Date.now() - startTime;
                return { analyzer: analyzer.name, issues, duration };
            } catch (error) {
                const duration = Date.now() - startTime;
                Logger.error(`Analyzer ${analyzer.name} failed for ${document.fileName}`, error);
                return { 
                    analyzer: analyzer.name, 
                    issues: [], 
                    duration, 
                    error: error instanceof Error ? error : new Error(String(error))
                };
            }
        });

        const analyzerResults = await Promise.all(analyzerPromises);
        
        // Collect all issues
        const allIssues: CodeIssue[] = [];
        for (const result of analyzerResults) {
            allIssues.push(...result.issues);
            Logger.debug(`${result.analyzer} found ${result.issues.length} issues in ${result.duration}ms`);
        }

        // Deduplicate issues
        const deduplicatedIssues = this.deduplicateIssues(allIssues);
        
        Logger.debug(`Unified analysis complete: ${deduplicatedIssues.length} unique issues from ${allIssues.length} total`);
        return deduplicatedIssues;
    }

    private shouldAnalyzeDocument(document: vscode.TextDocument): boolean {
        // Don't analyze certain file types or locations
        if (document.uri.scheme !== 'file') {
            return false;
        }

        const fileName = document.fileName.toLowerCase();
        const excludedPaths = ['node_modules', '.git', 'dist', 'build', 'out'];
        
        if (excludedPaths.some(excluded => fileName.includes(excluded))) {
            return false;
        }

        // Only analyze supported file types
        const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx'];
        const hasValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
        
        return hasValidExtension;
    }

    private deduplicateIssues(issues: CodeIssue[]): CodeIssue[] {
        const seen = new Map<string, CodeIssue>();
        
        for (const issue of issues) {
            // Create a key based on location and message to identify duplicates
            const key = `${issue.location.file}:${issue.location.line}:${issue.location.column}:${issue.message}`;
            
            if (!seen.has(key)) {
                seen.set(key, issue);
            } else {
                // If we have a duplicate, prefer the one with more specific source
                const existing = seen.get(key)!;
                if (this.getAnalyzerPriority(issue.source) > this.getAnalyzerPriority(existing.source)) {
                    seen.set(key, issue);
                }
            }
        }
        
        return Array.from(seen.values());
    }

    private getAnalyzerPriority(source: string): number {
        // Higher number = higher priority
        const priorities: Record<string, number> = {
            'typescript': 3,
            'eslint': 2,
            'codeguardian-pattern': 1,
            'codeguardian-pattern-ts': 1
        };
        
        return priorities[source] || 0;
    }

    getAvailableAnalyzers(): string[] {
        return this.analyzers.map(a => a.name);
    }

    getEnabledAnalyzers(): string[] {
        return this.analyzers
            .filter(analyzer => analyzer.isEnabled(this.config))
            .map(a => a.name);
    }

    dispose(): void {
        for (const analyzer of this.analyzers) {
            if (analyzer.dispose) {
                analyzer.dispose();
            }
        }
    }
}