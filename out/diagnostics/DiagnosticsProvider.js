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
exports.DiagnosticsProvider = void 0;
const vscode = __importStar(require("vscode"));
const Logger_1 = require("../utils/Logger");
const AnalysisEngine_1 = require("../analyzers/AnalysisEngine");
class DiagnosticsProvider {
    constructor() {
        this.issuesMap = new Map();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('codeguardian');
        this.analysisEngine = new AnalysisEngine_1.AnalysisEngine();
    }
    getDiagnosticCollection() {
        return this.diagnosticCollection;
    }
    async analyzeDocument(document) {
        try {
            Logger_1.Logger.debug(`Analyzing document: ${document.uri.fsPath}`);
            const issues = await this.analysisEngine.analyzeDocument(document);
            this.issuesMap.set(document.uri.toString(), issues);
            const diagnostics = issues.map(issue => this.createDiagnostic(issue));
            this.diagnosticCollection.set(document.uri, diagnostics);
            Logger_1.Logger.debug(`Found ${issues.length} issues in ${document.fileName}`);
        }
        catch (error) {
            Logger_1.Logger.error('Failed to analyze document', error);
        }
    }
    getIssuesForDocument(uri) {
        return this.issuesMap.get(uri.toString()) || [];
    }
    getIssueAtPosition(uri, position) {
        const issues = this.getIssuesForDocument(uri);
        return issues.find(issue => issue.location.line === position.line &&
            issue.location.column <= position.character &&
            (issue.location.endColumn ?? issue.location.column + 1) > position.character);
    }
    createDiagnostic(issue) {
        const range = new vscode.Range(new vscode.Position(issue.location.line, issue.location.column), new vscode.Position(issue.location.endLine ?? issue.location.line, issue.location.endColumn ?? issue.location.column + 1));
        const diagnostic = new vscode.Diagnostic(range, issue.message, this.mapSeverity(issue.severity));
        diagnostic.source = 'CodeGuardian AI';
        diagnostic.code = issue.issueCode;
        diagnostic.tags = this.getDiagnosticTags(issue.category);
        return diagnostic;
    }
    mapSeverity(severity) {
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
    getDiagnosticTags(category) {
        const tags = [];
        if (category === 'deprecated' || category === 'modern-javascript') {
            tags.push(vscode.DiagnosticTag.Deprecated);
        }
        return tags;
    }
    dispose() {
        this.diagnosticCollection.dispose();
        this.analysisEngine.dispose();
        this.issuesMap.clear();
    }
}
exports.DiagnosticsProvider = DiagnosticsProvider;
//# sourceMappingURL=DiagnosticsProvider.js.map