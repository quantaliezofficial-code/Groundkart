import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';

export interface AuditIssue {
  id: string;
  title: string;
  category: 'Functional' | 'UX' | 'Visual' | 'Accessibility' | 'Performance' | 'Security' | 'Reliability';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  persona: string[];
  route: string;
  environment: string;
  preconditions: string;
  steps: string[];
  expectedResult: string;
  actualResult: string;
  evidence: string;
  reproducibility: 'Consistently' | 'Intermittently' | 'Once';
  impact: string;
  suggestedFix: string;
  verification: string;
}

const ISSUES_FILE = path.resolve('test-results', 'issues.json');
const SCREENSHOTS_DIR = path.resolve('test-results', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

export function loadIssues(): AuditIssue[] {
  if (fs.existsSync(ISSUES_FILE)) {
    try {
      const data = fs.readFileSync(ISSUES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [];
}

export function recordIssue(issue: AuditIssue) {
  const current = loadIssues();
  const existingIdx = current.findIndex(i => i.id === issue.id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...issue };
  } else {
    current.push(issue);
  }
  fs.writeFileSync(ISSUES_FILE, JSON.stringify(current, null, 2), 'utf-8');
}

export async function captureEvidenceScreenshot(page: Page, filename: string): Promise<string> {
  const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return `test-results/screenshots/${filename}`;
}

export function setupErrorCollector(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText || 'failed'}`);
  });

  return { consoleErrors, failedRequests };
}
