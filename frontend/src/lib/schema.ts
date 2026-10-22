import { Venue } from '../types';
import { SITE_NAME, SITE_URL, absUrl, SUPPORT_EMAIL } from './site';

export const CANONICAL_BASE = SITE_URL;

/**
 * Generates Schema.org WebSite JSON-LD with Sitelinks Searchbox potentialAction.
 */
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: CANONICAL_BASE,
    description: `${SITE_NAME} is India\'s premier platform for discovering and booking verified sports turfs, courts, banquet halls, farmhouses, and corporate event spaces.`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absUrl('/search?q={search_term_string}'),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generates Schema.org Organization JSON-LD for GroundKart.
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: CANONICAL_BASE,
    logo: absUrl('/logo-full.png'),
    image: absUrl('/og-image.png'),
    description: 'Premier online venue discovery and booking marketplace.',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SUPPORT_EMAIL,
        availableLanguage: ['en', 'hi'],
      },
    ],
  };
}

/**
 * Generates Schema.org BreadcrumbList JSON-LD.
 */
export function generateBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.path.startsWith('http') ? item.path : absUrl(item.path),
    })),
  };
}

/**
 * Maps category to Schema.org subtype.
 */
function getSchemaTypeForCategory(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized.includes('turf') || normalized.includes('sport') || normalized.includes('court') || normalized.includes('ground')) {
    return 'SportsActivityLocation';
  }
  if (normalized.includes('banquet') || normalized.includes('wedding')) {
    return 'EventVenue';
  }
  if (normalized.includes('corporate') || normalized.includes('meeting') || normalized.includes('hub')) {
    return 'LocalBusiness';
  }
  if (normalized.includes('farmhouse') || normalized.includes('retreat')) {
    return 'LocalBusiness';
  }
  return 'LocalBusiness';
}

/**
 * Generates Schema.org LocalBusiness / SportsActivityLocation / EventVenue JSON-LD.
 * Strictly adheres to truth in advertising:
 * - Never fabricates fake reviews or ratings (only adds aggregateRating if real rating and reviewCount exist).
 * - Only uses verified data fields from the venue model.
 */
export function generateVenueSchema(venue: Venue) {
  const schemaType = getSchemaTypeForCategory(venue.category || venue.venueType || '');
  const venueUrl = absUrl(`/venues/${venue.slug || venue.id}`);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: venue.name,
    description: venue.description,
    url: venueUrl,
    image: venue.gallery && venue.gallery.length > 0 ? venue.gallery : [venue.image],
    priceRange: `₹${venue.basePrice}/${venue.unitType || 'unit'}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: venue.city,
      addressRegion: venue.district,
      addressCountry: 'IN',
    },
  };

  // Only include aggregateRating when genuine reviews and positive rating exist
  if (venue.rating && venue.rating > 0 && venue.reviewCount && venue.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: venue.rating.toFixed(1),
      reviewCount: venue.reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  // Include amenities if present
  if (venue.amenities && venue.amenities.length > 0) {
    schema.amenityFeature = venue.amenities.map((amenity) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    }));
  }

  return schema;
}

/**
 * Generates Schema.org CollectionPage JSON-LD for category and search hubs.
 */
export function generateCollectionPageSchema(title: string, path: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: absUrl(path),
    description,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: CANONICAL_BASE,
    },
  };
}
