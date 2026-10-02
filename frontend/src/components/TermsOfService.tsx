import { Helmet } from 'react-helmet-async';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Terms of Service — GroundKart</title>
        <meta name="description" content="GroundKart Terms of Service — the rules for using our platform." />
      </Helmet>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: August 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Acceptance</h2>
          <p className="text-gray-600 leading-relaxed">By using GroundKart, you agree to these Terms. If you don't agree, please don't use the platform.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Bookings</h2>
          <p className="text-gray-600 leading-relaxed">A booking is confirmed only after payment is verified by an admin. Pending bookings may be cancelled if payment is not received within the hold period. Cancellation refunds are calculated based on how far in advance you cancel — see our refund policy for details.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Venue owners</h2>
          <p className="text-gray-600 leading-relaxed">Owners must complete identity verification before listing venues. Listings must accurately describe the venue. GroundKart takes a platform commission on confirmed payouts.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Prohibited use</h2>
          <p className="text-gray-600 leading-relaxed">You may not use GroundKart for fraudulent bookings, harassment, or any activity that violates applicable law. Accounts found violating these rules will be suspended.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Contact</h2>
          <p className="text-gray-600 leading-relaxed">Questions? Email <a href="mailto:support@groundkart.in" className="text-green-600 underline">support@groundkart.in</a>.</p>
        </section>
      </div>
    </div>
  );
}
