# GroundKart Demo Dataset Seeding Report

Generated At: 2026-10-20T12:19:38.423909+00:00
Environment: dev
Target Database: localhost:5432/groundbooking

---

## 1. Executive Summary

- **Total Venues:** 14
  - Active: 12
  - Pending Review: 1
  - Rejected: 1
- **Owners Created / Verified:** 5
- **Customers Created:** 10
- **Reviews Created:** 39
- **Booking Scenarios Executed:** 8
- **Overall Data Verification:** **ALL CHECKS PASSED (100%)**

---

## 2. Venue Completeness & Verification Matrix

| Venue Ref | Target Status | Status Check | Core Fields & Desc (>=80w) | Media (5, 1 cover) | Content Blocks (>=4) | Amenities (>=8) | Taxonomy & Coords | Inventory & Reviews | Generated Fields | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| `v_gomti_greens` | `active` | PASS (active) | PASS (105w, cap 800) | PASS (5 media, 1 cover) | PASS (6 blocks) | PASS (13 amen) | PASS (6 use-cases) | PASS (58 slots, 4 revs, avg 4.50) | None (Complete) | **PASS** |
| `v_nawabi_mahal` | `active` | PASS (active) | PASS (100w, cap 600) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (12 amen) | PASS (4 use-cases) | PASS (72 slots, 3 revs, avg 4.67) | None (Complete) | **PASS** |
| `v_mango_grove` | `active` | PASS (active) | PASS (103w, cap 300) | PASS (5 media, 1 cover) | PASS (6 blocks) | PASS (12 amen) | PASS (5 use-cases) | PASS (59 slots, 3 revs, avg 4.33) | content_blocks | **PASS** |
| `v_skyline_terrace` | `pending_review` | PASS (pending_review) | PASS (96w, cap 120) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (10 amen) | PASS (4 use-cases) | PASS (0 slots, 0 revs) | content_blocks | **PASS** |
| `v_shanti_bhavan` | `active` | PASS (active) | PASS (91w, cap 250) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (10 amen) | PASS (4 use-cases) | PASS (58 slots, 3 revs, avg 4.00) | content_blocks | **PASS** |
| `v_awadh_sports_arena` | `active` | PASS (active) | PASS (90w, cap 22) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (11 amen) | PASS (4 use-cases) | PASS (213 slots, 4 revs, avg 4.50) | content_blocks | **PASS** |
| `v_smash_point` | `active` | PASS (active) | PASS (89w, cap 8) | PASS (5 media, 1 cover) | PASS (6 blocks) | PASS (9 amen) | PASS (3 use-cases) | PASS (168 slots, 3 revs, avg 4.33) | content_blocks, content_blocks | **PASS** |
| `v_blue_lagoon` | `active` | PASS (active) | PASS (92w, cap 60) | PASS (5 media, 1 cover) | PASS (6 blocks) | PASS (10 amen) | PASS (3 use-cases) | PASS (33 slots, 3 revs, avg 4.33) | content_blocks, content_blocks | **PASS** |
| `v_capital_conference` | `active` | PASS (active) | PASS (101w, cap 120) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (12 amen) | PASS (4 use-cases) | PASS (44 slots, 4 revs, avg 4.75) | None (Complete) | **PASS** |
| `v_cowork_atelier` | `active` | PASS (active) | PASS (87w, cap 10) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (9 amen) | PASS (3 use-cases) | PASS (210 slots, 3 revs, avg 4.33) | content_blocks | **PASS** |
| `v_aravali_turf` | `active` | PASS (active) | PASS (93w, cap 18) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (9 amen) | PASS (3 use-cases) | PASS (146 slots, 3 revs, avg 4.33) | content_blocks | **PASS** |
| `v_amber_courtyard` | `active` | PASS (active) | PASS (97w, cap 400) | PASS (5 media, 1 cover) | PASS (6 blocks) | PASS (12 amen) | PASS (4 use-cases) | PASS (87 slots, 3 revs, avg 4.67) | None (Complete) | **PASS** |
| `v_bandra_loft` | `active` | PASS (active) | PASS (97w, cap 25) | PASS (5 media, 1 cover) | PASS (5 blocks) | PASS (10 amen) | PASS (4 use-cases) | PASS (189 slots, 3 revs, avg 4.67) | content_blocks | **PASS** |
| `v_koramangala_padel` | `rejected` | PASS (draft) | PASS (85w, cap 8) | PASS (5 media, 1 cover) | PASS (6 blocks) | PASS (9 amen) | PASS (3 use-cases) | PASS (0 slots, 0 revs) | content_blocks, content_blocks, content_blocks | **PASS** |

---

## 3. Dynamically Generated Values Log (Section 4 Compliance)

The following fields were synthesized or augmented deterministically to satisfy GroundKart's minimum completeness invariants:

| Venue Ref | Field | Reason | Generated Value / Summary |
|---|---|---|---|
| `v_mango_grove` | `content_blocks` | Generated missing Suitable For block | `Ideal Gatherings & Use Cases` |
| `v_skyline_terrace` | `content_blocks` | Generated missing FAQ block with 2 questions | `Frequently Asked Questions` |
| `v_shanti_bhavan` | `content_blocks` | Generated missing Suitable For block | `Ideal Gatherings & Use Cases` |
| `v_awadh_sports_arena` | `content_blocks` | Generated missing Suitable For block | `Ideal Gatherings & Use Cases` |
| `v_smash_point` | `content_blocks` | Generated missing Venue Story block | `About Our Space` |
| `v_smash_point` | `content_blocks` | Generated missing Suitable For block | `Ideal Gatherings & Use Cases` |
| `v_blue_lagoon` | `content_blocks` | Generated missing Venue Story block | `About Our Space` |
| `v_blue_lagoon` | `content_blocks` | Generated missing Suitable For block | `Ideal Gatherings & Use Cases` |
| `v_cowork_atelier` | `content_blocks` | Generated missing Venue Story block | `About Our Space` |
| `v_aravali_turf` | `content_blocks` | Generated missing Venue Story block | `About Our Space` |
| `v_bandra_loft` | `content_blocks` | Generated missing Venue Story block | `About Our Space` |
| `v_koramangala_padel` | `content_blocks` | Generated missing Venue Story block | `About Our Space` |
| `v_koramangala_padel` | `content_blocks` | Generated missing Suitable For block | `Ideal Gatherings & Use Cases` |
| `v_koramangala_padel` | `content_blocks` | Added 2nd question to existing FAQ block | `Can we inspect the venue prior to confirmation?` |

---

## 4. Test Credentials

All demo accounts share the standard password defined in `meta.demo_password_for_all_demo_users`.

- **Admin Account:**
  - Login ID: `admin@groundkart.demo`
  - Password: `Admin@2026!`
  - Role: `admin`
- **Sample Owner Account:**
  - Name: `Anita Srivastava`
  - Phone: `9000010001`
  - Email: `anita.srivastava@groundkart.demo`
  - Password: `Demo@2026!`
  - Role: `owner` (Verified)
- **Sample Customer Account:**
  - Name: `Arjun Kumar`
  - Phone: `9000020001`
  - Email: `arjun.kumar@groundkart.demo`
  - Password: `Demo@2026!`
  - Role: `customer`

---

## 5. Execution & Rerun Commands

### Run Seeder
```powershell
python backend/scripts/seed_dataset.py --yes-this-is-dev
```

### Dry Run (Validation only)
```powershell
python backend/scripts/seed_dataset.py --yes-this-is-dev --dry-run
```

### Full Demo Cleanup
```powershell
python backend/scripts/seed_cleanup_dataset.py --yes-this-is-dev
```
