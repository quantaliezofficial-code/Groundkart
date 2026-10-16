import React from 'react';
import SEOHead from './SEOHead';
import { generateBreadcrumbSchema } from '../lib/schema';
import { SITE_NAME, absUrl, SUPPORT_EMAIL } from '../lib/site';

export default function TermsOfService() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Terms of Service', path: '/terms' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 sm:py-16">
      <SEOHead
        title={`Terms of Service — ${SITE_NAME}`}
        description={`${SITE_NAME} Terms of Service — rules and terms governing venue bookings, owner listings, cancellations, and platform usage.`}
        canonicalUrl={absUrl('/terms')}
        jsonLd={generateBreadcrumbSchema(breadcrumbs)}
      />
      <div className="max-w-3xl mx-auto px-6">
        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs font-sans text-on-surface-variant">
            <li><a href="/" className="hover:text-pitch transition-colors">Home</a></li>
            <li>/</li>
            <li className="text-pitch font-semibold" aria-current="page">Terms of Service</li>
          </ol>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold font-display text-ink mb-2">Terms of Service</h1>
        <p className="text-xs font-sans text-on-surface-variant mb-10">Last updated: October 2026</p>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">1. Agreement to Terms</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            By accessing or using the {SITE_NAME} marketplace, you agree to be bound by these Terms of Service. If you do not agree to these terms, please refrain from accessing or booking venues on the platform.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">2. Booking Lifecycle &amp; Hold Durations</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            When you select an available slot and initiate checkout, the slot enters a reserved hold state. A booking is formally confirmed once offline payment verification is performed. Slots with unconfirmed payments exceeding the hold duration are automatically released back to the public catalog by our automated hold-sweep service.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">3. Transparent Cancellation &amp; Refund Tiers</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Cancellations are evaluated transparently based on distance to the scheduled start time:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-on-surface-variant">
            <li><strong>Full Refund (100%):</strong> Cancellations made 48 hours or more before slot start time.</li>
            <li><strong>Partial Refund (50%):</strong> Cancellations made between 24 and 48 hours before slot start time.</li>
            <li><strong>No Refund (0%):</strong> Cancellations made less than 24 hours before slot start time.</li>
          </ul>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">4. Venue Owner Obligations</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Venue hosts must provide verified identity documentation and business registrations before publishing listings. All published amenities, imagery, operating hours, and turf specifications must accurately reflect the real physical property. {SITE_NAME} deducts an agreed platform commission on confirmed bookings upon completed payout execution.
          </p>
        </section>

        <section className="mb-8 bg-white p-6 rounded-2xl border border-ink/10 shadow-xs">
          <h2 className="text-lg font-bold font-sans text-pitch mb-3">5. Contact &amp; Inquiries</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            For questions regarding these Terms or booking disputes, please reach out to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-pitch font-semibold underline">
              {SUPPORT_EMAIL}
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
