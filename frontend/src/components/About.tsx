import React from 'react';
import SEOHead from './SEOHead';
import { generateBreadcrumbSchema } from '../lib/schema';
import { ShieldCheck, CheckCircle2, Award, Users, Heart } from 'lucide-react';
import { SITE_NAME, absUrl } from '../lib/site';

export default function About() {
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'About Us', path: '/about' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 sm:py-16">
      <SEOHead
        title={`About ${SITE_NAME} — India's Premier Venue Discovery Platform`}
        description={`Learn about ${SITE_NAME}'s mission to make sports turfs, courts, banquet halls, farmhouses, and corporate spaces discoverable, verified, and effortlessly bookable.`}
        canonicalUrl={absUrl('/about')}
        jsonLd={generateBreadcrumbSchema(breadcrumbs)}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs font-sans text-on-surface-variant">
            <li><a href="/" className="hover:text-pitch transition-colors">Home</a></li>
            <li>/</li>
            <li className="text-pitch font-semibold" aria-current="page">About Us</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <span className="text-xs uppercase font-sans tracking-widest font-bold text-marigold bg-pitch px-3 py-1.5 rounded-full inline-block mb-4">
            Our Mission
          </span>
          <h1 className="font-display text-3xl sm:text-5xl text-ink font-bold tracking-tight mb-4">
            Precision in Every Play. Clarity in Every Booking.
          </h1>
          <p className="font-sans text-base sm:text-lg text-on-surface-variant leading-relaxed">
            {SITE_NAME} was founded on a simple premise: discovering and reserving physical spaces for sports, weddings, and corporate gatherings should be as transparent and reliable as booking a flight.
          </p>
        </header>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
          <div className="bg-chalk p-6 rounded-2xl border border-ink/10 shadow-xs flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-pitch/10 flex items-center justify-center text-pitch">
              <ShieldCheck size={26} />
            </div>
            <h2 className="font-sans text-lg font-bold text-pitch">Physical Verification</h2>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Every arena, court, and banquet facility undergoes rigorous physical inspections for safety, lighting quality, turf standards, and accurate amenities.
            </p>
          </div>

          <div className="bg-chalk p-6 rounded-2xl border border-ink/10 shadow-xs flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-pitch/10 flex items-center justify-center text-pitch">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="font-sans text-lg font-bold text-pitch">Transparent Pricing</h2>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              No hidden gateway surcharges or sudden weekend spikes. What you see on the venue card is the exact price you pay for the reserved slot.
            </p>
          </div>

          <div className="bg-chalk p-6 rounded-2xl border border-ink/10 shadow-xs flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-pitch/10 flex items-center justify-center text-pitch">
              <Award size={26} />
            </div>
            <h2 className="font-sans text-lg font-bold text-pitch">Dedicated Support</h2>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Our support team assists with rescheduling, cancellation refunds under verified distance-to-event tiers, and custom corporate tournaments.
            </p>
          </div>
        </div>

        {/* Narrative Section */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-ink/10 shadow-sm space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl text-ink font-bold">
            Built for Players, Hosts, and Venue Owners
          </h2>
          <p className="font-sans text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Before {SITE_NAME}, reserving a sports ground meant phone calls, uncertain availability, cash handshakes, and frequent double-booking disputes. We built {SITE_NAME} to empower both players seeking dependable game times and venue owners seeking professional, audited inventory management.
          </p>
          <p className="font-sans text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Today, {SITE_NAME} hosts premier facilities spanning Metropolis and Lucknow, connecting thousands of weekend athletes, corporate teams, and families to extraordinary spaces.
          </p>
          <div className="pt-6 border-t border-ink/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-sans text-xs text-on-surface-variant uppercase font-semibold">Headquarters</p>
              <p className="font-sans text-sm font-bold text-ink">{SITE_NAME} Technologies Pvt. Ltd., India</p>
            </div>
            <a
              href="/contact"
              className="bg-pitch hover:bg-[#15462E] text-chalk px-6 py-3 rounded-full text-xs font-bold transition ease-out"
            >
              Get in Touch
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
