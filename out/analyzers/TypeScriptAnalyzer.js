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
exports.TypeScriptAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const ts = __importStar(require("typescript"));
const Logger_1 = require("../utils/Logger");
const path = __importStar(require("path"));
class TypeScriptAnalyzer {
    constructor() {
        this.name = 'typescript';
        this.supportedLanguages = ['typescript', 'typescriptreact'];
        this.compilerCache = new Map();
    }
    isEnabled(config) {
        return config.get('codeguardian.analysis.typescript.enabled', true);
    }
    canAnalyze(document) {
        return this.supportedLanguages.includes(document.languageId);
    }
    async analyze(document) {
        if (!this.canAnalyze(document)) {
            return [];
        }
        try {
            Logger_1.Logger.debug(`Running TypeScript analysis on ${document.fileName}`);
            const program = await this.getTypeScriptProgram(document);
            if (!program) {
                Logger_1.Logger.debug('TypeScript program not available for this file');
                return [];
            }
            const sourceFile = program.getSourceFile(document.uri.fsPath);
            if (!sourceFile) {
                Logger_1.Logger.debug('Could not get TypeScript source file');
                return [];
            }
            const issues = [];
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
                    const issue = {
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
            Logger_1.Logger.debug(`TypeScript analysis found ${issues.length} issues`);
            return issues;
        }
        catch (error) {
            Logger_1.Logger.error(`TypeScript analysis failed for ${document.fileName}`, error);
            return [];
        }
    }
    async getTypeScriptProgram(document) {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return null;
            }
            const cacheKey = workspaceFolder.uri.fsPath;
            if (this.compilerCache.has(cacheKey)) {
                return this.compilerCache.get(cacheKey);
            }
            // Look for tsconfig.json
            const tsconfigPath = await this.findTsConfig(workspaceFolder.uri.fsPath);
            if (!tsconfigPath) {
                Logger_1.Logger.debug('No tsconfig.json found, using default TypeScript options');
                return this.createDefaultProgram(document);
            }
            const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
            if (configFile.error) {
                Logger_1.Logger.warn(`Error reading tsconfig.json: ${configFile.error.messageText}`);
                return this.createDefaultProgram(document);
            }
            const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));
            if (parsedConfig.errors.length > 0) {
                Logger_1.Logger.warn(`TypeScript config errors: ${parsedConfig.errors.map(e => e.messageText).join(', ')}`);
            }
            const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
            this.compilerCache.set(cacheKey, program);
            return program;
        }
        catch (error) {
            Logger_1.Logger.warn(`Failed to create TypeScript program: ${error}`);
            return this.createDefaultProgram(document);
        }
    }
    async findTsConfig(startPath) {
        let currentPath = startPath;
        while (currentPath !== path.dirname(currentPath)) {
            const tsconfigPath = path.join(currentPath, 'tsconfig.json');
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(tsconfigPath));
                return tsconfigPath;
            }
            catch {
                // File doesn't exist, continue searching
            }
            currentPath = path.dirname(currentPath);
        }
        return null;
    }
    createDefaultProgram(document) {
        const compilerOptions = {
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
    performSemanticAnalysis(sourceFile, program) {
        const issues = [];
        const typeChecker = program.getTypeChecker();
        const visit = (node) => {
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
    mapTypeScriptSeverity(category) {
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
    getTypeScriptCategory(code) {
        // Common TypeScript error categorization
        const typeErrors = [2322, 2339, 2345, 2554]; // Type assignment, property access, argument errors
        const moduleErrors = [2307, 2305, 2304]; // Module resolution errors
        const syntaxErrors = [1005, 1009, 1014]; // Syntax errors
        if (typeErrors.includes(code)) {
            return 'type-error';
        }
        if (moduleErrors.includes(code)) {
            return 'module-error';
        }
        if (syntaxErrors.includes(code)) {
            return 'syntax-error';
        }
        return 'typescript';
    }
    dispose() {
        this.compilerCache.clear();
    }
}
exports.TypeScriptAnalyzer = TypeScriptAnalyzer;
//# sourceMappingURL=TypeScriptAnalyzer.js.map