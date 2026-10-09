import { describe, it, expect, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { PatternAnalyzer } from '../analyzers/PatternAnalyzer';

// Mock VS Code
const mockDocument = {
  languageId: 'javascript',
  fileName: 'test.js',
  uri: { fsPath: '/test/test.js' },
  getText: () => ''
} as vscode.TextDocument;

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
  });

  describe('canAnalyze', () => {
    it('should support JavaScript files', () => {
      const doc = { ...mockDocument, languageId: 'javascript' };
      expect(analyzer.canAnalyze(doc as vscode.TextDocument)).toBe(true);
    });

    it('should support TypeScript files', () => {
      const doc = { ...mockDocument, languageId: 'typescript' };
      expect(analyzer.canAnalyze(doc as vscode.TextDocument)).toBe(true);
    });

    it('should not support unsupported file types', () => {
      const doc = { ...mockDocument, languageId: 'python' };
      expect(analyzer.canAnalyze(doc as vscode.TextDocument)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should detect console statements', async () => {
      const doc = {
        ...mockDocument,
        getText: () => 'console.log("test");'
      };

      const issues = await analyzer.analyze(doc as vscode.TextDocument);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Console statement found');
      expect(issues[0].severity).toBe('low');
      expect(issues[0].issueCode).toBe('no-console');
    });

    it('should detect eval usage', async () => {
      const doc = {
        ...mockDocument,
        getText: () => 'var result = eval("2 + 2");'
      };

      const issues = await analyzer.analyze(doc as vscode.TextDocument);
      
      expect(issues).toHaveLength(2); // eval + var
      const evalIssue = issues.find(i => i.issueCode === 'no-eval');
      expect(evalIssue).toBeDefined();
      expect(evalIssue!.severity).toBe('critical');
    });

    it('should detect var usage', async () => {
      const doc = {
        ...mockDocument,
        getText: () => 'var oldStyle = "test";'
      };

      const issues = await analyzer.analyze(doc as vscode.TextDocument);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Use const or let instead of var');
      expect(issues[0].severity).toBe('low');
    });

    it('should detect loose equality', async () => {
      const doc = {
        ...mockDocument,
        getText: () => 'if (user == null) { return; }'
      };

      const issues = await analyzer.analyze(doc as vscode.TextDocument);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('Use strict equality');
      expect(issues[0].severity).toBe('medium');
    });

    it('should detect innerHTML usage', async () => {
      const doc = {
        ...mockDocument,
        getText: () => 'element.innerHTML = userInput;'
      };

      const issues = await analyzer.analyze(doc as vscode.TextDocument);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('innerHTML assignment may lead to XSS');
      expect(issues[0].severity).toBe('high');
    });

    it('should handle TypeScript-specific patterns', async () => {
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

      const issues = await analyzer.analyze(doc as vscode.TextDocument);
      
      expect(issues.length).toBeGreaterThan(0);
      const anyTypeIssue = issues.find(i => i.issueCode === 'any-type');
      expect(anyTypeIssue).toBeDefined();
    });
  });
});