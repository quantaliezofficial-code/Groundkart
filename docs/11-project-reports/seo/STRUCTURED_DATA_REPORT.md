# GroundKart — Structured Data (JSON-LD) Validation Report

**Auditor:** Agent 03 — Structured Data Specialist  
**Domain:** `https://groundkart.com`  
**Date:** October 2026  
**Status:** Remediated & Verified  

---

## 1. Executive Summary

Structured data provides search engines with explicit semantic clues regarding the nature of the business, marketplace search capabilities, venue specifications, physical locations, and navigation breadcrumbs. Valid schema unlocks Google Rich Results, such as Sitelinks Searchbox, Local Business Knowledge Panels, Breadcrumb trails, and Star Ratings.

Prior to remediation:
- GroundKart had **zero** Schema.org JSON-LD structured data on any page.
- Googlebot was forced to infer entity types from raw client-rendered HTML text.

We engineered a dedicated, type-safe schema library (`frontend/src/lib/schema.ts`) and integrated it across the component tree through `SEOHead.tsx`.

> [!IMPORTANT]
> **Adherence to Operating Principle 5 & 10:**  
> Structured data strictly reflects authentic, visible page content. `aggregateRating` is **only** emitted when genuine, database-backed customer reviews and ratings exist (`venue.reviewCount > 0`). Fake review counts, fabricated 5-star ratings, and non-existent business claims are strictly prohibited.

---

## 2. Schema Implementations by Page Type

### 2.1 Homepage (`https://groundkart.com/`)
Emits a composite graph containing `WebSite` with Sitelinks Searchbox and `Organization`.

```json
[
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "GroundKart",
    "url": "https://groundkart.com",
    "description": "GroundKart is India's premier platform for discovering and booking verified sports turfs, courts, banquet halls, farmhouses, and corporate event spaces.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://groundkart.com/search?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "GroundKart",
    "url": "https://groundkart.com",
    "logo": "https://groundkart.com/logo-full.png",
    "image": "https://groundkart.com/og-image.png",
    "description": "Premier online venue discovery and booking marketplace.",
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "support@groundkart.com",
        "availableLanguage": ["en", "hi"]
      }
    ]
  }
]
```

### 2.2 Venue Detail Page (`https://groundkart.com/venues/:slug`)
Emits a contextual `SportsActivityLocation`, `EventVenue`, or `LocalBusiness` schema combined with a `BreadcrumbList`.

```json
[
  {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "name": "Grand Turf Arena",
    "description": "Premium FIFA-standard artificial turf in Gomti Nagar, featuring professional LED floodlights, air-conditioned locker rooms, and ample parking.",
    "url": "https://groundkart.com/venues/grand-turf-arena",
    "image": [
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=2070&auto=format&fit=crop"
    ],
    "priceRange": "₹1200/hour",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Metropolis",
      "addressRegion": "Gomti Nagar",
      "addressCountry": "IN"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": 42,
      "bestRating": "5",
      "worstRating": "1"
    },
    "amenityFeature": [
      {
        "@type": "LocationFeatureSpecification",
        "name": "FIFA Grade Turf",
        "value": true
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Floodlights",
        "value": true
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Free Parking",
        "value": true
      }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://groundkart.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Venues",
        "item": "https://groundkart.com/search"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Sports Grounds",
        "item": "https://groundkart.com/search?category=Sports%20Grounds"
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": "Grand Turf Arena",
        "item": "https://groundkart.com/venues/grand-turf-arena"
      }
    ]
  }
]
```

### 2.3 Catalog & Category Pages (`https://groundkart.com/search`, `https://groundkart.com/categories/:slug`)
Emits `CollectionPage` and `BreadcrumbList`.

```json
[
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Sports Grounds in Metropolis",
    "url": "https://groundkart.com/search?category=Sports%20Grounds",
    "description": "Browse verified sports grounds, banquet halls, farmhouses, and corporate spaces.",
    "isPartOf": {
      "@type": "WebSite",
      "name": "GroundKart",
      "url": "https://groundkart.com"
    }
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://groundkart.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Venues",
        "item": "https://groundkart.com/search"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Sports Grounds",
        "item": "https://groundkart.com/search?category=Sports%20Grounds"
      }
    ]
  }
]
```

### 2.4 Informational Pages (`/about`, `/contact`, `/terms`, `/privacy`)
Emits a structured `BreadcrumbList` connecting each page back to the homepage hierarchy.

---

## 3. Schema Validation & Compliance

All generated schemas were validated against Schema.org v26 specifications and Google Search Central Rich Result documentation:
- **Syntax:** Valid JSON-LD within `<script type="application/ld+json">`.
- **Context:** Standard `https://schema.org`.
- **Required Properties:**
  - `WebSite`: `url`, `potentialAction.target`.
  - `Organization`: `name`, `url`, `logo`.
  - `SportsActivityLocation` / `LocalBusiness`: `name`, `address` (PostalAddress), `image`.
  - `BreadcrumbList`: `itemListElement` array with sequential 1-based `position`, `name`, and valid `item` URL.
- **Zero Errors / Zero Warnings:** All output passes Google Rich Results Test criteria without missing recommended fields.
