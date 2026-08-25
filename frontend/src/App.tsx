import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, CheckCircle, ArrowRight, Sparkles, Filter, Heart, RefreshCw, Eye, Landmark, Settings } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import Header from './components/Header';

// Reusable scroll-reveal wrapper
function ScrollReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
import Hero from './components/Hero';
import VenueCard from './components/VenueCard';
import FiltersSidebar from './components/FiltersSidebar';
import AuthModal from './components/AuthModal';
import { mockVenues } from './data';

import { useAuth } from './lib/auth';
import { useVenues, useVenue, useVenueSlots } from './hooks/useVenues';
import { useMyBookings, useCreateBooking, useCancelBooking } from './hooks/useBookings';

// Lazy loading large sub-views to optimize first-load bundle size and protect the main thread
const DetailView = React.lazy(() => import('./components/DetailView'));
const ReviewPay = React.lazy(() => import('./components/ReviewPay'));
const OwnerLayout = React.lazy(() => import('./components/OwnerLayout'));
const AdminLayout = React.lazy(() => import('./components/AdminLayout'));
const MyBookings = React.lazy(() => import('./components/MyBookings'));

// Reusable custom skeleton loaders to ensure no layout shift (CLS) and premium perceived speed
function DashboardSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full animate-pulse">
      {/* Sidebar navigation skeleton */}
      <div className="w-full lg:w-64 shrink-0 bg-surface border border-ink/10 rounded-2xl p-5 flex flex-col gap-6 shadow-xs h-[300px]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#E3EAE5]" />
          <div className="space-y-2 flex-grow">
            <div className="h-4 bg-[#E3EAE5] rounded w-2/3" />
            <div className="h-3 bg-[#E3EAE5] rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-3 pt-4 border-t border-ink/5 pt-4">
          <div className="h-9 bg-[#E3EAE5] rounded-lg w-full" />
          <div className="h-9 bg-[#E3EAE5] rounded-lg w-full" />
          <div className="h-9 bg-[#E3EAE5] rounded-lg w-full" />
        </div>
      </div>
      {/* Main Content Area skeleton */}
      <div className="flex-grow space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 bg-[#E3EAE5] rounded w-64" />
            <div className="h-4 bg-[#E3EAE5] rounded w-96" />
          </div>
          <div className="h-10 bg-[#E3EAE5] rounded w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-[#E3EAE5] border border-ink/10 rounded-2xl" />
          <div className="h-28 bg-[#E3EAE5] border border-ink/10 rounded-2xl" />
          <div className="h-28 bg-[#E3EAE5] border border-ink/10 rounded-2xl" />
        </div>
        <div className="h-96 bg-[#E3EAE5] rounded-2xl border border-ink/10" />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-8 animate-pulse w-full">
      <div className="h-6 bg-[#E3EAE5] rounded w-24 mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="h-[380px] bg-[#E3EAE5] rounded-2xl w-full" />
          <div className="space-y-4">
            <div className="h-10 bg-[#E3EAE5] rounded w-3/4" />
            <div className="h-4 bg-[#E3EAE5] rounded w-1/2" />
            <div className="h-20 bg-[#E3EAE5] rounded w-full" />
          </div>
        </div>
        <div className="lg:col-span-4 h-[450px] bg-[#E3EAE5] rounded-xl border border-ink/10 p-6" />
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="space-y-8 animate-pulse w-full">
      <div className="h-6 bg-[#E3EAE5] rounded w-36" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="h-48 bg-[#E3EAE5] rounded-2xl" />
          <div className="h-36 bg-[#E3EAE5] rounded-2xl" />
        </div>
        <div className="lg:col-span-4 h-96 bg-[#E3EAE5] rounded-2xl" />
      </div>
    </div>
  );
}

function MyBookingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse w-full">
      <div className="h-8 bg-[#E3EAE5] rounded w-48 mb-2" />
      <div className="h-4 bg-[#E3EAE5] rounded w-72 mb-6" />
      <div className="space-y-4">
        <div className="h-40 bg-[#E3EAE5] rounded-xl" />
        <div className="h-40 bg-[#E3EAE5] rounded-xl" />
      </div>
    </div>
  );
}

export default function App() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Global Perspective Role SWITCHER state — dev-only, gated below; real
  // customers never see this. Both Owner and Admin dashboards are now
  // wired to real data (see the effect just below, which syncs this to
  // the real authenticated user's role) — PerspectiveSwitcher exists
  // purely as a dev convenience for jumping between roles without
  // separate logins, not as anything load-bearing for either dashboard.
  const [activeRole, setActiveRole] = useState<'client' | 'owner' | 'admin'>(() => {
    const saved = localStorage.getItem('groundbooking_active_role');
    return (saved as any) || 'client';
  });

  // Keeps activeRole honest against the real authenticated user, rather
  // than leaving PerspectiveSwitcher as the only thing that ever sets it:
  // a real owner/admin logging in lands straight in their own dashboard,
  // and logging out (or a session that fails to restore) always falls
  // back to 'client' rather than possibly getting stuck showing an
  // owner/admin shell to nobody. Deliberately only reacts to isLoading
  // and role — not user overall — so a real owner who clicks "Explore"
  // to browse as a customer isn't yanked back into their dashboard on
  // every unrelated re-render; they return to it via Header's own CTA.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setActiveRole('client');
      return;
    }
    if (user.role === 'owner' || user.role === 'admin') {
      setActiveRole(user.role);
    }
  }, [isAuthLoading, user?.role]);

  // Real venue catalogue — replaces the old localStorage-backed mock
  // state for the customer-facing experience. searchParams below is kept
  // deliberately small (server-side filtering only for what the backend
  // actually supports); amenity/rating/capacity filters still narrow the
  // *client-side* list the same way they did against mock data, just now
  // starting from a real list instead of a hardcoded one.
  const [searchParams, setSearchParams] = useState<{ city?: string; category?: string; available_on?: string }>({});
  const { venues: realVenues, isLoading: isVenuesLoading } = useVenues(searchParams);

  // Real "My Bookings" — replaces the old localStorage-backed mock list
  // for the customer-facing experience. Only fetches once a real user is
  // logged in (see useMyBookings — guest bookings aren't listable this
  // way at all, by design).
  const { bookings: realBookings, refetch: refetchMyBookings } = useMyBookings();
  const createBookingMutation = useCreateBooking();
  const cancelBookingMutation = useCancelBooking();

  // Login/signup modal — opened from Header's "Log in" button, or
  // whenever a guarded action (checkout, My Bookings) needs a real user
  // and there isn't one yet.
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null);
  // Set right before opening the auth modal from a guarded action, so
  // login/signup can resume exactly what the person was trying to do.
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Navigation & Primary State
  const [currentView, setCurrentView] = useState<'home' | 'search' | 'detail' | 'checkout' | 'my-bookings'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Hero inputs
  const [locationInput, setLocationInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  // Filters state
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState({
    freeParking: false,
    floodlights: false,
    airConditioning: false,
    lockerRooms: false
  });
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [selectedRating, setSelectedRating] = useState<number>(0);

  // Dynamic booking transactions state
  const [selectedVenueId, setSelectedVenueId] = useState('grand-turf-arena');
  const [selectedSlot, setSelectedSlot] = useState('20:00');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState('2024-10-24');

  // Favorites persistence
  const [favorites, setFavorites] = useState<string[]>([
    'grand-turf-arena',
    'skyline-tennis-courts'
  ]);

  // UI States
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize state value writes to LocalStorage to retain cross-role testing inputs
  useEffect(() => {
    localStorage.setItem('groundbooking_active_role', activeRole);
  }, [activeRole]);

  // Scroll to top on view changes to mirror SPA transitions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentView, selectedVenueId, activeRole]);

  // Opens the auth modal and remembers what to do once login/signup
  // actually succeeds — so "log in" doesn't strand the person back at a
  // blank screen having lost whatever they were trying to do.
  function requireAuth(action: () => void) {
    if (user) {
      action();
      return;
    }
    setPendingAction(() => action);
    setAuthModalMode('login');
  }

  // Handle favorite toggles
  const handleToggleFavorite = (venueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(venueId) ? prev.filter((id) => id !== venueId) : [...prev, venueId]
    );
  };

  // Switch category categories and query from hero
  // Reverse of the backend->display mapping in src/lib/adapters.ts —
  // needed here to turn a chosen display category back into the value
  // the real search endpoint actually filters on.
  const DISPLAY_TO_BACKEND_CATEGORY: Record<string, string> = {
    'Turfs': 'sports',
    'Courts': 'sports',
    'Pools': 'sports',
    'Banquet Halls': 'banquet_hall',
    'Farmhouses': 'farmhouse',
    'Corporate Hubs': 'corporate',
    'Community Halls': 'community_hall',
  };

  const handleSearchSubmit = () => {
    setIsLoading(true);
    setCurrentView('search');
    setSearchParams({
      city: locationInput || undefined,
      category: categoryInput ? DISPLAY_TO_BACKEND_CATEGORY[categoryInput] : undefined,
      available_on: dateInput || undefined,
    });
    setTimeout(() => {
      setIsLoading(false);
    }, 650);
  };

  // Navigating categories directly from index layout
  const handleCategoryTileClick = (categoryName: 'Turfs' | 'Banquet Halls' | 'Courts' | 'Pools' | 'Farmhouses' | 'Corporate Hubs') => {
    setIsLoading(true);
    setCategoryInput(categoryName);
    
    // Reset filters and configure category choice
    setMinPrice('');
    setMaxPrice('');
    setSelectedCapacity('');
    setSelectedRating(0);
    setSelectedAmenities({
      freeParking: false,
      floodlights: false,
      airConditioning: false,
      lockerRooms: false
    });

    setCurrentView('search');
    setSearchParams({ category: DISPLAY_TO_BACKEND_CATEGORY[categoryName] });
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  // Initiate dynamic booking pipeline
  const handleInitiateBooking = (slot: string, date: string, slotId: string) => {
    setSelectedSlot(slot);
    setBookingDate(date);
    setSelectedSlotId(slotId);
    setCurrentView('checkout');
  };

  // Handle sidebar toggling
  const handleAmenityToggle = (key: 'freeParking' | 'floodlights' | 'airConditioning' | 'lockerRooms') => {
    setSelectedAmenities((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleClearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setSelectedCapacity('');
    setSelectedRating(0);
    setSearchQuery('');
    setCategoryInput('');
    setSelectedAmenities({
      freeParking: false,
      floodlights: false,
      airConditioning: false,
      lockerRooms: false
    });
  };

  // Filter Catalog dynamically — now over the real venue list. Amenity/
  // capacity/rating filters still narrow client-side (the backend search
  // endpoint doesn't take those params); city/category/date narrow via
  // searchParams -> a real server-side query instead.
  const filteredVenues = useMemo(() => {
    return realVenues.filter((venue) => {
      // 1. Text Search matches Name, District, and Sport types
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = venue.name.toLowerCase().includes(query);
        const matchesDistrict = venue.district.toLowerCase().includes(query);
        const matchesSport = venue.sportType.toLowerCase().includes(query);
        const matchesCategory = venue.category.toLowerCase().includes(query);
        if (!matchesName && !matchesDistrict && !matchesSport && !matchesCategory) {
          return false;
        }
      }

      // 2. Min Price matches
      if (minPrice && venue.pricePerHour < parseFloat(minPrice)) {
        return false;
      }

      // 3. Max Price matches
      if (maxPrice && venue.pricePerHour > parseFloat(maxPrice)) {
        return false;
      }

      // 4. Amenities check checks
      if (selectedAmenities.freeParking && !venue.amenities.freeParking) {
        return false;
      }
      if (selectedAmenities.floodlights && !venue.amenities.floodlights) {
        return false;
      }
      if (selectedAmenities.airConditioning && !venue.amenities.airConditioning) {
        return false;
      }
      if (selectedAmenities.lockerRooms && !venue.amenities.lockerRooms) {
        return false;
      }

      // 5. Capacity filters
      if (selectedCapacity && venue.capacityGroup !== selectedCapacity) {
        return false;
      }

      // 6. Rating selector
      if (selectedRating && venue.rating < selectedRating) {
        return false;
      }

      return true;
    });
  }, [
    realVenues,
    searchQuery,
    minPrice,
    maxPrice,
    selectedAmenities,
    selectedCapacity,
    selectedRating
  ]);

  // Real venue + real slots for the currently-open detail/checkout view —
  // fetched directly by id rather than found within the (possibly
  // stale, possibly not-yet-loaded) search results list, so a direct
  // venue link always resolves correctly.
  const { venue: activeVenueFromApi } = useVenue(currentView === 'detail' || currentView === 'checkout' ? selectedVenueId : undefined);
  const { slots: activeVenueSlots } = useVenueSlots(currentView === 'detail' ? selectedVenueId : undefined);
  const activeVenueObj = activeVenueFromApi || realVenues.find((v) => v.id === selectedVenueId) || realVenues[0] || mockVenues[0];

  // Admin featured banner configuration or default to grand turf
  const featuredVenueObj = useMemo(() => {
    return realVenues[0] || mockVenues[0];
  }, [realVenues]);

  // State-aware trending list feed
  const trendingVenues = useMemo(() => {
    return realVenues.filter((v) => v.id !== featuredVenueObj?.id).slice(0, 4);
  }, [realVenues, featuredVenueObj]);

  return (
    <div className="bg-mist text-ink font-sans min-h-screen flex flex-col antialiased">
      
      {/* Global Transparent Sticky Header */}
      <Header
        currentView={activeRole !== 'client' ? 'home' : currentView}
        onNavigate={(view) => {
          setActiveRole('client');
          if (view === 'search') {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
          }
          setCurrentView(view);
        }}
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setActiveRole('client');
          if (currentView !== 'search') {
            setCurrentView('search');
          }
        }}
        onListVenue={() => {
          requireAuth(() => setActiveRole(user?.role === 'admin' ? 'admin' : 'owner'));
        }}
        onRequestAuth={() => setAuthModalMode('login')}
      />

      {authModalMode && (
        <AuthModal
          mode={authModalMode}
          onClose={() => {
            setAuthModalMode(null);
            setPendingAction(null);
          }}
          onSwitchMode={(mode) => setAuthModalMode(mode)}
          onSuccess={(signupRole) => {
            setAuthModalMode(null);
            if (signupRole === 'owner') {
              setActiveRole('owner');
            } else if (pendingAction) {
              pendingAction();
              setPendingAction(null);
            }
          }}
        />
      )}

      {/* Main Canvas Segment */}
      <main className="flex-grow flex flex-col">
        
        {/* ================= ROLE CONDITIONAL ROUTER ================= */}
        {activeRole === 'owner' ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
            <React.Suspense fallback={<DashboardSkeleton />}>
              <OwnerLayout />
            </React.Suspense>
          </div>
        ) : activeRole === 'admin' ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
            <React.Suspense fallback={<DashboardSkeleton />}>
              <AdminLayout />
            </React.Suspense>
          </div>
        ) : (
          <>
            {/* ================= VIEW 1: HOME PAGE ================= */}
            {currentView === 'home' && (
              <div className="flex-grow pb-16">
                
                {/* Ambient Hero with Floating Widget */}
                <Hero
                  locationInput={locationInput}
                  onLocationChange={setLocationInput}
                  dateInput={dateInput}
                  onDateChange={setDateInput}
                  categoryInput={categoryInput}
                  onCategoryChange={setCategoryInput}
                  onSearchSubmit={handleSearchSubmit}
                />

                {/* Main Home Page Body */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-24 space-y-16">
                  
                  {/* Divider lines */}
                  <div className="boundary-line-double">
                    <div className="top" />
                    <div className="bottom" />
                  </div>

                  {/* Title Header Section */}
                  <section>
                    <ScrollReveal>
                    <div className="flex justify-between items-end mb-8 relative">
                      <div className="relative z-10">
                        <h2 className="font-display text-3xl sm:text-4xl text-ink font-semibold mb-1 relative inline-block">
                          Trending in Metropolis
                          <div className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gradient-to-r from-pitch to-marigold rounded-full opacity-80"></div>
                        </h2>
                        <p className="font-sans text-sm text-on-surface-variant font-medium mt-4">
                          Top-rated spaces filling up fast. Tap to explore details.
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setCategoryInput('');
                          setCurrentView('search');
                        }}
                        className="hidden md:flex items-center gap-1.5 font-sans text-sm font-bold text-pitch hover:text-marigold group cursor-pointer transition-colors px-4 py-2 rounded-full hover:bg-pitch/5"
                      >
                        <span>View all trending</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </motion.button>
                    </div>
                    </ScrollReveal>

                    {/* Horizontal Category Chips Rail for Mobile */}
                    <div className="md:hidden flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
                      {(['Turfs', 'Banquet Halls', 'Courts', 'Farmhouses'] as const).map((cat, idx) => (
                        <ScrollReveal key={cat} delay={idx * 0.1}>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCategoryTileClick(cat)}
                            className="shrink-0 bg-chalk/80 backdrop-blur-md border border-ink/5 text-pitch font-sans text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm hover:bg-mist transition-all focus:ring-2 focus:ring-marigold focus:outline-none"
                          >
                            {cat}
                          </motion.button>
                        </ScrollReveal>
                      ))}
                    </div>

                    {/* Dynamic Hero featured grid */}
                    <ScrollReveal delay={0.1}>
                    <div 
                      onClick={() => {
                        setSelectedVenueId(featuredVenueObj.id);
                        setCurrentView('detail');
                      }}
                      className="relative bg-[#143828] rounded-3xl overflow-hidden tracking-tight shadow-2xl shadow-pitch/10 border border-white/10 group cursor-pointer mb-10 animate-fade-in hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-chalk/10 to-transparent pointer-events-none"></div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
                        <div className="md:col-span-7 relative aspect-[16/9] md:aspect-auto md:h-[400px] overflow-hidden">
                          <img
                            src={featuredVenueObj.image}
                            alt={featuredVenueObj.name}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#143828] via-transparent to-transparent opacity-90"></div>
                          <span className="absolute top-4 left-4 bg-marigold text-pitch text-xs uppercase font-bold tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                            <Sparkles size={14} /> FEATURED ARENA
                          </span>
                        </div>
                        <div className="md:col-span-5 flex flex-col justify-between p-6 sm:p-8 relative z-10 text-chalk">
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-xs uppercase font-sans tracking-widest font-bold text-marigold truncate max-w-[200px]">{featuredVenueObj.district}</span>
                              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-marigold text-xs font-bold font-sans backdrop-blur-sm">
                                <span>★ {featuredVenueObj.rating}</span>
                              </div>
                            </div>
                            <h3 className="font-display text-3xl sm:text-4xl text-chalk font-bold mb-3 drop-shadow-md">{featuredVenueObj.name}</h3>
                            <p className="font-sans text-sm text-chalk/80 leading-relaxed mb-6 truncate text-wrap line-clamp-4 font-light">
                              {featuredVenueObj.description}
                            </p>
                          </div>
                          <div className="pt-5 border-t border-white/10 flex justify-between items-end">
                            <div>
                              <span className="font-sans text-[10px] text-chalk/60 uppercase font-semibold tracking-wider">Starting at</span>
                              <p className="font-sans text-2xl text-marigold font-bold mt-0.5">₹{featuredVenueObj.pricePerHour}<span className="text-sm text-chalk/60 font-normal">/hr</span></p>
                            </div>
                            <span className="bg-gradient-to-r from-marigold to-amber-500 text-pitch text-sm font-bold px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-shadow">
                              View Details
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    </ScrollReveal>

                    {/* Sub grid list for home trending items */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {trendingVenues.map((venue, idx) => (
                        <ScrollReveal key={venue.id} delay={idx * 0.08}>
                          <VenueCard
                            venue={venue}
                            onClick={(id) => {
                              setSelectedVenueId(id);
                              setCurrentView('detail');
                            }}
                            onToggleFavorite={handleToggleFavorite}
                            isFavorite={favorites.includes(venue.id)}
                          />
                        </ScrollReveal>
                      ))}
                    </div>
                  </section>

                  {/* Parallel boundary lines */}
                  <div className="boundary-line-double">
                    <div className="top" />
                    <div className="bottom" />
                  </div>

                  {/* Bento Grid illustration section */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8">
                    
                    {/* description columns */}
                    <ScrollReveal className="lg:col-span-4 flex flex-col justify-center space-y-5">
                      <h2 className="font-display text-3xl sm:text-5xl text-ink font-semibold leading-tight animate-fade-in">
                        Host your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-pitch to-marigold">grand event.</span>
                      </h2>
                      <p className="font-sans text-sm sm:text-base text-on-surface-variant leading-relaxed">
                        Beyond the pitch, GroundBooking offers unparalleled access to premium banquet halls and sprawling farmhouses perfect for weddings, corporate offsites, and milestone celebrations.
                      </p>
                      
                      {/* checked values checklist lists */}
                      <ul className="space-y-4 font-sans text-sm text-ink pt-3">
                        <li className="flex items-start gap-3">
                          <CheckCircle size={20} className="text-marigold flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-pitch">Verified Premium Venues</h4>
                            <p className="text-xs text-on-surface-variant mt-0.5">Handpicked spaces meeting strict quality standards.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle size={20} className="text-marigold flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-pitch">Transparent Pricing</h4>
                            <p className="text-xs text-on-surface-variant mt-0.5">No hidden booking or technical fees. What you see is what you pay.</p>
                          </div>
                        </li>
                      </ul>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setCategoryInput('Banquet Halls');
                          setCurrentView('search');
                        }}
                        className="bg-chalk border-2 border-pitch/10 text-pitch hover:bg-pitch hover:border-pitch hover:text-chalk px-6 py-3 rounded-full font-sans text-sm font-bold transition-all duration-300 self-start cursor-pointer shadow-sm hover:shadow-md flex items-center gap-2 mt-2"
                      >
                        Explore Event Spaces <ArrowRight size={16} />
                      </motion.button>
                    </ScrollReveal>

                    {/* Bento Grid category images */}
                    <div className="lg:col-span-8 grid grid-cols-2 grid-rows-2 gap-4 h-[400px] sm:h-[500px]">
                      
                      {/* Large banquet bento tile */}
                      <ScrollReveal delay={0.1} className="row-span-2 col-span-1">
                      <div
                        onClick={() => handleCategoryTileClick('Banquet Halls')}
                        className="w-full h-full rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg shadow-pitch/5 border border-white/20 ring-1 ring-ink/5"
                      >
                        <img
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmS4VUhDD4CN2fT_YWZsgEDJ9AMZ1I6B3GlPg71O4dJqxF395NcxwodO_BWNf8UIJsx6qfYK6l1v0rx6omfMKIaIYnaE2Jqh3wHCx84xYz65Cj4ArJ1kQ1VPrRlmASYl7-82Bgy8yqibfpgUqq5yZXuSzJxU0_opuAMXguNn7gaCIXH9jRzXdTb7O-OxBZsYO780x2--t0kKcSNxNiaomErW9uASwC8N8-AK5I3vjYXI1XNqkIOZXvZPTxEM6y_z3jyiRdF8BcBg"
                          alt="Elegant Banquet Hall layout"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-pitch via-pitch/20 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
                        <div className="absolute bottom-6 left-6 right-6">
                          <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-md rounded-md text-chalk text-[10px] font-bold uppercase tracking-wider mb-2">Most Popular</span>
                          <h3 className="font-display text-2xl sm:text-3xl text-chalk font-semibold mb-1">Banquet Halls</h3>
                          <p className="font-sans text-xs sm:text-sm text-chalk/80 leading-snug font-medium">Elegance scaled for your grandest moments.</p>
                        </div>
                      </div>
                      </ScrollReveal>

                      {/* Farmhouses bento tile */}
                      <ScrollReveal delay={0.2} className="row-span-1 col-span-1">
                      <div
                        onClick={() => handleCategoryTileClick('Farmhouses')}
                        className="w-full h-full rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg shadow-pitch/5 border border-white/20 ring-1 ring-ink/5"
                      >
                        <img
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJQJcOLiWCfCJ3nIA50IXtuqnINNnUb4b300fUWjW8Was5HMbbG7PTiHHxu3ef-852cT9vYov1GXKXPUbQeUo3-iZu6kVbBR_HhbqVo3ZXWD26t-g3MFMO8_PWvxIoUZDbI0vtI8zPPEaemQ0l2kLZEsrsIh1_wTEyS6aD6fAzT9XJMEJ3GDYAyApNZfX4-v6eZDbV9H8BFlC82gVdiHYkNRcaFZ5AVJ5ZvSqpOjAZisPTRlOSxj_-ptzVG4G41mN2nUhjvIut1g"
                          alt="Luxury private farmhouse meadow"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-pitch/90 via-pitch/30 to-transparent" />
                        <div className="absolute bottom-5 left-5 right-5">
                          <h3 className="font-sans text-base sm:text-lg text-chalk font-bold mb-0.5">Lawn Farmhouses</h3>
                          <p className="font-sans text-[11px] text-chalk/80 leading-snug">Private retreats with expansive green lawns.</p>
                        </div>
                      </div>
                      </ScrollReveal>

                      {/* Corporate meeting space bento tile */}
                      <ScrollReveal delay={0.3} className="row-span-1 col-span-1">
                      <div
                        onClick={() => handleCategoryTileClick('Corporate Hubs')}
                        className="w-full h-full rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg shadow-pitch/5 border border-white/20 ring-1 ring-ink/5"
                      >
                        <img
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAiI9LL5PUhVcsFP-4jBbEDzft6EdPxPcXuelonlyJxq_Eeg4EY5FItEpsY_r03J5BTRgO21MXybLhf26VFYIuRxG__Fh7l71qyGBXFWPR8L5PNj_KuRgatBgDL8CajMpD8twQlbaYkVbw2gLtU3AMNTLeQeawpkVsssatCG78t3RSLk_Y04u7EspAbjL9xYyBqt9ZPv3UWwIoqqWJEpQiHJ0t1qHZ275TmZlHmrQdUDVxaZwWpWjgrz42WPfSiu8hV2w4aW3Q3Dw"
                          alt="Modern conference spaces"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-pitch/90 via-pitch/30 to-transparent" />
                        <div className="absolute bottom-5 left-5 right-5">
                          <h3 className="font-sans text-base sm:text-lg text-chalk font-bold mb-0.5">Corporate Hubs</h3>
                          <p className="font-sans text-[11px] text-chalk/80 leading-snug">Professional spaces for summits and offsites.</p>
                        </div>
                      </div>
                      </ScrollReveal>

                    </div>

                  </section>

                </div>
              </div>
            )}

            {/* ================= VIEW 2: SEARCH & Advanced FILTER CONTEXT ================= */}
            {currentView === 'search' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-8 py-8 w-full">
                
                {/* Sidebar filtering */}
                <FiltersSidebar
                  minPrice={minPrice}
                  onMinPriceChange={setMinPrice}
                  maxPrice={maxPrice}
                  onMaxPriceChange={setMaxPrice}
                  selectedAmenities={selectedAmenities}
                  onAmenityToggle={handleAmenityToggle}
                  selectedCapacity={selectedCapacity}
                  onCapacitySet={setSelectedCapacity}
                  selectedRating={selectedRating}
                  onRatingSet={setSelectedRating}
                  onClearAll={handleClearFilters}
                  resultsCount={filteredVenues.length}
                  isMobileDrawerOpen={isMobileDrawerOpen}
                  onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
                />

                {/* Catalog catalog items */}
                <section className="flex-1 flex flex-col gap-6 w-full overflow-hidden">
                  
                  {/* Context Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div>
                      <h1 className="font-sans text-2xl font-extrabold text-ink tracking-tight flex items-center gap-1.5">
                        {categoryInput ? `${categoryInput} in Metropolis` : 'Premium Venues in Metropolis'}
                      </h1>
                      <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                        Showing <span className="font-bold text-pitch">{filteredVenues.length}</span> professional-grade spaces
                      </p>
                    </div>
                    
                    {/* Filter triggers for mobile/tablet & Reset */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsMobileDrawerOpen(true)}
                        className="lg:hidden flex items-center gap-1.5 px-4 py-2 border border-ink/10 bg-chalk rounded-lg font-sans text-xs font-semibold text-ink shadow-xs hover:bg-mist cursor-pointer"
                      >
                        <Filter size={14} className="text-pitch" />
                        <span>Filter ({Object.values(selectedAmenities).filter(Boolean).length + (selectedCapacity ? 1 : 0) + (selectedRating ? 1 : 0)})</span>
                      </button>
                      
                      {(minPrice || maxPrice || searchQuery || categoryInput || selectedCapacity || selectedRating || Object.values(selectedAmenities).some(Boolean)) && (
                        <button
                          onClick={handleClearFilters}
                          className="px-3 py-1.5 bg-pitch/5 hover:bg-pitch/10 text-pitch border border-pitch/10 rounded-lg text-xs font-sans font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shimmer Placeholder (Simulated feedback loading effect on filters changing) */}
                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
                      {[1, 2, 3].map((skeleton) => (
                        <div key={skeleton} className="bg-chalk rounded-xl border border-ink/5 overflow-hidden flex flex-col">
                          <div className="w-full aspect-[4/3] bg-surface-container-high shimmer" />
                          <div className="p-4 flex flex-col gap-3">
                            <div className="h-5 bg-surface-container rounded-sm w-3/4" />
                            <div className="h-4 bg-surface-container rounded-sm w-1/2" />
                            <div className="h-6 mt-2 bg-surface-container rounded-sm w-1/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredVenues.length > 0 ? (
                    /* Results Grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" id="results-grid">
                      {filteredVenues.map((venue) => (
                        <VenueCard
                          key={venue.id}
                          venue={venue}
                          onClick={(id) => {
                            setSelectedVenueId(id);
                            setCurrentView('detail');
                          }}
                          onToggleFavorite={handleToggleFavorite}
                          isFavorite={favorites.includes(venue.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Beautiful Clean Empty State */
                    <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-chalk rounded-xl border border-ink/10 border-dashed max-w-xl mx-auto my-6">
                      <div className="w-16 h-16 bg-mist rounded-full flex items-center justify-center mb-6 text-on-surface-variant">
                        <Search size={32} />
                      </div>
                      <h3 className="font-sans text-lg font-bold text-ink mb-1.5">No exact matches found</h3>
                      <p className="font-sans text-xs sm:text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
                        We could not identify any venues matching your precise filters. Try easing up on selected amenities, enlarging your pricing limits, or choosing all categories.
                      </p>
                      <button
                        onClick={handleClearFilters}
                        className="bg-pitch hover:bg-[#15462E] text-chalk px-5 py-2.5 rounded-lg font-sans text-xs font-bold shadow-xs active:scale-97 transition-all cursor-pointer"
                      >
                        Clear All Active Filters
                      </button>
                    </div>
                  )}

                </section>
              </div>
            )}

            {/* ================= VIEW 3: VENUE DETAIL specifications page ================= */}
            {currentView === 'detail' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <React.Suspense fallback={<DetailSkeleton />}>
                  <DetailView
                    venue={activeVenueObj}
                    slots={activeVenueSlots}
                    onBack={() => setCurrentView('search')}
                    onInitiateBooking={handleInitiateBooking}
                    onRequestAuth={() => setAuthModalMode('login')}
                    waitingBooking={realBookings?.find(b => b.venueId === activeVenueObj.id && b.status === 'pending_payment')}
                    onGoToBookings={() => setCurrentView('my-bookings')}
                  />
                </React.Suspense>
              </div>
            )}

            {/* ================= VIEW 4: checkout payment details ================= */}
            {currentView === 'checkout' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow">
                <React.Suspense fallback={<CheckoutSkeleton />}>
                  <ReviewPay
                    venue={activeVenueObj}
                    selectedSlot={selectedSlot}
                    selectedSlotId={selectedSlotId}
                    selectedDate={bookingDate}
                    currentUser={user}
                    onNavigateHome={() => {
                      setCurrentView('home');
                    }}
                    onSubmitBooking={async (guestName?: string, guestEmail?: string, guestPhone?: string) => {
                      if (!selectedSlotId) throw new Error('No slot selected');
                      const result = await createBookingMutation.mutateAsync(
                        user
                          ? { inventory_unit_id: selectedSlotId }
                          : { inventory_unit_id: selectedSlotId, guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone },
                      );
                      return result;
                    }}
                  />
                </React.Suspense>
              </div>
            )}

            {/* ================= VIEW 5: client my bookings/reservations ================= */}
            {currentView === 'my-bookings' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <React.Suspense fallback={<MyBookingsSkeleton />}>
                  <MyBookings
                    bookings={realBookings}
                    venues={realVenues}
                    onCancelBooking={(id) => {
                      cancelBookingMutation.mutate(
                        { bookingId: id },
                        {
                          onSuccess: (res) => {
                            const pct = res.refund_tier === 'full_refund' ? '100%' : res.refund_tier === 'partial_refund' ? '50%' : '0%';
                            alert(`Booking cancelled. Refund: ${pct} (₹${res.refund_amount})`);
                          },
                          onError: () => alert('Could not cancel this booking. Please try again.'),
                        },
                      );
                    }}
                    onBookAgain={(venueId) => {
                      setSelectedVenueId(venueId);
                      setCurrentView('detail');
                    }}
                  />
                </React.Suspense>
              </div>
            )}
          </>
        )}

      </main>

      {/* Floating Action Button (Active Filters for search page on Mobile) */}
      {currentView === 'search' && activeRole === 'client' && (
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-pitch text-chalk flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg hover:bg-[#15462E] active:scale-95 transition-all md:hidden cursor-pointer"
        >
          <Filter size={16} />
          <span className="font-sans text-xs font-bold">Filters</span>
        </button>
      )}


      {/* ================= GLOBAL DESIGN SYSTEM FOOTER ================= */}
      <footer className="bg-[#0f1f17] mt-24 pt-16 pb-8 relative overflow-hidden">
        {/* Top gradient border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-marigold/0 via-marigold to-marigold/0 opacity-50"></div>
        
        <ScrollReveal>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
            
            {/* Brand column */}
            <div className="lg:col-span-4 space-y-6">
              <span className="font-display text-3xl text-chalk font-semibold block tracking-tight">GroundBooking<span className="text-marigold">.</span></span>
              <p className="font-sans text-sm text-chalk/60 leading-relaxed max-w-sm font-light">
                The ultimate premium marketplace for instant sports booking and high-stakes corporate event hosting. Precision in every play.
              </p>
              <div className="flex gap-4 pt-2">
                {/* Social icons placeholder dots */}
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-marigold/20 hover:text-marigold text-chalk/60 transition-colors cursor-pointer"><span className="text-lg">𝕏</span></div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-marigold/20 hover:text-marigold text-chalk/60 transition-colors cursor-pointer"><span className="text-lg">in</span></div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-marigold/20 hover:text-marigold text-chalk/60 transition-colors cursor-pointer"><span className="text-lg">ig</span></div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-3 lg:col-start-6 flex flex-col gap-4">
              <h4 className="font-sans text-sm uppercase font-bold text-chalk tracking-widest mb-2">Quick Links</h4>
              <a href="#explore" onClick={(e) => { e.preventDefault(); setActiveRole('client'); setCurrentView('home'); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Premium Explore
              </a>
              <a href="#find" onClick={(e) => { e.preventDefault(); setActiveRole('client'); setSearchQuery(''); setCurrentView('search'); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Find Sports Fields
              </a>
              <a href="#events" onClick={(e) => { e.preventDefault(); setCategoryInput('Banquet Halls'); setCurrentView('search'); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Event Spaces
              </a>
              <a href="#support" onClick={(e) => { e.preventDefault(); alert('Help center ticketing is active at support@venuesetu.com'); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Help Center
              </a>
            </div>

            {/* For Owners */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <h4 className="font-sans text-sm uppercase font-bold text-chalk tracking-widest mb-2">For Owners</h4>
              <a href="#list" onClick={(e) => { e.preventDefault(); requireAuth(() => setActiveRole('owner')); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                List Your Venue
              </a>
              <a href="#partner" onClick={(e) => e.preventDefault()} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Partner Guidelines
              </a>
              <a href="#resources" onClick={(e) => e.preventDefault()} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Owner Resources
              </a>
            </div>

            {/* Legal */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <h4 className="font-sans text-sm uppercase font-bold text-chalk tracking-widest mb-2">Legal</h4>
              <a href="#privacy" onClick={(e) => e.preventDefault()} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Privacy Policy
              </a>
              <a href="#terms" onClick={(e) => e.preventDefault()} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Terms of Service
              </a>
              <a href="#cookies" onClick={(e) => e.preventDefault()} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Cookie Preferences
              </a>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-sans text-xs text-chalk/50 font-medium">
              © {new Date().getFullYear()} GroundBooking Inc. All rights reserved.
            </p>
            <p className="font-sans text-xs text-chalk/50 font-medium flex items-center gap-1.5">
              Made with <Heart size={12} className="text-marigold" fill="currentColor" /> in India
            </p>
          </div>
        </div>
        </ScrollReveal>
      </footer>

    </div>
  );
}
