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
exports.CodeGuardianCodeActionsProvider = void 0;
const vscode = __importStar(require("vscode"));
class CodeGuardianCodeActionsProvider {
    constructor(diagnosticsProvider) {
        this.diagnosticsProvider = diagnosticsProvider;
    }
    provideCodeActions(document, range, context, token) {
        const actions = [];
        // Look for CodeGuardian diagnostics in the range
        const codeGuardianDiagnostics = context.diagnostics.filter(diagnostic => diagnostic.source === 'CodeGuardian AI');
        for (const diagnostic of codeGuardianDiagnostics) {
            // Get the corresponding CodeGuardian issue
            const issue = this.getIssueForDiagnostic(document, diagnostic);
            if (issue) {
                actions.push(...this.createActionsForIssue(document, issue, diagnostic));
            }
        }
        return actions;
    }
    getIssueForDiagnostic(document, diagnostic) {
        if (!this.diagnosticsProvider?.getIssuesForDocument) {
            return undefined;
        }
        const issues = this.diagnosticsProvider.getIssuesForDocument(document.uri);
        return issues.find((issue) => issue.location.line === diagnostic.range.start.line &&
            issue.location.column === diagnostic.range.start.character &&
            issue.message === diagnostic.message);
    }
    createActionsForIssue(document, issue, diagnostic) {
        const actions = [];
        // Explain Issue Action
        const explainAction = new vscode.CodeAction('Explain with CodeGuardian', vscode.CodeActionKind.QuickFix);
        explainAction.command = {
            command: 'codeguardian.explainIssueAtPosition',
            title: 'Explain Issue',
            arguments: [document.uri, diagnostic.range.start, issue]
        };
        explainAction.diagnostics = [diagnostic];
        explainAction.isPreferred = true;
        actions.push(explainAction);
        // Fix Issue Action (placeholder for Phase 3)
        const fixAction = new vscode.CodeAction('Fix with CodeGuardian', vscode.CodeActionKind.QuickFix);
        fixAction.command = {
            command: 'codeguardian.fixIssueAtPosition',
            title: 'Fix Issue',
            arguments: [document.uri, diagnostic.range.start, issue]
        };
        fixAction.diagnostics = [diagnostic];
        actions.push(fixAction);
        // Generate Tests Action (for functions)
        if (this.isFunctionRelated(issue)) {
            const testAction = new vscode.CodeAction('Generate Tests', vscode.CodeActionKind.Refactor);
            testAction.command = {
                command: 'codeguardian.generateTestsAtPosition',
                title: 'Generate Tests',
                arguments: [document.uri, diagnostic.range.start, issue]
            };
            actions.push(testAction);
        }
        return actions;
    }
    isFunctionRelated(issue) {
        const functionCategories = ['typescript', 'function-signature', 'missing-return-type'];
        return functionCategories.includes(issue.category || '') ||
            Boolean(issue.issueCode && ['missing-return-type', 'unused-variable'].includes(issue.issueCode));
    }
}
exports.CodeGuardianCodeActionsProvider = CodeGuardianCodeActionsProvider;
CodeGuardianCodeActionsProvider.providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor
];
//# sourceMappingURL=CodeGuardianCodeActionsProvider.js.map