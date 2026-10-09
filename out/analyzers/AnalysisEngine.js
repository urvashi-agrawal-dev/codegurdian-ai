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
exports.AnalysisEngine = void 0;
const vscode = __importStar(require("vscode"));
const PatternAnalyzer_1 = require("./PatternAnalyzer");
const ESLintAnalyzer_1 = require("./ESLintAnalyzer");
const TypeScriptAnalyzer_1 = require("./TypeScriptAnalyzer");
const Logger_1 = require("../utils/Logger");
class AnalysisEngine {
    constructor() {
        this.analyzers = [
            new PatternAnalyzer_1.PatternAnalyzer(),
            new ESLintAnalyzer_1.ESLintAnalyzer(),
            new TypeScriptAnalyzer_1.TypeScriptAnalyzer()
        ];
        this.config = vscode.workspace.getConfiguration('codeguardian');
        // Update config when it changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codeguardian')) {
                this.config = vscode.workspace.getConfiguration('codeguardian');
            }
        });
    }
    async analyzeDocument(document) {
        if (!this.shouldAnalyzeDocument(document)) {
            return [];
        }
        Logger_1.Logger.debug(`Starting unified analysis for ${document.fileName}`);
        const results = [];
        const enabledAnalyzers = this.analyzers.filter(analyzer => analyzer.isEnabled(this.config) && analyzer.canAnalyze(document));
        // Run all analyzers
        const analyzerPromises = enabledAnalyzers.map(async (analyzer) => {
            const startTime = Date.now();
            try {
                const issues = await analyzer.analyze(document);
                const duration = Date.now() - startTime;
                return { analyzer: analyzer.name, issues, duration };
            }
            catch (error) {
                const duration = Date.now() - startTime;
                Logger_1.Logger.error(`Analyzer ${analyzer.name} failed for ${document.fileName}`, error);
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
        const allIssues = [];
        for (const result of analyzerResults) {
            allIssues.push(...result.issues);
            Logger_1.Logger.debug(`${result.analyzer} found ${result.issues.length} issues in ${result.duration}ms`);
        }
        // Deduplicate issues
        const deduplicatedIssues = this.deduplicateIssues(allIssues);
        Logger_1.Logger.debug(`Unified analysis complete: ${deduplicatedIssues.length} unique issues from ${allIssues.length} total`);
        return deduplicatedIssues;
    }
    shouldAnalyzeDocument(document) {
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
    deduplicateIssues(issues) {
        const seen = new Map();
        for (const issue of issues) {
            // Create a key based on location and message to identify duplicates
            const key = `${issue.location.file}:${issue.location.line}:${issue.location.column}:${issue.message}`;
            if (!seen.has(key)) {
                seen.set(key, issue);
            }
            else {
                // If we have a duplicate, prefer the one with more specific source
                const existing = seen.get(key);
                if (this.getAnalyzerPriority(issue.source) > this.getAnalyzerPriority(existing.source)) {
                    seen.set(key, issue);
                }
            }
        }
        return Array.from(seen.values());
    }
    getAnalyzerPriority(source) {
        // Higher number = higher priority
        const priorities = {
            'typescript': 3,
            'eslint': 2,
            'codeguardian-pattern': 1,
            'codeguardian-pattern-ts': 1
        };
        return priorities[source] || 0;
    }
    getAvailableAnalyzers() {
        return this.analyzers.map(a => a.name);
    }
    getEnabledAnalyzers() {
        return this.analyzers
            .filter(analyzer => analyzer.isEnabled(this.config))
            .map(a => a.name);
    }
    dispose() {
        for (const analyzer of this.analyzers) {
            if (analyzer.dispose) {
                analyzer.dispose();
            }
        }
    }
}
exports.AnalysisEngine = AnalysisEngine;
//# sourceMappingURL=AnalysisEngine.js.map