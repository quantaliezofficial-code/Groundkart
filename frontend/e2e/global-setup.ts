import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';
  const authDir = path.resolve(__dirname, '../.auth');

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const credentials = [
    {
      role: 'customer',
      email: 'arjun.kumar@groundkart.demo',
      password: 'Demo@2026!',
      targetPath: '/',
      storagePath: path.join(authDir, 'customer.json'),
      expectedSelector: 'button[aria-label="Account menu"]',
    },
    {
      role: 'owner',
      email: 'anita.srivastava@groundkart.demo',
      password: 'Demo@2026!',
      targetPath: '/owner',
      storagePath: path.join(authDir, 'owner.json'),
      expectedSelector: 'button[title="Log out"]',
    },
    {
      role: 'admin',
      email: 'admin@groundkart.demo',
      password: 'Admin@2026!',
      targetPath: '/admin',
      storagePath: path.join(authDir, 'admin.json'),
      expectedSelector: 'button[title="Log out"]',
    },
  ];

  const browser = await chromium.launch();

  for (const cred of credentials) {
    const context = await browser.newContext({ baseURL });

    // 1. Authenticate via API to receive the httpOnly refresh_token cookie
    const loginRes = await context.request.post(`${apiUrl}/api/v1/auth/login`, {
      data: {
        login_id: cred.email,
        password: cred.password,
      },
    });

    if (!loginRes.ok()) {
      throw new Error(`Global setup failed to authenticate ${cred.role} via API: ${loginRes.status()} ${await loginRes.text()}`);
    }

    const page = await context.newPage();

    // 2. Open UI route where session restores automatically
    await page.goto(cred.targetPath, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(cred.expectedSelector, { timeout: 15_000 });

    // 3. Confirm session survives page reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector(cred.expectedSelector, { timeout: 15_000 });

    // 4. Save storage state for test suites
    await context.storageState({ path: cred.storagePath });

    await context.close();
  }

  await browser.close();
}

export default globalSetup;
