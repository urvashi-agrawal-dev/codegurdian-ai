import * as vscode from 'vscode';
import * as path from 'path';
import { CodeContext, CodeIssue } from '@codeguardian/shared';
import { Logger } from '../utils/Logger';

export class ContextCollector {
    
    async collectContext(
        document: vscode.TextDocument,
        selection?: vscode.Selection,
        issue?: CodeIssue
    ): Promise<CodeContext> {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            const relativePath = workspaceFolder 
                ? path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
                : document.uri.fsPath;

            const codeText = selection 
                ? document.getText(selection)
                : document.getText();

            const context: CodeContext = {
                language: document.languageId,
                file: relativePath,
                code: codeText,
                relevantContext: await this.getRelevantContext(document, selection),
                projectStructure: await this.getProjectStructure(workspaceFolder),
                imports: this.extractImports(document),
                symbols: this.extractSymbols(document, selection)
            };

            if (issue) {
                context.error = {
                    message: issue.message,
                    line: issue.location.line,
                    column: issue.location.column
                };
            }

            return context;
        } catch (error) {
            Logger.error('Failed to collect context', error);
            throw error;
        }
    }

    private async getRelevantContext(
        document: vscode.TextDocument,
        selection?: vscode.Selection
    ): Promise<string[]> {
        const context: string[] = [];
        
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return context;
            }

            // Get related files based on imports
            const imports = this.extractImports(document);
            for (const importPath of imports) {
                const resolvedPath = await this.resolveImportPath(importPath, document.uri, workspaceFolder);
                if (resolvedPath) {
                    const fileContent = await this.getFileContent(resolvedPath);
                    if (fileContent) {
                        context.push(`File: ${path.relative(workspaceFolder.uri.fsPath, resolvedPath)}\n${fileContent}`);
                    }
                }
            }

            return context.slice(0, 5); // Limit to 5 related files
        } catch (error) {
            Logger.warn('Failed to get relevant context', error);
            return context;
        }
    }

    private async getProjectStructure(workspaceFolder?: vscode.WorkspaceFolder): Promise<string[]> {
        if (!workspaceFolder) {
            return [];
        }

        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(workspaceFolder, '**/*.{js,ts,jsx,tsx,json}'),
                new vscode.RelativePattern(workspaceFolder, '{node_modules,dist,build,out}/**'),
                50 // Limit to 50 files
            );

            return files.map(uri => 
                path.relative(workspaceFolder.uri.fsPath, uri.fsPath)
            ).sort();
        } catch (error) {
            Logger.warn('Failed to get project structure', error);
            return [];
        }
    }

    private extractImports(document: vscode.TextDocument): string[] {
        const imports: string[] = [];
        const text = document.getText();
        
        // Match import statements
        const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"];?/g;
        let match;
        
        while ((match = importRegex.exec(text)) !== null) {
            imports.push(match[1]);
        }

        // Match require statements
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        while ((match = requireRegex.exec(text)) !== null) {
            imports.push(match[1]);
        }

        return [...new Set(imports)]; // Remove duplicates
    }

    private extractSymbols(document: vscode.TextDocument, selection?: vscode.Selection): string[] {
        const symbols: string[] = [];
        const text = selection ? document.getText(selection) : document.getText();
        
        // Extract function names
        const functionRegex = /(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|\()/g;
        let match;
        
        while ((match = functionRegex.exec(text)) !== null) {
            symbols.push(match[1]);
        }

        // Extract class names
        const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = classRegex.exec(text)) !== null) {
            symbols.push(match[1]);
        }

        // Extract interface/type names
        const typeRegex = /(?:interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        while ((match = typeRegex.exec(text)) !== null) {
            symbols.push(match[1]);
        }

        return [...new Set(symbols)];
    }

    private async resolveImportPath(
        importPath: string,
        currentFile: vscode.Uri,
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<string | null> {
        try {
            // Skip node_modules imports
            if (!importPath.startsWith('.')) {
                return null;
            }

            const currentDir = path.dirname(currentFile.fsPath);
            let resolvedPath = path.resolve(currentDir, importPath);

            // Try different extensions
            const extensions = ['.ts', '.js', '.tsx', '.jsx'];
            for (const ext of extensions) {
                const pathWithExt = resolvedPath + ext;
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(pathWithExt));
                    return pathWithExt;
                } catch {
                    // File doesn't exist, try next extension
                }
            }

            // Try index files
            for (const ext of extensions) {
                const indexPath = path.join(resolvedPath, 'index' + ext);
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(indexPath));
                    return indexPath;
                } catch {
                    // File doesn't exist, try next
                }
            }

            return null;
        } catch (error) {
            Logger.warn(`Failed to resolve import path: ${importPath}`, error);
            return null;
        }
    }

    private async getFileContent(filePath: string): Promise<string | null> {
        try {
            const uri = vscode.Uri.file(filePath);
            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(fileBytes).toString('utf8');
            
            // Limit file size to prevent excessive context
            return content.length > 2000 ? content.substring(0, 2000) + '\n// ... (truncated)' : content;
        } catch (error) {
            Logger.warn(`Failed to read file: ${filePath}`, error);
            return null;
        }
    }
}