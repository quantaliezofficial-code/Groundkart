import React, { useState } from 'react';
import SEOHead from './SEOHead';
import { generateBreadcrumbSchema } from '../lib/schema';
import { Mail, Phone, MapPin, Clock, MessageSquare, CheckCircle } from 'lucide-react';
import { SITE_NAME, absUrl, SUPPORT_EMAIL, PARTNERS_EMAIL } from '../lib/site';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Contact Us', path: '/contact' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 sm:py-16">
      <SEOHead
        title={`Contact ${SITE_NAME} — Support & Venue Partnerships`}
        description={`Get in touch with ${SITE_NAME} support for booking inquiries, venue partnership applications, cancellation assistance, and general platform feedback.`}
        canonicalUrl={absUrl('/contact')}
        jsonLd={generateBreadcrumbSchema(breadcrumbs)}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs font-sans text-on-surface-variant">
            <li><a href="/" className="hover:text-pitch transition-colors">Home</a></li>
            <li>/</li>
            <li className="text-pitch font-semibold" aria-current="page">Contact Us</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <h1 className="font-display text-3xl sm:text-5xl text-ink font-bold tracking-tight mb-4">
            We're Here to Help
          </h1>
          <p className="font-sans text-base sm:text-lg text-on-surface-variant leading-relaxed">
            Have questions about an existing booking, need assistance listing your venue, or planning a large tournament? Reach out to our team.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-ink/10 shadow-xs space-y-4">
              <h2 className="font-sans text-lg font-bold text-ink">Contact Channels</h2>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-pitch/10 flex items-center justify-center text-pitch shrink-0">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="font-sans text-xs uppercase font-semibold text-on-surface-variant">Customer Support</h3>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-sans text-sm font-bold text-pitch hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-pitch/10 flex items-center justify-center text-pitch shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-sans text-xs uppercase font-semibold text-on-surface-variant">Venue Partnerships</h3>
                  <a href={`mailto:${PARTNERS_EMAIL}`} className="font-sans text-sm font-bold text-pitch hover:underline">
                    {PARTNERS_EMAIL}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-pitch/10 flex items-center justify-center text-pitch shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-sans text-xs uppercase font-semibold text-on-surface-variant">Operating Hours</h3>
                  <p className="font-sans text-sm text-ink">Monday – Sunday: 8:00 AM – 10:00 PM IST</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-pitch/10 flex items-center justify-center text-pitch shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="font-sans text-xs uppercase font-semibold text-on-surface-variant">Locations Served</h3>
                  <p className="font-sans text-sm text-ink">Metropolis & Lucknow Metropolitan Area, India</p>
                </div>
              </div>
            </div>

            <div className="bg-[#143828] text-chalk p-6 rounded-2xl shadow-sm space-y-3">
              <h3 className="font-display text-lg font-bold text-marigold">Venue Owners</h3>
              <p className="font-sans text-xs text-chalk/80 leading-relaxed">
                Want to list your sports turf, banquet hall, or conference space? Complete your onboarding in under 15 minutes through our Owner Portal.
              </p>
              <a
                href="/owner"
                className="inline-block bg-marigold text-pitch text-xs font-bold px-4 py-2 rounded-full hover:bg-amber-400 transition"
              >
                Go to Owner Portal
              </a>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-ink/10 shadow-sm">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-pitch/10 text-pitch flex items-center justify-center mx-auto">
                  <CheckCircle size={36} />
                </div>
                <h3 className="font-display text-2xl font-bold text-ink">Message Received</h3>
                <p className="font-sans text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                  Thank you for reaching out, {name}. A member of our support team will review your inquiry and respond within 24 hours.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setName('');
                    setEmail('');
                    setSubject('');
                    setMessage('');
                  }}
                  className="bg-pitch text-chalk px-6 py-2.5 rounded-full text-xs font-bold transition hover:bg-[#15462E]"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-ink mb-2">Send an Inquiry</h2>

                <div>
                  <label htmlFor="contact-name" className="block text-xs font-bold uppercase font-sans text-ink mb-1">
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-[#F7F7F2] border border-ink/10 rounded-xl px-4 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-pitch/20"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-xs font-bold uppercase font-sans text-ink mb-1">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#F7F7F2] border border-ink/10 rounded-xl px-4 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-pitch/20"
                  />
                </div>

                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-bold uppercase font-sans text-ink mb-1">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Booking assistance or venue listing question"
                    className="w-full bg-[#F7F7F2] border border-ink/10 rounded-xl px-4 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-pitch/20"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-bold uppercase font-sans text-ink mb-1">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details about your query..."
                    className="w-full bg-[#F7F7F2] border border-ink/10 rounded-xl px-4 py-2.5 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-pitch/20 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-pitch hover:bg-[#15462E] text-chalk font-sans font-bold py-3 rounded-xl text-sm transition shadow-sm active:scale-[0.98] cursor-pointer"
                >
                  Submit Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
