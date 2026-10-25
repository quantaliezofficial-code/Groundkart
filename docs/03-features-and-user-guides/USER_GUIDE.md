# GroundKart / GroundBooking — Comprehensive User Guide

This user guide provides practical, step-by-step instructions for all three platform user roles:
1. **Customers & Guests** (Finding, reserving, paying, and managing bookings)
2. **Venue Owners** (Listing spaces, setting calendar availability, managing pricing, and tracking earnings)
3. **Platform Administrators** (Moderating listings, approving KYC, confirming payments, managing payouts, and handling support)

---

## Part 1: Customer & Guest User Guide

### 1.1 Searching for a Venue
1. Navigate to the GroundKart homepage (`/`).
2. In the hero search section, enter your search criteria:
   - **City / Location:** Type your city or neighborhood (e.g., "Lucknow", "Metropolis").
   - **Date:** Select the date you intend to reserve.
   - **Category:** Choose a venue category from the dropdown (e.g., "Sports Grounds", "Banquet Halls", "Corporate Spaces", "Farmhouses").
3. Click the **Search Venues** button. You will be directed to the `/search` catalog page with your filters applied.
4. Alternatively, click any category pill on the homepage banner to quickly browse by category.

### 1.2 Filtering & Refining Results
On the `/search` page, use the **Filters Sidebar** (accessible via the floating "Filters" button on mobile):
- **Price Range (₹):** Enter minimum and maximum hourly or daily rental amounts.
- **Amenities:** Select checkboxes for required facilities:
  - *Free Parking*
  - *Floodlights*
  - *Air Conditioning*
  - *Locker Rooms / Bathrooms*
- **Capacity Group:** Filter by gathering size (e.g., Up to 50 guests, 50-200, 200+).
- **Minimum Rating:** Select a star threshold (e.g., 4+ Stars).
- **Reset Filters:** Click **Reset Filters** at any time to clear your criteria.

### 1.3 Viewing Venue Details & Exploring Media
1. Click on any venue card in the catalog to open its detail page (`/venues/:slug-or-id`).
2. **Photo Gallery:**
   - Click the main cover image or any thumbnail to open the **Fullscreen Lightbox**.
   - Use the arrow keys or click the left/right chevrons to browse high-definition photos and videos.
   - Press `Escape` or click the `X` button to close the lightbox.
3. **Venue Details:**
   - Read the venue description, capacity limits, and operating guidelines.
   - Review the **Content Blocks** (Highlights, Venue Story, Rules, FAQs, Things to Know, and Suitable For).
   - Check the **Amenities** grid to see verified facilities.

### 1.4 Selecting a Slot and Initiating a Booking
1. Scroll down to the **Select Date & Available Slots** section on the detail page.
2. Select your desired event date using the date selector.
3. Review the available slots:
   - **Green Badge ("Available"):** The slot is open for reservation.
   - **Orange Badge ("Held"):** The slot is temporarily held by another customer.
   - **Gray Badge ("Booked"):** The slot has already been reserved.
4. Click on an available slot. The slot price and details will highlight.
5. Click **Reserve Slot**.
   - If not logged in, you can either sign in or continue as a **Guest**.
   - The system locks the slot for you for **10 minutes** to prevent double-booking.

### 1.5 Review & Pay (Checkout)
1. On the `/checkout` screen, review your reservation summary:
   - Venue name, address, and rental unit type.
   - Selected date and slot duration.
   - Total base price and breakdown.
2. If checking out as a Guest, enter:
   - Full Name
   - Email Address (used to receive your secure booking management link)
   - Phone Number
   - Optional: Number of guests attending and special requests/notes.
3. Review the **Cancellation Policy** disclosure.
4. Click **Confirm & Reserve**.
5. **Payment Instructions:**
   - GroundKart currently operates on an offline payment confirmation model.
   - The confirmation screen provides the booking reference number and payment instructions (bank transfer or UPI).
   - A 10-minute countdown timer displays your reservation hold window.
   - Once payment is verified by our administrative team, your booking status automatically updates to **Confirmed**.

### 1.6 Managing Your Bookings ("My Bookings")
1. Log in to your account and click **My Bookings** in the top navigation header (`/my-bookings`).
   - If you booked as a guest, click the secure link in your confirmation email (`/bookings/manage/:token`).
2. Review your active, upcoming, and past reservations.
3. **Cancelling a Booking:**
   - Click **Cancel Booking** on any confirmed reservation.
   - The system displays the automated refund tier based on how far in advance you cancel:
     - *48+ hours before event:* **100% Full Refund**
     - *24 to 48 hours before event:* **50% Partial Refund**
     - *Less than 24 hours:* **No Refund**
   - Click **Confirm Cancellation**. The slot is immediately freed for other customers, and your refund is recorded.
4. **Rebooking:** Click **Book Again** to immediately reopen the venue detail page.

### 1.7 Submitting Reviews & Support Requests
- **Leave a Review:** On the venue detail page, scroll to the **Customer Reviews** section, select a star rating (1 to 5 stars), enter your feedback, and click **Submit Review**.
- **Contact Support:** Click **Support** in the navigation header or click "Need Help with this Booking?" on any reservation card to open a threaded support ticket (`/support`).

---

## Part 2: Venue Owner User Guide

### 2.1 Owner Onboarding & KYC Verification
1. Click **List Your Venue** in the header.
2. Sign up or log in. You will land on the **Owner Onboarding Gate**.
3. Complete the verification form:
   - **Business or Legal Entity Name**
   - **Identification Type:** Select *National ID (Aadhaar / PAN)*, *Passport*, or *Business Registration*.
   - **Identification Number**
   - **Upload ID Document:** Attach a clear PDF, JPEG, or PNG document.
4. Click **Submit for Verification**. Platform administrators will review your document within 24 hours.

### 2.2 Navigating the Owner Dashboard (`/owner`)
Once verified, the Owner Dashboard provides 6 operational tabs:
1. **Overview:** View gross revenue, net payouts, total confirmed bookings, active venue count, and recent reservations.
2. **Listings:** View all your properties, filter by status (`Active`, `Draft`, `Pending Review`, `Rejected`), and launch the Listing Builder.
3. **Calendars:** Visual calendar view showing booked, held, and available slots across all properties.
4. **Payouts:** View your escrow balance, available funds, and history of completed bank disbursements.
5. **Support:** View and reply to customer inquiries related to your venues.
6. **Account:** Manage your payout bank account details (Account Number, IFSC, Account Holder Name).

### 2.3 Creating a New Venue Listing (12-Step Listing Builder)
From the **Listings** tab, click **+ Add New Venue** to open the step-by-step wizard:
- **Step 1: Identity:** Enter venue name, short display name, marketing tagline, description (minimum 80 words recommended), and total capacity.
- **Step 2: Location:** Enter physical street address, city, state, pincode, and nearby landmark.
- **Step 3: Category & Space Types:** Select main category (Sports, Banquets, Corporate) and multi-select space types (e.g., Badminton Court, Rooftop Lawn).
- **Step 4: Purposes:** Select allowed activities (e.g., Wedding Receptions, Cricket Matches, Corporate Meetings).
- **Step 5: Rental Setup:** Choose rental modes (Hourly, Half-day, Full-day) and set standard base prices.
- **Step 6: Pricing Rules:** (Optional) Add dynamic surge multipliers for weekends or peak evening hours.
- **Step 7: Availability:** Configure operating hours (e.g., 06:00 to 23:00) and slot intervals (e.g., 60-minute blocks).
- **Step 8: Amenities:** Check off available facilities (Generator backup, changing rooms, air conditioning, parking).
- **Step 9: Policies:** Set house rules, entry policies, and select a cancellation policy tier.
- **Step 10: Photos & Videos:** Upload at least 3 high-resolution photos. Set one as the primary Cover Photo. Upload an optional venue walkthrough video (minimum 10 seconds).
- **Step 11: Content Blocks:** Populate Highlights, FAQs, Venue Story, Rules, and "Suitable For" sections.
- **Step 12: Review & Submit:** Review the completeness checklist. Click **Submit for Review**. The listing transitions to `pending_review` for administrator approval.

### 2.4 Managing the Venue Workspace
Click **Manage Venue** on any listing to open the **Venue Workspace**:
- **Pause Venue:** Temporarily hide the venue from public search results without deleting data.
- **Unpause Venue:** Restore an active venue to public search.
- **Block Custom Slots:** Select specific dates and time slots to block for private maintenance or offline bookings.
- **Update Pricing:** Adjust base hourly rates or add seasonal surge rules.

---

## Part 3: Administrator Command Center Guide (`/admin`)

Access to the Admin Dashboard requires an account with the `admin` role.

### 3.1 Reviewing and Approving Venue Listings
1. Navigate to the **Approval Queue** tab.
2. Under **Pending Venues**, click **Review** on any submitted listing.
3. Inspect photos, address, capacity, pricing, and content completeness.
4. Click **Approve Venue** to publish the venue live to the public catalog.
5. If issues exist, click **Reject Venue**, enter a detailed rejection reason (e.g., "Please provide higher-resolution exterior photos"), and submit. The owner will see this feedback in their dashboard.

### 3.2 Reviewing Owner KYC Verifications
1. In the **Approval Queue** tab, scroll to **Owner Verifications**.
2. Click **View Document** to securely inspect the uploaded identification document.
3. Compare the business name and ID number against the document.
4. Click **Approve** to grant the user full Owner listing privileges, or **Reject** with notes.

### 3.3 Confirming Offline Payments & Booking Reconciliation
1. Navigate to the **Bookings** tab.
2. Locate bookings with status `pending_payment`.
3. Verify receipt of payment via bank statement or UPI reference.
4. Click **Confirm Payment**.
   - Booking status immediately transitions to `confirmed`.
   - The inventory unit transitions to `booked`.
   - Balanced records are automatically emitted in the double-entry financial ledger.
   - Customer is notified via in-app and outbox event notification.

### 3.4 Disbursing Owner Payouts
1. Navigate to the **Payouts** tab.
2. Click **Run Payout Batch**: The system calculates all net earnings owed to owners for completed events (Gross minus Platform Commission).
3. Review the generated payout entries and verify owner bank details.
4. After transferring funds via bank portal, click **Mark Paid** on the payout record to finalize the transaction in the ledger.

### 3.5 Managing Platform Editorial & Homepage Placements
1. Navigate to the **Homepage** tab.
2. Select **Featured Arena**: Pick any active venue to feature in the high-visibility hero banner, set custom badges (e.g., "FEATURED ARENA"), and enter editorial headlines.
3. Configure **Trending in Metropolis**: Reorder or pin top venues to the trending carousel.
4. Click **Save Changes** to immediately update the live homepage.
