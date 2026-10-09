"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const AnalysisEngine_1 = require("../analyzers/AnalysisEngine");
// Mock VS Code workspace configuration
const mockConfig = {
    get: vitest_1.vi.fn((key, defaultValue) => {
        switch (key) {
            case 'codeguardian.analysis.eslint.enabled':
                return true;
            case 'codeguardian.analysis.typescript.enabled':
                return true;
            default:
                return defaultValue;
        }
    })
};
vitest_1.vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vitest_1.vi.fn(() => mockConfig),
        onDidChangeConfiguration: vitest_1.vi.fn()
    }
}));
const mockDocument = {
    languageId: 'javascript',
    fileName: 'test.js',
    uri: {
        fsPath: '/test/test.js',
        scheme: 'file'
    },
    getText: () => 'console.log("test");'
};
(0, vitest_1.describe)('AnalysisEngine', () => {
    let engine;
    (0, vitest_1.beforeEach)(() => {
        engine = new AnalysisEngine_1.AnalysisEngine();
    });
    (0, vitest_1.describe)('analyzeDocument', () => {
        (0, vitest_1.it)('should analyze supported documents', async () => {
            const issues = await engine.analyzeDocument(mockDocument);
            (0, vitest_1.expect)(Array.isArray(issues)).toBe(true);
            // Should find at least one issue from pattern analyzer
            (0, vitest_1.expect)(issues.length).toBeGreaterThanOrEqual(1);
        });
        (0, vitest_1.it)('should return empty array for unsupported documents', async () => {
            const unsupportedDoc = {
                ...mockDocument,
                uri: { fsPath: '/test/test.py', scheme: 'file' },
                fileName: 'test.py'
            };
            const issues = await engine.analyzeDocument(unsupportedDoc);
            (0, vitest_1.expect)(issues).toHaveLength(0);
        });
        (0, vitest_1.it)('should return empty array for non-file scheme', async () => {
            const gitDoc = {
                ...mockDocument,
                uri: { fsPath: '/test/test.js', scheme: 'git' }
            };
            const issues = await engine.analyzeDocument(gitDoc);
            (0, vitest_1.expect)(issues).toHaveLength(0);
        });
        (0, vitest_1.it)('should exclude node_modules files', async () => {
            const nodeModulesDoc = {
                ...mockDocument,
                fileName: '/project/node_modules/lib/file.js',
                uri: { fsPath: '/project/node_modules/lib/file.js', scheme: 'file' }
            };
            const issues = await engine.analyzeDocument(nodeModulesDoc);
            (0, vitest_1.expect)(issues).toHaveLength(0);
        });
    });
    (0, vitest_1.describe)('getAvailableAnalyzers', () => {
        (0, vitest_1.it)('should return list of available analyzers', () => {
            const analyzers = engine.getAvailableAnalyzers();
            (0, vitest_1.expect)(analyzers).toContain('pattern');
            (0, vitest_1.expect)(analyzers).toContain('eslint');
            (0, vitest_1.expect)(analyzers).toContain('typescript');
        });
    });
    (0, vitest_1.describe)('getEnabledAnalyzers', () => {
        (0, vitest_1.it)('should return enabled analyzers based on configuration', () => {
            const enabled = engine.getEnabledAnalyzers();
            (0, vitest_1.expect)(enabled).toContain('pattern');
            (0, vitest_1.expect)(enabled).toContain('eslint');
            (0, vitest_1.expect)(enabled).toContain('typescript');
        });
    });
});
//# sourceMappingURL=AnalysisEngine.test.js.map