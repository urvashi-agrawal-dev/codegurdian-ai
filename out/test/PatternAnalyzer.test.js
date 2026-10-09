"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const PatternAnalyzer_1 = require("../analyzers/PatternAnalyzer");
// Mock VS Code
const mockDocument = {
    languageId: 'javascript',
    fileName: 'test.js',
    uri: { fsPath: '/test/test.js' },
    getText: () => ''
};
(0, vitest_1.describe)('PatternAnalyzer', () => {
    let analyzer;
    (0, vitest_1.beforeEach)(() => {
        analyzer = new PatternAnalyzer_1.PatternAnalyzer();
    });
    (0, vitest_1.describe)('canAnalyze', () => {
        (0, vitest_1.it)('should support JavaScript files', () => {
            const doc = { ...mockDocument, languageId: 'javascript' };
            (0, vitest_1.expect)(analyzer.canAnalyze(doc)).toBe(true);
        });
        (0, vitest_1.it)('should support TypeScript files', () => {
            const doc = { ...mockDocument, languageId: 'typescript' };
            (0, vitest_1.expect)(analyzer.canAnalyze(doc)).toBe(true);
        });
        (0, vitest_1.it)('should not support unsupported file types', () => {
            const doc = { ...mockDocument, languageId: 'python' };
            (0, vitest_1.expect)(analyzer.canAnalyze(doc)).toBe(false);
        });
    });
    (0, vitest_1.describe)('analyze', () => {
        (0, vitest_1.it)('should detect console statements', async () => {
            const doc = {
                ...mockDocument,
                getText: () => 'console.log("test");'
            };
            const issues = await analyzer.analyze(doc);
            (0, vitest_1.expect)(issues).toHaveLength(1);
            (0, vitest_1.expect)(issues[0].message).toContain('Console statement found');
            (0, vitest_1.expect)(issues[0].severity).toBe('low');
            (0, vitest_1.expect)(issues[0].issueCode).toBe('no-console');
        });
        (0, vitest_1.it)('should detect eval usage', async () => {
            const doc = {
                ...mockDocument,
                getText: () => 'var result = eval("2 + 2");'
            };
            const issues = await analyzer.analyze(doc);
            (0, vitest_1.expect)(issues).toHaveLength(2); // eval + var
            const evalIssue = issues.find(i => i.issueCode === 'no-eval');
            (0, vitest_1.expect)(evalIssue).toBeDefined();
            (0, vitest_1.expect)(evalIssue.severity).toBe('critical');
        });
        (0, vitest_1.it)('should detect var usage', async () => {
            const doc = {
                ...mockDocument,
                getText: () => 'var oldStyle = "test";'
            };
            const issues = await analyzer.analyze(doc);
            (0, vitest_1.expect)(issues).toHaveLength(1);
            (0, vitest_1.expect)(issues[0].message).toContain('Use const or let instead of var');
            (0, vitest_1.expect)(issues[0].severity).toBe('low');
        });
        (0, vitest_1.it)('should detect loose equality', async () => {
            const doc = {
                ...mockDocument,
                getText: () => 'if (user == null) { return; }'
            };
            const issues = await analyzer.analyze(doc);
            (0, vitest_1.expect)(issues).toHaveLength(1);
            (0, vitest_1.expect)(issues[0].message).toContain('Use strict equality');
            (0, vitest_1.expect)(issues[0].severity).toBe('medium');
        });
        (0, vitest_1.it)('should detect innerHTML usage', async () => {
            const doc = {
                ...mockDocument,
                getText: () => 'element.innerHTML = userInput;'
            };
            const issues = await analyzer.analyze(doc);
            (0, vitest_1.expect)(issues).toHaveLength(1);
            (0, vitest_1.expect)(issues[0].message).toContain('innerHTML assignment may lead to XSS');
            (0, vitest_1.expect)(issues[0].severity).toBe('high');
        });
        (0, vitest_1.it)('should handle TypeScript-specific patterns', async () => {
            const doc = {
                ...mockDocument,
                languageId: 'typescript',
                getText: () => `
          function test() {
            return 42;
          }
          
          let value: any = "test";
        `
            };
            const issues = await analyzer.analyze(doc);
            (0, vitest_1.expect)(issues.length).toBeGreaterThan(0);
            const anyTypeIssue = issues.find(i => i.issueCode === 'any-type');
            (0, vitest_1.expect)(anyTypeIssue).toBeDefined();
        });
    });
});
//# sourceMappingURL=PatternAnalyzer.test.js.map