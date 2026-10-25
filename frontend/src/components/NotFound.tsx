import React from 'react';
import SEOHead from './SEOHead';
import { SITE_NAME, absUrl } from '../lib/site';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] bg-[#FDFBF7] flex flex-col items-center justify-center px-6 py-20 text-center">
      <SEOHead
        title={`404: Page Not Found — ${SITE_NAME}`}
        description="The venue, category, or page you are looking for does not exist or has been moved."
        canonicalUrl={absUrl('/404')}
        noindex={true}
      />
      <div className="max-w-md mx-auto space-y-5">
        <p className="text-7xl font-extrabold font-display text-pitch">404</p>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-ink">Page Not Found</h1>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          The space, category, or page you are looking for doesn't exist, was renamed, or has been removed from our listings.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/"
            className="inline-flex items-center justify-center bg-pitch hover:bg-[#15462E] text-chalk px-6 py-3 rounded-full text-xs font-bold transition ease-out shadow-xs"
          >
            Return Home
          </a>
          <a
            href="/search"
            className="inline-flex items-center justify-center bg-chalk border border-ink/10 hover:bg-mist text-pitch px-6 py-3 rounded-full text-xs font-bold transition ease-out"
          >
            Browse All Venues
          </a>
        </div>
      </div>
    </div>
  );
}
