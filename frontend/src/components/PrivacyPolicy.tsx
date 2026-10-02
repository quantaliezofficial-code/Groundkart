import { Helmet } from 'react-helmet-async';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Privacy Policy — GroundKart</title>
        <meta name="description" content="GroundKart Privacy Policy — how we collect, use, and protect your data." />
      </Helmet>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: August 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">1. What we collect</h2>
          <p className="text-gray-600 leading-relaxed">When you create an account or make a booking, we collect your name, email address, and booking details. For venue owners, we also collect business verification documents.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">2. How we use it</h2>
          <p className="text-gray-600 leading-relaxed">Your information is used to operate the booking platform: confirming reservations, sending booking notifications, and enabling venue owners to manage their listings. We do not sell your data to third parties.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Cookies</h2>
          <p className="text-gray-600 leading-relaxed">We use a single authentication cookie (httpOnly, secure) to keep you signed in. We do not use advertising or analytics cookies.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Data retention</h2>
          <p className="text-gray-600 leading-relaxed">Account data is retained while your account is active. Booking records are retained for accounting and dispute purposes. To request deletion of your data, contact us at support@groundkart.in.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Contact</h2>
          <p className="text-gray-600 leading-relaxed">Questions about this policy? Email <a href="mailto:support@groundkart.in" className="text-green-600 underline">support@groundkart.in</a>.</p>
        </section>
      </div>
    </div>
  );
}
