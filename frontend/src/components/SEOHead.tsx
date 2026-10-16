import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_NAME, absUrl } from '../lib/site';

export interface SEOHeadProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'place' | 'business.business';
  noindex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_TITLE = `${SITE_NAME} — Book Sports Turfs, Courts & Event Spaces`;
const DEFAULT_DESC =
  `Book premium sports turfs, cricket grounds, football pitches, badminton courts, banquet halls, and private farmhouses instantly on ${SITE_NAME}.`;
const DEFAULT_CANONICAL = absUrl('/');
const DEFAULT_OG_IMAGE = absUrl('/og-image.png');

export default function SEOHead({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESC,
  canonicalUrl = DEFAULT_CANONICAL,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noindex = false,
  jsonLd,
}: SEOHeadProps) {
  // Ensure canonical URL is absolute and uses HTTPS
  const resolvedCanonical = canonicalUrl.startsWith('http')
    ? canonicalUrl
    : absUrl(canonicalUrl);

  const resolvedOgImage = ogImage.startsWith('http')
    ? ogImage
    : absUrl(ogImage);

  const robotsContent = noindex ? 'noindex, nofollow' : 'index, follow';

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={resolvedCanonical} />
      <meta name="robots" content={robotsContent} />

      {/* Open Graph / Facebook */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedOgImage} />

      {/* Structured Data (JSON-LD) */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
