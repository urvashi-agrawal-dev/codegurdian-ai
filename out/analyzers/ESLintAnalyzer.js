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
exports.ESLintAnalyzer = void 0;
const vscode = __importStar(require("vscode"));
const eslint_1 = require("eslint");
const Logger_1 = require("../utils/Logger");
const path = __importStar(require("path"));
class ESLintAnalyzer {
    constructor() {
        this.name = 'eslint';
        this.supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
        this.eslintCache = new Map();
    }
    isEnabled(config) {
        return config.get('codeguardian.analysis.eslint.enabled', true);
    }
    canAnalyze(document) {
        return this.supportedLanguages.includes(document.languageId);
    }
    async analyze(document) {
        if (!this.canAnalyze(document)) {
            return [];
        }
        try {
            Logger_1.Logger.debug(`Running ESLint analysis on ${document.fileName}`);
            const eslint = await this.getESLintInstance(document);
            if (!eslint) {
                Logger_1.Logger.debug('ESLint not available for this file');
                return [];
            }
            const text = document.getText();
            const results = await eslint.lintText(text, {
                filePath: document.uri.fsPath
            });
            const issues = [];
            for (const result of results) {
                for (const message of result.messages) {
                    const issue = {
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
            Logger_1.Logger.debug(`ESLint analysis found ${issues.length} issues`);
            return issues;
        }
        catch (error) {
            Logger_1.Logger.error(`ESLint analysis failed for ${document.fileName}`, error);
            return [];
        }
    }
    async getESLintInstance(document) {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            const cacheKey = workspaceFolder?.uri.fsPath || 'default';
            if (this.eslintCache.has(cacheKey)) {
                return this.eslintCache.get(cacheKey);
            }
            const eslintOptions = {
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
            const eslint = new eslint_1.ESLint(eslintOptions);
            // Verify ESLint can handle this file
            const isPathIgnored = await eslint.isPathIgnored(document.uri.fsPath);
            if (isPathIgnored) {
                Logger_1.Logger.debug(`File ${document.fileName} is ignored by ESLint`);
                return null;
            }
            this.eslintCache.set(cacheKey, eslint);
            return eslint;
        }
        catch (error) {
            Logger_1.Logger.warn(`Failed to create ESLint instance: ${error}`);
            return null;
        }
    }
    mapESLintSeverity(eslintSeverity) {
        switch (eslintSeverity) {
            case 2: // Error
                return 'high';
            case 1: // Warning
                return 'medium';
            default:
                return 'low';
        }
    }
    getESLintCategory(ruleId) {
        if (!ruleId) {
            return 'eslint';
        }
        // Categorize common ESLint rules
        const securityRules = ['no-eval', 'no-implied-eval', 'no-new-func', 'no-script-url'];
        const bestPracticeRules = ['no-console', 'no-debugger', 'no-alert'];
        const styleRules = ['semi', 'quotes', 'indent', 'comma-dangle'];
        const errorRules = ['no-undef', 'no-unused-vars', 'no-redeclare'];
        if (securityRules.includes(ruleId)) {
            return 'security';
        }
        if (bestPracticeRules.includes(ruleId)) {
            return 'best-practices';
        }
        if (styleRules.includes(ruleId)) {
            return 'style';
        }
        if (errorRules.includes(ruleId)) {
            return 'error';
        }
        return 'eslint';
    }
    dispose() {
        this.eslintCache.clear();
    }
}
exports.ESLintAnalyzer = ESLintAnalyzer;
//# sourceMappingURL=ESLintAnalyzer.js.map