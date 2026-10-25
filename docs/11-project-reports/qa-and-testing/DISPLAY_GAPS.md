# GroundKart Frontend Display Gaps Audit

**Date:** 2026-10-20  
**Context:** GroundKart Demo Dataset Seeding Verification  
**Rule:** Development Audit Only — **No application code modified**.

This document audits every stored field in the GroundKart database and API responses that the current React frontend (`frontend/src/`) fails to display, displays incompletely, or displays incorrectly. Each finding is grounded in the exact source files and line numbers responsible.

---

## Summary Matrix of Findings & Resolution Status

| Feature / Stored Field | Status | Expected Finding Accuracy | Primary Resolution File & Line | Resolution Summary |
|---|---|---|---|---|
| **`display_name`** | **RESOLVED & VERIFIED** | **Confirmed** | [`frontend/src/components/VenueCard.tsx`](file:///d:/Code/groundbooking/frontend/src/components/VenueCard.tsx), [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Added to `Venue` type, mapped in `adapters.ts`, rendered in VenueCard and DetailView header. |
| **`tagline`** | **RESOLVED & VERIFIED** | **Corrected** | [`frontend/src/components/VenueCard.tsx`](file:///d:/Code/groundbooking/frontend/src/components/VenueCard.tsx), [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Rendered on both VenueCard under title and DetailView header with styling. |
| **`content_blocks`** | **RESOLVED & VERIFIED** | **Confirmed & Clarified** | [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Case-insensitive block matching; full FAQ Q&A rendering; settings items grid with icons for Highlights, Checklist, Rules. |
| **Amenity Grid** | **RESOLVED & VERIFIED** | **Confirmed & Clarified** | [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Added 25+ hospitality, banquet, and corporate amenity icons with graceful fallback. |
| **Review Count** | **RESOLVED & VERIFIED** | **Confirmed** | [`backend/app/schemas/catalog.py`](file:///d:/Code/groundbooking/backend/app/schemas/catalog.py), [`frontend/src/lib/adapters.ts`](file:///d:/Code/groundbooking/frontend/src/lib/adapters.ts) | Eager-loaded in backend catalog and mapped to `reviewCount` in card floating chip and detail view. |
| **Coordinates (`lat`, `lon`)** | **RESOLVED & VERIFIED** | **Confirmed** | [`backend/app/schemas/catalog.py`](file:///d:/Code/groundbooking/backend/app/schemas/catalog.py), [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Serialized in `VenueResponse`, mapped in adapter, deep-linked to Google Maps in DetailView. |
| **Use Cases** | **RESOLVED & VERIFIED** | **Confirmed** | [`frontend/src/components/VenueCard.tsx`](file:///d:/Code/groundbooking/frontend/src/components/VenueCard.tsx), [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Serialized in API, mapped in adapter, displayed as badges on cards and detail view. |
| **Rental Options** | **RESOLVED & VERIFIED** | **Confirmed** | [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Dedicated "Rental Options & Rates" grid section displaying modes, prices, weekend rates, and notes. |
| **Policies** | **RESOLVED & VERIFIED** | **Confirmed** | [`frontend/src/components/DetailView.tsx`](file:///d:/Code/groundbooking/frontend/src/components/DetailView.tsx) | Preserved and rendered in Space Guidelines and House Rules & Cancellation Guarantee cards. |
| **Video vs Image** | **RESOLVED & VERIFIED** | **Confirmed** | [`frontend/src/lib/adapters.ts`](file:///d:/Code/groundbooking/frontend/src/lib/adapters.ts) | Backend tags `media_type`; frontend checks `item.media_type === 'video'` and extension heuristics. |
| **Category Label for `sports`** | **RESOLVED & VERIFIED** | **Confirmed** | [`frontend/src/lib/adapters.ts`](file:///d:/Code/groundbooking/frontend/src/lib/adapters.ts) | Differentiates sports venues into `'Courts'`, `'Pools'`, or `'Turfs'` using `venue_type_name` and venue keywords. |

---

## Detailed Findings & Architectural Root Causes

### 1. `display_name` is completely omitted
- **Database / API Model:** `Venue.display_name` is stored in PostgreSQL (`backend/app/models/core.py:132`) and returned by the venue API (`backend/app/schemas/catalog.py:214`).
- **Adapter Discard:** [`frontend/src/lib/adapters.ts:71`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts#L71) maps `name: v.name`, but completely ignores `v.display_name`.
- **Presentation Type:** [`frontend/src/types.ts:40-65`](file:///c:/Users/ACER/code/groundbooking/frontend/src/types.ts#L40-L65) (`interface Venue`) has no `displayName` or `display_name` property.
- **UI Components:** [`frontend/src/components/DetailView.tsx:592`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/DetailView.tsx#L592) and [`frontend/src/components/VenueCard.tsx:85`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/VenueCard.tsx#L85) render `{venue.name}`. The polished, user-facing display name is never rendered anywhere.

### 2. `tagline` is only rendered on the Detail View
- **Status Clarification:** The prompt's expected finding suggested `tagline` is not shown. In reality, [`frontend/src/components/DetailView.tsx:595-599`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/DetailView.tsx#L595-L599) does render `{venue.tagline}` above the venue title:
  ```tsx
  {venue.tagline && (
    <p className="font-sans text-xs sm:text-sm font-semibold uppercase tracking-wider text-pitch mb-1">
      {venue.tagline}
    </p>
  )}
  ```
- **Display Gap:** On cards in Home, Search, and Browse listings ([`frontend/src/components/VenueCard.tsx:83-97`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/VenueCard.tsx#L83-L97)), `tagline` is completely omitted. Users browsing venue cards only see the title, category, and price without the descriptive hook.

### 3. `content_blocks` rendering is severely broken
- **Database Model:** `VenueContentBlock` ([`backend/app/models/core.py:761-785`](file:///c:/Users/ACER/code/groundbooking/backend/app/models/core.py#L761-L785)) stores presentation blocks with `type`, `title`, `subtitle`, `body`, `settings`, `sort_order`, and `enabled`.
- **Adapter Passing:** [`frontend/src/lib/adapters.ts:97`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts#L97) passes `contentBlocks: v.content_blocks`.
- **Detail View Renderer Failures:** In [`frontend/src/components/DetailView.tsx:952-989`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/DetailView.tsx#L952-L989):
  1. **Case-Sensitive Type Matching:** Lines 958–964 test against lowercase strings (`block.type === 'highlights'`, `block.type === 'rules'`, `block.type === 'faq'`). The backend and seed convention uses Title Case (`"Highlights"`, `"Rules"`, `"FAQ"`, `"Venue Story"`). As a result, the type icon matching always fails and falls back to a generic `<Layers />` icon.
  2. **Unrendered FAQ Questions & Answers:** Line 968 only renders `block.body`. FAQ blocks store questions and answers in `block.settings.items = [{q: "...", a: "..."}]`. `DetailView.tsx` has zero code to render `settings.items` or `faq`, rendering FAQ questions and answers completely invisible.
  3. **Unrendered Settings Items:** Line 972 checks `block.settings?.highlights`. Blocks following the official convention (`meta.content_block_settings_convention`) store arrays under `block.settings.items` (e.g. Suitable For, Highlights, Things to Know, Checklist). Because the code looks specifically for `settings.highlights`, all items under `settings.items` are completely dropped.

### 4. Amenity Grid Icon and Filter Mismatches
- **DetailView Display:** In [`frontend/src/components/DetailView.tsx:121-145`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/DetailView.tsx#L121-L145), the UI maps amenities using `AMENITY_ICONS`. This dictionary contains 22 specific sports/turf-oriented strings (`stadium lighting`, `fifa certified`, `locker rooms`, `shower & changing rooms`, etc.). Any hospitality, banquet, or corporate amenity (such as `Bar Counter`, `In-House Catering`, `Stage & Podium`, `DJ Setup`, `Conference Phone`, `Whiteboard`) falls back to a generic `CheckCircle` icon.
- **Search Filter Failure:** In [`frontend/src/components/FiltersSidebar.tsx:101-135`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/FiltersSidebar.tsx#L101-L135) and [`FiltersSidebar.tsx:276-305`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/FiltersSidebar.tsx#L276-L305), the search filter hardcodes football-specific keys (`freeParking`, `floodlights`, `airConditioning`, `lockerRooms`, `stadiumLighting`). The real backend amenities are stored as dynamic string arrays (`amenity_names`). Because the filter sidebar treats amenities as hardcoded boolean properties of an object, filtering by amenities on search produces broken or non-matching results.

### 5. `reviewCount` is hardcoded to 0
- **Adapter Hardcoding:** [`frontend/src/lib/adapters.ts:80-85`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts#L80-L85):
  ```ts
  // avg_rating/review counts aren't populated by anything yet
  // 0 is the honest real value, not a placeholder standing in for missing data.
  rating: Number(v.avg_rating),
  reviewCount: 0,
  ```
- **Consequence:** Even though the active venues have 3 or 4 verified reviews in the database, `venue.reviewCount` is permanently `0` across the application. [`frontend/src/components/VenueCard.tsx:61`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/VenueCard.tsx#L61) displays the star rating (e.g. `4.5`), but cannot display a review count badge.

### 6. Coordinates and Use Cases are never displayed
- **Coordinates:** `latitude` and `longitude` are stored in `venues` table (`core.py:143-144`) and returned by the API. They are dropped in [`adapters.ts`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts). [`DetailView.tsx`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/DetailView.tsx) provides no map embed, no Google Maps deep-link, and no coordinate display.
- **Use Cases:** Associated via `venue_use_cases` (`core.py:1305-1310`) and returned in `VenueResponse`. Dropped completely by `adaptVenue()`. The tags/badges (e.g., "Wedding", "Corporate Event", "Photoshoot", "Badminton") are not displayed in the venue header or search filters.

### 7. Rental Options and Policies lack dedicated presentation
- **Rental Options:** While multi-mode options (`hour`, `half_day`, `full_day`) are passed into `venue.rentalOptions`, [`DetailView.tsx:219-248`](file:///c:/Users/ACER/code/groundbooking/frontend/src/components/DetailView.tsx#L219-L248) only uses them to populate the unit selection dropdown when initiating a booking. There is no informational pricing grid showing users the available modes, buffer times, or slot durations.
- **Policies:** The cancellation policy is inferred via an ad-hoc regex check on content block text ([`adapters.ts:65`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts#L65)). Detailed operational rules stored in venue data (e.g. deposit requirements, music noise cutoff hours, alcohol restrictions) have no dedicated UI section and are only shown if embedded in the unstructured description text.

### 8. Videos cannot be distinguished from Images
- **Backend Storage:** The media upload route [`POST /api/v1/venues/{venue_id}/images`](file:///c:/Users/ACER/code/groundbooking/backend/app/main.py#L1251) accepts `image: UploadFile`, `is_cover: bool`, and `duration: float | None`, but lacks a `media_type` parameter.
- **Frontend Heuristic:** [`frontend/src/lib/adapters.ts:35-48`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts#L35-L48) implements an extension-matching workaround (`.mp4`, `.webm`, `youtube.com`). If a video is served from cloud storage without a video file extension, the frontend treats it as an image, causing broken image rendering.

### 9. All `sports` venues display as 'Turfs'
- **Adapter Mapping:** [`frontend/src/lib/adapters.ts:20-30`](file:///c:/Users/ACER/code/groundbooking/frontend/src/lib/adapters.ts#L20-L30):
  ```ts
  const CATEGORY_LABELS: Record<string, VenueCategoryLabel> = {
    sports: 'Turfs',
    banquet_hall: 'Banquet Halls',
    farmhouse: 'Farmhouses',
    corporate: 'Corporate Hubs',
    community_hall: 'Community Halls',
  };
  ```
- **Consequence:** Venues belonging to the legacy backend category `sports`—including badminton courts (`Smash Point Badminton Courts`), swimming pools (`Blue Lagoon Pool and Party Deck`), and padel courts (`Koramangala Padel and Pickleball Courts`)—are all labeled as `"Turfs"` across cards, breadcrumbs, and detail pages.
