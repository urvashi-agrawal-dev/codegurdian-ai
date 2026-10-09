import * as vscode from 'vscode';
import * as ts from 'typescript';
import { CodeIssue } from '@codeguardian/shared';
import { IAnalyzer } from './IAnalyzer';
import { Logger } from '../utils/Logger';
import * as path from 'path';

export class TypeScriptAnalyzer implements IAnalyzer {
    readonly name = 'typescript';
    readonly supportedLanguages = ['typescript', 'typescriptreact'];
    
    private compilerCache = new Map<string, ts.Program>();

    isEnabled(config: vscode.WorkspaceConfiguration): boolean {
        return config.get('codeguardian.analysis.typescript.enabled', true);
    }

    canAnalyze(document: vscode.TextDocument): boolean {
        return this.supportedLanguages.includes(document.languageId);
    }

    async analyze(document: vscode.TextDocument): Promise<CodeIssue[]> {
        if (!this.canAnalyze(document)) {
            return [];
        }

        try {
            Logger.debug(`Running TypeScript analysis on ${document.fileName}`);
            
            const program = await this.getTypeScriptProgram(document);
            if (!program) {
                Logger.debug('TypeScript program not available for this file');
                return [];
            }

            const sourceFile = program.getSourceFile(document.uri.fsPath);
            if (!sourceFile) {
                Logger.debug('Could not get TypeScript source file');
                return [];
            }

            const issues: CodeIssue[] = [];
            
            // Get TypeScript diagnostics
            const diagnostics = [
                ...program.getSemanticDiagnostics(sourceFile),
                ...program.getSyntacticDiagnostics(sourceFile)
            ];

            for (const diagnostic of diagnostics) {
                if (diagnostic.file && diagnostic.start !== undefined) {
                    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    const endPosition = diagnostic.start + (diagnostic.length || 0);
                    const endLineChar = diagnostic.file.getLineAndCharacterOfPosition(endPosition);
                    
                    const issue: CodeIssue = {
                        id: `typescript-${document.uri.toString()}-${position.line}-${position.character}-${diagnostic.code}`,
                        severity: this.mapTypeScriptSeverity(diagnostic.category),
                        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                        source: 'typescript',
                        location: {
                            file: document.uri.fsPath,
                            line: position.line,
                            column: position.character,
                            endLine: endLineChar.line,
                            endColumn: endLineChar.character
                        },
                        issueCode: `TS${diagnostic.code}`,
                        category: this.getTypeScriptCategory(diagnostic.code)
                    };
                    
                    issues.push(issue);
                }
            }

            // Add semantic analysis for additional issues
            const semanticIssues = this.performSemanticAnalysis(sourceFile, program);
            issues.push(...semanticIssues);

            Logger.debug(`TypeScript analysis found ${issues.length} issues`);
            return issues;
        } catch (error) {
            Logger.error(`TypeScript analysis failed for ${document.fileName}`, error);
            return [];
        }
    }

    private async getTypeScriptProgram(document: vscode.TextDocument): Promise<ts.Program | null> {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return null;
            }

            const cacheKey = workspaceFolder.uri.fsPath;
            if (this.compilerCache.has(cacheKey)) {
                return this.compilerCache.get(cacheKey)!;
            }

            // Look for tsconfig.json
            const tsconfigPath = await this.findTsConfig(workspaceFolder.uri.fsPath);
            if (!tsconfigPath) {
                Logger.debug('No tsconfig.json found, using default TypeScript options');
                return this.createDefaultProgram(document);
            }

            const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
            if (configFile.error) {
                Logger.warn(`Error reading tsconfig.json: ${configFile.error.messageText}`);
                return this.createDefaultProgram(document);
            }

            const parsedConfig = ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                path.dirname(tsconfigPath)
            );

            if (parsedConfig.errors.length > 0) {
                Logger.warn(`TypeScript config errors: ${parsedConfig.errors.map(e => e.messageText).join(', ')}`);
            }

            const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
            this.compilerCache.set(cacheKey, program);
            
            return program;
        } catch (error) {
            Logger.warn(`Failed to create TypeScript program: ${error}`);
            return this.createDefaultProgram(document);
        }
    }

    private async findTsConfig(startPath: string): Promise<string | null> {
        let currentPath = startPath;
        
        while (currentPath !== path.dirname(currentPath)) {
            const tsconfigPath = path.join(currentPath, 'tsconfig.json');
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(tsconfigPath));
                return tsconfigPath;
            } catch {
                // File doesn't exist, continue searching
            }
            currentPath = path.dirname(currentPath);
        }
        
        return null;
    }

    private createDefaultProgram(document: vscode.TextDocument): ts.Program {
        const compilerOptions: ts.CompilerOptions = {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            allowJs: true,
            checkJs: false
        };

        return ts.createProgram([document.uri.fsPath], compilerOptions);
    }

    private performSemanticAnalysis(sourceFile: ts.SourceFile, program: ts.Program): CodeIssue[] {
        const issues: CodeIssue[] = [];
        const typeChecker = program.getTypeChecker();

        const visit = (node: ts.Node) => {
            // Check for missing return types on functions
            if (ts.isFunctionDeclaration(node) && node.name && !node.type) {
                const position = sourceFile.getLineAndCharacterOfPosition(node.name.pos);
                issues.push({
                    id: `typescript-semantic-${sourceFile.fileName}-${position.line}-${position.character}-missing-return-type`,
                    severity: 'medium',
                    message: `Function '${node.name.text}' should have an explicit return type`,
                    source: 'typescript-semantic',
                    location: {
                        file: sourceFile.fileName,
                        line: position.line,
                        column: position.character,
                        endLine: position.line,
                        endColumn: position.character + node.name.text.length
                    },
                    issueCode: 'missing-return-type',
                    category: 'typescript'
                });
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return issues;
    }

    private mapTypeScriptSeverity(category: ts.DiagnosticCategory): 'critical' | 'high' | 'medium' | 'low' {
        switch (category) {
            case ts.DiagnosticCategory.Error:
                return 'high';
            case ts.DiagnosticCategory.Warning:
                return 'medium';
            case ts.DiagnosticCategory.Suggestion:
                return 'low';
            case ts.DiagnosticCategory.Message:
                return 'low';
            default:
                return 'medium';
        }
    }

    private getTypeScriptCategory(code: number): string {
        // Common TypeScript error categorization
        const typeErrors = [2322, 2339, 2345, 2554]; // Type assignment, property access, argument errors
        const moduleErrors = [2307, 2305, 2304]; // Module resolution errors
        const syntaxErrors = [1005, 1009, 1014]; // Syntax errors
        
        if (typeErrors.includes(code)) {return 'type-error';}
        if (moduleErrors.includes(code)) {return 'module-error';}
        if (syntaxErrors.includes(code)) {return 'syntax-error';}
        
        return 'typescript';
    }

    dispose(): void {
        this.compilerCache.clear();
    }
}