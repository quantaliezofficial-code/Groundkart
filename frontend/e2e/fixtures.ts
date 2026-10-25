import { test as baseTest, expect, Page, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export class ConsoleGuard {
  private errors: string[] = [];
  private allowPatterns: (string | RegExp)[] = [
    // Standard expected background refresh failure when not logged in
    /401.*\/api\/v1\/auth\/refresh/,
    /Failed to load resource.*401/,
    /favicon\.ico/,
  ];

  constructor(page: Page) {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.errors.push(`[Console Error] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      this.errors.push(`[Page Error] ${err.message}`);
    });

    page.on('response', (res) => {
      if (res.status() >= 400) {
        this.errors.push(`[HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
      }
    });
  }

  allow(pattern: string | RegExp) {
    this.allowPatterns.push(pattern);
  }

  verify() {
    const unallowed = this.errors.filter((err) => {
      return !this.allowPatterns.some((pattern) => {
        if (typeof pattern === 'string') {
          return err.includes(pattern);
        }
        return pattern.test(err);
      });
    });

    if (unallowed.length > 0) {
      throw new Error(`Unexpected errors captured by ConsoleGuard:\n${unallowed.join('\n')}`);
    }
  }

  getErrors() {
    return [...this.errors];
  }
}

const tokenCache = new Map<string, { token: string; expires: number }>();

export class ApiHelper {
  private request: APIRequestContext;
  private apiBase: string;

  constructor(request: APIRequestContext, apiBase: string) {
    this.request = request;
    this.apiBase = apiBase;
  }

  async login(login_id: string, password: string): Promise<{ access_token: string }> {
    const cached = tokenCache.get(login_id);
    if (cached && Date.now() < cached.expires) {
      return { access_token: cached.token };
    }
    const res = await this.request.post(`${this.apiBase}/api/v1/auth/login`, {
      data: { login_id, password },
    });
    if (!res.ok()) {
      throw new Error(`Api login failed (${res.status()}): ${await res.text()}`);
    }
    const data = await res.json();
    tokenCache.set(login_id, { token: data.access_token, expires: Date.now() + 10 * 60 * 1000 });
    return data;
  }

  async getMe(token: string): Promise<any> {
    const res = await this.request.get(`${this.apiBase}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  async createVenue(token: string, venueData: any): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/venues`, {
      headers: { Authorization: `Bearer ${token}` },
      data: venueData,
    });
    if (!res.ok()) {
      throw new Error(`createVenue failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async getVenue(venueId: string): Promise<any> {
    const res = await this.request.get(`${this.apiBase}/api/v1/venues/${venueId}`);
    return res.json();
  }

  async uploadVenueImage(token: string, venueId: string, imageBuffer: Buffer, filename: string = 'venue.jpg', isCover: boolean = true): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/venues/${venueId}/images`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        image: {
          name: filename,
          mimeType: 'image/jpeg',
          buffer: imageBuffer,
        },
        is_cover: String(isCover),
      },
    });
    if (!res.ok()) {
      throw new Error(`uploadVenueImage failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async addInventoryUnits(token: string, venueId: string, units: any[]): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/venues/${venueId}/inventory-units`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { units },
    });
    if (!res.ok()) {
      throw new Error(`addInventoryUnits failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async listInventoryUnits(venueId: string): Promise<any[]> {
    const res = await this.request.get(`${this.apiBase}/api/v1/venues/${venueId}/inventory-units`);
    return res.json();
  }

  async approveVenue(adminToken: string, venueId: string): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/admin/venues/${venueId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok()) {
      throw new Error(`approveVenue failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async rejectVenue(adminToken: string, venueId: string, reason: string): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/admin/venues/${venueId}/reject`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { reason },
    });
    if (!res.ok()) {
      throw new Error(`rejectVenue failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async createBooking(payload: any, token?: string): Promise<any> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await this.request.post(`${this.apiBase}/api/v1/bookings`, {
      headers,
      data: payload,
    });
    if (!res.ok()) {
      throw new Error(`createBooking failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async cancelBooking(token: string, bookingId: string, reason?: string): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/bookings/${bookingId}/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { reason: reason || 'Customer cancellation' },
    });
    if (!res.ok()) {
      throw new Error(`cancelBooking failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async confirmPayment(adminToken: string, bookingId: string, amount: string | number, notes: string = 'Payment confirmed', method: string = 'upi'): Promise<any> {
    const res = await this.request.post(`${this.apiBase}/api/v1/admin/bookings/${bookingId}/confirm-payment`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { amount, method, notes },
    });
    if (!res.ok()) {
      throw new Error(`confirmPayment failed (${res.status()}): ${await res.text()}`);
    }
    return res.json();
  }

  async deleteVenue(token: string, venueId: string): Promise<void> {
    await this.request.delete(`${this.apiBase}/api/v1/venues/${venueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const CUSTOMER_POOL = [
  'priya.verma@groundkart.demo',
  'rohit.mishra@groundkart.demo',
  'sana.fatima@groundkart.demo',
  'vikram.singh@groundkart.demo',
  'deepa.nair@groundkart.demo',
  'karan.malhotra@groundkart.demo',
  'ayesha.khan@groundkart.demo',
  'manish.tiwari@groundkart.demo',
  'shreya.banerjee@groundkart.demo',
  'arjun.kumar@groundkart.demo',
];
let customerPoolIdx = 0;

const OWNER_POOL = [
  'anita.srivastava@groundkart.demo',
  'imran.qureshi@groundkart.demo',
  'neha.bajpai@groundkart.demo',
  'gopal.agarwal@groundkart.demo',
];
let ownerPoolIdx = 0;

export async function authenticateContext(
  context: any,
  role: 'customer' | 'owner' | 'admin',
  apiUrl: string = process.env.E2E_API_URL || 'http://localhost:8000',
  customCreds?: { email: string; password?: string }
): Promise<void> {
  let creds;
  if (customCreds) {
    creds = { email: customCreds.email, password: customCreds.password || 'Demo@2026!' };
  } else if (role === 'customer') {
    const email = CUSTOMER_POOL[(customerPoolIdx++) % CUSTOMER_POOL.length];
    creds = { email, password: 'Demo@2026!' };
  } else if (role === 'owner') {
    const email = OWNER_POOL[(ownerPoolIdx++) % OWNER_POOL.length];
    creds = { email, password: 'Demo@2026!' };
  } else {
    creds = { email: 'admin@groundkart.demo', password: 'Admin@2026!' };
  }

  let res = await context.request.post(`${apiUrl}/api/v1/auth/login`, {
    data: { login_id: creds.email, password: creds.password },
  });

  if (res.status() === 429) {
    const pool = role === 'customer' ? CUSTOMER_POOL : role === 'owner' ? OWNER_POOL : [];
    for (const spare of pool) {
      if (spare === creds.email) continue;
      res = await context.request.post(`${apiUrl}/api/v1/auth/login`, {
        data: { login_id: spare, password: 'Demo@2026!' },
      });
      if (res.ok()) break;
    }
  }

  if (!res.ok()) {
    throw new Error(`Failed to authenticate ${role} (${creds.email}): ${res.status()} ${await res.text()}`);
  }
}

type CustomFixtures = {
  consoleGuard: ConsoleGuard;
  api: ApiHelper;
  uniqueSuffix: string;
};

export const test = baseTest.extend<CustomFixtures>({
  consoleGuard: async ({ page }, use) => {
    const guard = new ConsoleGuard(page);
    await use(guard);
    guard.verify();
  },
  api: async ({ request }, use) => {
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';
    const helper = new ApiHelper(request, apiUrl);
    await use(helper);
  },
  uniqueSuffix: async ({}, use) => {
    await use(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  },
});

export { expect };
