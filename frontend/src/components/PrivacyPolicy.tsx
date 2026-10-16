import React from 'react';
import SEOHead from './SEOHead';
import { generateBreadcrumbSchema } from '../lib/schema';
import { SITE_NAME, absUrl, SUPPORT_EMAIL } from '../lib/site';

export default function PrivacyPolicy() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Privacy Policy', path: '/privacy' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 sm:py-16">
      <SEOHead
        title={`Privacy Policy — ${SITE_NAME}`}
        description={`${SITE_NAME} Privacy Policy — how we collect, use, and protect your personal and payment information.`}
        canonicalUrl={absUrl('/privacy')}
        jsonLd={generateBreadcrumbSchema(breadcrumbs)}
      />
      <div className="max-w-3xl mx-auto px-6">
        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs font-sans text-on-surface-variant">
            <li><a href="/" className="hover:text-pitch transition-colors">Home</a></li>
            <li>/</li>
            <li className="text-pitch font-semibold" aria-current="page">Privacy Policy</li>
          </ol>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold font-display text-ink mb-2">Privacy Policy</h1>
        <p className="text-xs font-sans text-on-surface-variant mb-10">Last updated: October 2026</p>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">1. Information We Collect</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            When you create an account, search for venues, or initiate a booking, we collect basic contact details (such as name, email address, and phone number) necessary to verify your reservation. For registered venue owners, we also collect business registration and identity verification credentials required for platform onboarding and payout compliance.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">2. How We Use Information</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Your data is strictly utilized to operate the marketplace: verifying reservations, dispatching booking confirmations via SMS and notification channels, providing booking management links, and enabling venue hosts to coordinate schedules. We never sell, rent, or trade your personal information to third-party marketing brokers.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">3. Cookie &amp; Authentication Architecture</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            We use a single cryptographic httpOnly, Secure authentication cookie to sustain your verified session. {SITE_NAME} does not deploy intrusive cross-site ad trackers or behavioral profiling cookies.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">4. Data Retention &amp; Erasure</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Account profiles remain active until deletion is requested. Transactional records and confirmed booking receipts are preserved for mandatory legal, financial, and tax accounting auditing periods. To request deletion of your account and personal data, please contact our privacy desk at {SUPPORT_EMAIL}.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">5. Contact &amp; Grievance Officer</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            For inquiries regarding our data handling practices or to exercise your rights under applicable privacy laws, please contact our team at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-pitch font-semibold underline">
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
