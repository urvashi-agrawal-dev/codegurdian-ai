import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { AnalysisEngine } from '../analyzers/AnalysisEngine';

// Mock VS Code workspace configuration
const mockConfig = {
  get: vi.fn((key: string, defaultValue?: any) => {
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

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => mockConfig),
    onDidChangeConfiguration: vi.fn()
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
} as vscode.TextDocument;

describe('AnalysisEngine', () => {
  let engine: AnalysisEngine;

  beforeEach(() => {
    engine = new AnalysisEngine();
  });

  describe('analyzeDocument', () => {
    it('should analyze supported documents', async () => {
      const issues = await engine.analyzeDocument(mockDocument);
      
      expect(Array.isArray(issues)).toBe(true);
      // Should find at least one issue from pattern analyzer
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for unsupported documents', async () => {
      const unsupportedDoc = {
        ...mockDocument,
        uri: { fsPath: '/test/test.py', scheme: 'file' },
        fileName: 'test.py'
      };

      const issues = await engine.analyzeDocument(unsupportedDoc as vscode.TextDocument);
      expect(issues).toHaveLength(0);
    });

    it('should return empty array for non-file scheme', async () => {
      const gitDoc = {
        ...mockDocument,
        uri: { fsPath: '/test/test.js', scheme: 'git' }
      };

      const issues = await engine.analyzeDocument(gitDoc as vscode.TextDocument);
      expect(issues).toHaveLength(0);
    });

    it('should exclude node_modules files', async () => {
      const nodeModulesDoc = {
        ...mockDocument,
        fileName: '/project/node_modules/lib/file.js',
        uri: { fsPath: '/project/node_modules/lib/file.js', scheme: 'file' }
      };

      const issues = await engine.analyzeDocument(nodeModulesDoc as vscode.TextDocument);
      expect(issues).toHaveLength(0);
    });
  });

  describe('getAvailableAnalyzers', () => {
    it('should return list of available analyzers', () => {
      const analyzers = engine.getAvailableAnalyzers();
      expect(analyzers).toContain('pattern');
      expect(analyzers).toContain('eslint');
      expect(analyzers).toContain('typescript');
    });
  });

  describe('getEnabledAnalyzers', () => {
    it('should return enabled analyzers based on configuration', () => {
      const enabled = engine.getEnabledAnalyzers();
      expect(enabled).toContain('pattern');
      expect(enabled).toContain('eslint');
      expect(enabled).toContain('typescript');
    });
  });
});