import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, CheckCircle, ArrowRight, Sparkles, Filter, Heart, RefreshCw, Eye, Landmark, Settings, Star, Zap, ShieldCheck, CircleDollarSign, Target, AlertCircle } from 'lucide-react';
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
import { useSmoothScroll } from './components/SmoothScroll';

import { useAuth } from './lib/auth';
import { useVenues, useVenue, useVenueSlots, useHomepage } from './hooks/useVenues';
import { useMyBookings, useCreateBooking, useCancelBooking } from './hooks/useBookings';
import { useToast } from './components/ui/Toast';
import { ApiError } from './lib/api/client';

import { useLocation, useNavigate } from 'react-router-dom';
import SEOHead from './components/SEOHead';
import { generateWebsiteSchema, generateOrganizationSchema, generateCollectionPageSchema, generateBreadcrumbSchema } from './lib/schema';
import About from './components/About';
import Contact from './components/Contact';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import NotFound from './components/NotFound';
import { absUrl, SITE_NAME } from './lib/site';

// Lazy loading large sub-views to optimize first-load bundle size and protect the main thread
const DetailView = React.lazy(() => import('./components/DetailView'));
const ReviewPay = React.lazy(() => import('./components/ReviewPay'));
const OwnerLayout = React.lazy(() => import('./components/OwnerLayout'));
const AdminLayout = React.lazy(() => import('./components/AdminLayout'));
const MyBookings = React.lazy(() => import('./components/MyBookings'));
const SupportTickets = React.lazy(() => import('./components/SupportTickets'));

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

function VenueErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-chalk rounded-2xl border border-ink/10 max-w-md mx-auto my-12 space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
        <AlertCircle size={24} />
      </div>
      <h3 className="font-display text-xl font-bold text-ink">Failed to load venue</h3>
      <p className="font-sans text-sm text-on-surface-variant">
        Something went wrong while loading this venue. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="bg-pitch hover:bg-[#15462E] text-chalk px-6 py-2.5 rounded-full font-sans text-xs font-bold transition ease-out cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}

export default function App() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const toast = useToast();

  // Global Perspective Role SWITCHER state — dev-only, gated below; real
  // customers never see this. Both Owner and Admin dashboards are now
  // wired to real data (see the effect just below, which syncs this to
  // the real authenticated user's role) — PerspectiveSwitcher exists
  // purely as a dev convenience for jumping between roles without
  // separate logins, not as anything load-bearing for either dashboard.
  const [activeRole, setActiveRole] = useState<'client' | 'owner' | 'admin'>(() => {
    const saved = localStorage.getItem('groundkart_active_role');
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
    if (!user || user.role === 'customer') {
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
  const { data: homepageData } = useHomepage();
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

  type AppView = 'home' | 'search' | 'detail' | 'checkout' | 'my-bookings' | 'support' | 'about' | 'contact' | 'terms' | 'privacy' | '404';

  const location = useLocation();
  const navigate = useNavigate();

  // Navigation & Primary State
  const [supportContext, setSupportContext] = useState<{ type: 'booking' | 'venue'; id: string } | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('home');
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
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  // Favorites persistence
  const [favorites, setFavorites] = useState<string[]>([
    'grand-turf-arena',
    'skyline-tennis-courts'
  ]);

  // UI States
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Category mapping helpers
  const DISPLAY_TO_BACKEND_CATEGORY: Record<string, string> = {
    'Turfs': 'sports',
    'Courts': 'sports',
    'Pools': 'sports',
    'Banquet Halls': 'banquet_hall',
    'Farmhouses': 'farmhouse',
    'Corporate Hubs': 'corporate',
    'Community Halls': 'community_hall',
    'banquet': 'banquet_hall',
    'football': 'sports',
    'conference': 'corporate',
    'Sports Grounds': 'sports',
    'Corporate Spaces': 'corporate',
    'sports': 'sports',
    'banquet_hall': 'banquet_hall',
    'farmhouse': 'farmhouse',
    'corporate': 'corporate',
    'community_hall': 'community_hall',
  };

  const SLUG_TO_DISPLAY_CATEGORY: Record<string, string> = {
    'sports': 'Sports Grounds',
    'banquet-halls': 'Banquet Halls',
    'banquet_hall': 'Banquet Halls',
    'banquet': 'Banquet Halls',
    'farmhouses': 'Farmhouses',
    'farmhouse': 'Farmhouses',
    'corporate': 'Corporate Spaces',
    'corporate-hubs': 'Corporate Spaces',
    'community-halls': 'Community Halls',
    'community_hall': 'Community Halls',
  };

  // Synchronize state value writes to LocalStorage to retain cross-role testing inputs
  useEffect(() => {
    localStorage.setItem('groundkart_active_role', activeRole);
  }, [activeRole]);

  // Synchronize URL path to state views
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '') {
      setCurrentView('home');
      setActiveRole('client');
    } else if (path === '/search') {
      setCurrentView('search');
      setActiveRole('client');
      const params = new URLSearchParams(location.search);
      const cat = params.get('category');
      const city = params.get('city');
      const q = params.get('q');
      const date = params.get('available_on');
      if (cat) {
        setCategoryInput(cat);
        setSearchParams(prev => ({ ...prev, category: DISPLAY_TO_BACKEND_CATEGORY[cat] || cat }));
      }
      if (city) {
        setLocationInput(city);
        setSearchParams(prev => ({ ...prev, city }));
      }
      if (date) {
        setDateInput(date);
        setSearchParams(prev => ({ ...prev, available_on: date }));
      }
      if (q) {
        setSearchQuery(q);
      }
    } else if (path.startsWith('/categories/')) {
      const catSlug = path.replace('/categories/', '');
      const displayCat = SLUG_TO_DISPLAY_CATEGORY[catSlug] || catSlug;
      setCategoryInput(displayCat);
      setCurrentView('search');
      setActiveRole('client');
      setSearchParams({ category: DISPLAY_TO_BACKEND_CATEGORY[displayCat] || DISPLAY_TO_BACKEND_CATEGORY[catSlug] || catSlug });
    } else if (path.startsWith('/venues/')) {
      const slugOrId = path.replace('/venues/', '');
      setSelectedVenueId(slugOrId);
      setSelectedSlotId(null);
      setCurrentView('detail');
      setActiveRole('client');
    } else if (path === '/checkout') {
      if (!selectedSlotId) {
        navigate('/search', { replace: true });
        return;
      }
      setCurrentView('checkout');
      setActiveRole('client');
    } else if (path === '/my-bookings') {
      setCurrentView('my-bookings');
      setActiveRole('client');
    } else if (path === '/support') {
      setCurrentView('support');
      setActiveRole('client');
    } else if (path === '/about') {
      setCurrentView('about');
      setActiveRole('client');
    } else if (path === '/contact') {
      setCurrentView('contact');
      setActiveRole('client');
    } else if (path === '/privacy') {
      setCurrentView('privacy');
      setActiveRole('client');
    } else if (path === '/terms') {
      setCurrentView('terms');
      setActiveRole('client');
    } else if (path === '/owner') {
      setActiveRole('owner');
    } else if (path === '/admin') {
      setActiveRole('admin');
    } else {
      setCurrentView('404');
      setActiveRole('client');
    }
  }, [location.pathname, location.search, selectedSlotId, navigate]);

  const { scrollTo: smoothScrollTo } = useSmoothScroll();

  // Scroll to top on view changes to mirror SPA transitions
  useEffect(() => {
    smoothScrollTo(0, { immediate: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentView, selectedVenueId, activeRole, smoothScrollTo]);

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

  const handleSearchSubmit = () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (locationInput) params.set('city', locationInput);
    if (categoryInput) params.set('category', categoryInput);
    if (dateInput) params.set('available_on', dateInput);
    const qStr = params.toString();
    navigate(qStr ? `/search?${qStr}` : '/search');
    setTimeout(() => {
      setIsLoading(false);
    }, 650);
  };

  // Navigating categories directly from index layout
  const handleCategoryTileClick = (categoryName: string) => {
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

    navigate(`/search?category=${encodeURIComponent(categoryName)}`);
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  // Initiate dynamic booking pipeline
  const handleInitiateBooking = (slot: string, date: string, slotId: string) => {
    setSelectedSlot(slot);
    setBookingDate(date);
    setSelectedSlotId(slotId);
    navigate('/checkout');
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
        const matchesSport = venue.venueType.toLowerCase().includes(query);
        const matchesCategory = venue.category.toLowerCase().includes(query);
        if (!matchesName && !matchesDistrict && !matchesSport && !matchesCategory) {
          return false;
        }
      }

      // 2. Min Price matches
      if (minPrice && venue.basePrice < parseFloat(minPrice)) {
        return false;
      }

      // 3. Max Price matches
      if (maxPrice && venue.basePrice > parseFloat(maxPrice)) {
        return false;
      }

      // 4. Amenities check checks
      const ams = venue.amenities || [];
      const amLower = ams.map(a => a.toLowerCase());
      
      if (selectedAmenities.freeParking && !amLower.some(a => a.includes('park'))) return false;
      if (selectedAmenities.floodlights && !amLower.some(a => a.includes('light'))) return false;
      if (selectedAmenities.airConditioning && !amLower.some(a => a.includes('ac') || a.includes('air') || a.includes('climate'))) return false;
      if (selectedAmenities.lockerRooms && !amLower.some(a => a.includes('room') || a.includes('bath'))) return false;

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
  const {
    venue: activeVenueFromApi,
    isLoading: isVenueLoading,
    notFound: isVenueNotFound,
    isError: isVenueError,
    refetch: refetchVenue,
  } = useVenue((currentView === 'detail' || currentView === 'checkout') && selectedVenueId ? selectedVenueId : undefined);
  const { slots: activeVenueSlots } = useVenueSlots(currentView === 'detail' && selectedVenueId ? selectedVenueId : undefined);
  const activeVenueObj = activeVenueFromApi ?? realVenues.find((v) => v.id === selectedVenueId || v.slug === selectedVenueId);

  // Admin featured banner configuration or default to first real venue if available
  const featuredVenueObj = useMemo(() => {
    if (homepageData?.featured?.[0]) {
      const p = homepageData.featured[0];
      const v = realVenues.find(v => v.id === p.id);
      if (v) return { ...v, _badge: p.badge, _custom_title: p.custom_title, _custom_desc: p.custom_description };
    }
    return realVenues[0];
  }, [realVenues, homepageData]);

  // State-aware trending list feed
  const trendingVenues = useMemo(() => {
    if (homepageData?.trending && homepageData.trending.length > 0) {
      return homepageData.trending.map(t => {
        const v = realVenues.find(v => v.id === t.id);
        return v ? { ...v, _badge: t.badge } : null;
      }).filter(Boolean) as any[];
    }
    return realVenues.filter((v) => v.id !== featuredVenueObj?.id).slice(0, 4);
  }, [realVenues, homepageData, featuredVenueObj]);

  return (
    <div className="bg-mist text-ink font-sans min-h-screen flex flex-col antialiased">
      
      {/* Global Transparent Sticky Header */}
      {activeRole === 'client' && (
        <Header
          currentView={currentView}
          onNavigate={(view) => {
            setActiveRole('client');
            if (view === 'home') navigate('/');
            else if (view === 'search') navigate('/search');
            else if (view === 'checkout') navigate('/checkout');
            else if (view === 'my-bookings') navigate('/my-bookings');
            else if (view === 'support') navigate('/support');
            else if (view === 'about') navigate('/about');
            else if (view === 'contact') navigate('/contact');
            else if (view === 'privacy') navigate('/privacy');
            else if (view === 'terms') navigate('/terms');
            if (view !== 'support') setSupportContext(null);
          }}
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setActiveRole('client');
            if (currentView !== 'search') {
              navigate('/search');
            }
          }}
          onListVenue={() => {
            requireAuth(() => {
              if (user?.role === 'admin') navigate('/admin');
              else navigate('/owner');
            });
          }}
          onRequestAuth={() => setAuthModalMode('login')}
        />
      )}

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
          <div className="w-full flex-grow flex flex-col">
            <SEOHead
              title={`Owner Portal — ${SITE_NAME}`}
              description={`Manage your sports turfs, banquet halls, and venue listings on ${SITE_NAME}.`}
              canonicalUrl={absUrl('/owner')}
              noindex={true}
            />
            <React.Suspense fallback={<DashboardSkeleton />}>
              <OwnerLayout onReturnToSite={() => { setActiveRole('client'); navigate('/'); }} />
            </React.Suspense>
          </div>
        ) : activeRole === 'admin' ? (
          <div className="w-full flex-grow flex flex-col">
            <SEOHead
              title={`Admin Dashboard — ${SITE_NAME}`}
              description={`${SITE_NAME} administrative management and approval portal.`}
              canonicalUrl={absUrl('/admin')}
              noindex={true}
            />
            <React.Suspense fallback={<DashboardSkeleton />}>
              <AdminLayout onReturnToSite={() => { setActiveRole('client'); navigate('/'); }} />
            </React.Suspense>
          </div>
        ) : (
          <>
            {/* ================= VIEW 1: HOME PAGE ================= */}
            {currentView === 'home' && (
              <div className="flex-grow pb-16">
                <SEOHead
                  title={`${SITE_NAME} — Book Sports Turfs, Courts, Banquet Halls & Spaces in India`}
                  description="Discover and book physically verified sports turfs, badminton courts, wedding banquet halls, farmhouses, and corporate conference venues across India with instant confirmation."
                  canonicalUrl={absUrl('/')}
                  jsonLd={[generateWebsiteSchema(), generateOrganizationSchema()]}
                />
                
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 sm:mt-20 space-y-16">
                  
                  {/* Title Header Section */}
                  <section id="trending-section">
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
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setCategoryInput('');
                          navigate('/search');
                        }}
                        className="hidden md:flex items-center gap-1.5 font-sans text-sm font-bold text-pitch hover:text-marigold group cursor-pointer transition-colors px-4 py-2 rounded-full hover:bg-pitch/5 ease-out"
                      >
                        <span>View all trending</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform ease-out" />
                      </motion.button>
                    </div>
                    </ScrollReveal>

                    {/* Horizontal Category Chips Rail for Mobile */}
                    <div className="md:hidden flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
                      {(['Turfs', 'Banquet Halls', 'Courts', 'Farmhouses'] as const).map((cat, idx) => (
                        <ScrollReveal key={cat} delay={idx * 0.1}>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleCategoryTileClick(cat)}
                            className="shrink-0 bg-chalk/80 backdrop-blur-md border border-ink/5 text-pitch font-sans text-xs font-semibold px-5 py-2.5 rounded-full shadow-sm hover:bg-mist transition focus:ring-2 focus:ring-marigold focus:outline-none ease-out"
                          >
                            {cat}
                          </motion.button>
                        </ScrollReveal>
                      ))}
                    </div>

                    {/* Dynamic Hero featured grid */}
                    {featuredVenueObj && (
                      <ScrollReveal delay={0.1}>
                        <div 
                          onClick={() => {
                            const target = featuredVenueObj.slug || featuredVenueObj.id;
                            setSelectedVenueId(target);
                            navigate(`/venues/${target}`);
                          }}
                          className="relative bg-[#143828] rounded-3xl overflow-hidden tracking-tight shadow-2xl shadow-pitch/10 border border-white/10 group cursor-pointer mb-10 animate-fade-in hover:-translate-y-1 transition duration-200 ease-out"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-chalk/10 to-transparent pointer-events-none"></div>
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
                            <div className="md:col-span-7 relative aspect-[16/9] md:aspect-auto md:h-[400px] overflow-hidden">
                              <img
                                src={featuredVenueObj.image}
                                alt={featuredVenueObj.name}
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
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
                                    <span className="flex items-center gap-1"><Star size={12} className="fill-marigold text-marigold" /> {featuredVenueObj.rating}</span>
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
                                  <p className="font-sans text-2xl text-marigold font-bold mt-0.5">₹{featuredVenueObj.basePrice}<span className="text-sm text-chalk/60 font-normal">/hr</span></p>
                                </div>
                                <span className="bg-gradient-to-r from-marigold to-amber-500 text-pitch text-sm font-bold px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-shadow ease-out">
                                  View Details
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </ScrollReveal>
                    )}

                    {/* Sub grid list for home trending items */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {trendingVenues.map((venue, idx) => (
                        <ScrollReveal key={venue.id} delay={idx * 0.08}>
                          <VenueCard
                            venue={venue}
                            onClick={(id) => {
                              const target = venue.slug || id;
                              setSelectedVenueId(target);
                              navigate(`/venues/${target}`);
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
                          One platform. <span className="text-transparent bg-clip-text bg-gradient-to-r from-pitch to-marigold">Every occasion.</span>
                        </h2>
                        <p className="font-sans text-sm sm:text-base text-on-surface-variant leading-relaxed">
                          From weekend games and birthday celebrations to weddings, corporate meetings and private gatherings, GroundKart helps you find and book a space that fits the occasion.
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
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setCategoryInput('');
                            navigate('/search');
                          }}
                          className="bg-chalk border-2 border-pitch/10 text-pitch hover:bg-pitch hover:border-pitch hover:text-chalk px-6 py-3 rounded-full font-sans text-sm font-bold transition duration-200 self-start cursor-pointer shadow-sm hover:shadow-md flex items-center gap-2 mt-2 ease-out"
                        >
                          Explore All Spaces <ArrowRight size={16} />
                        </motion.button>
                      </ScrollReveal>

                      {/* Bento Grid category images */}
                      <div className="lg:col-span-8 grid grid-cols-2 grid-rows-2 gap-4 h-[400px] sm:h-[500px]">
                        
                        {/* Large banquet bento tile */}
                        <ScrollReveal delay={0.1} className="row-span-2 col-span-1">
                        <div
                          onClick={() => handleCategoryTileClick('banquet')}
                          className="w-full h-full rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg shadow-pitch/5 border border-white/20 ring-1 ring-ink/5"
                        >
                          <img
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ease-out"
                            src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=2098&auto=format&fit=crop"
                            alt="Elegant Banquet Hall layout"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-pitch via-pitch/20 to-transparent opacity-90 transition-opacity group-hover:opacity-100 ease-out" />
                          <div className="absolute bottom-6 left-6 right-6">
                            <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-md rounded-md text-chalk text-[10px] font-bold uppercase tracking-wider mb-2">Featured</span>
                            <h3 className="font-display text-2xl sm:text-3xl text-chalk font-semibold mb-1">Banquet Halls</h3>
                            <p className="font-sans text-xs sm:text-sm text-chalk/80 leading-snug font-medium">Elegant spaces for weddings, receptions and celebrations.</p>
                          </div>
                        </div>
                        </ScrollReveal>

                        {/* Sports bento tile */}
                        <ScrollReveal delay={0.2} className="row-span-1 col-span-1">
                        <div
                          onClick={() => handleCategoryTileClick('football')}
                          className="w-full h-full rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg shadow-pitch/5 border border-white/20 ring-1 ring-ink/5"
                        >
                          <img
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ease-out"
                            src="https://images.unsplash.com/photo-1459865264687-595d652de67e?q=80&w=2070&auto=format&fit=crop"
                            alt="Football stadium"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-pitch/90 via-pitch/30 to-transparent" />
                          <div className="absolute bottom-5 left-5 right-5">
                            <h3 className="font-sans text-base sm:text-lg text-chalk font-bold mb-0.5">Sports Grounds</h3>
                            <p className="font-sans text-[11px] text-chalk/80 leading-snug">Turfs, courts and grounds for your next game.</p>
                          </div>
                        </div>
                        </ScrollReveal>

                        {/* Corporate bento tile */}
                        <ScrollReveal delay={0.3} className="row-span-1 col-span-1">
                        <div
                          onClick={() => handleCategoryTileClick('conference')}
                          className="w-full h-full rounded-3xl overflow-hidden relative group cursor-pointer shadow-lg shadow-pitch/5 border border-white/20 ring-1 ring-ink/5"
                        >
                          <img
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ease-out"
                            src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop"
                            alt="Modern corporate boardroom"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-pitch/90 via-pitch/30 to-transparent" />
                          <div className="absolute bottom-5 left-5 right-5">
                            <h3 className="font-sans text-base sm:text-lg text-chalk font-bold mb-0.5">Corporate Spaces</h3>
                            <p className="font-sans text-[11px] text-chalk/80 leading-snug">Professional spaces for meetings and offsites.</p>
                          </div>
                        </div>
                        </ScrollReveal>

                      </div>
                    </section>
                  {/* ================= WHY GROUNDKART ================= */}
                  <div className="boundary-line-double">
                    <div className="top" />
                    <div className="bottom" />
                  </div>
                  
                  <section className="py-12">
                    <ScrollReveal>
                      <h2 className="font-display text-3xl sm:text-4xl text-ink font-semibold mb-12 text-center">Why GroundKart?</h2>
                    </ScrollReveal>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      {[
                        { title: 'Instant Booking', desc: 'No waiting, no calls. Book your ground instantly online.', icon: <Zap size={28} className="text-pitch" /> },
                        { title: 'Verified Venues', desc: 'Every venue is physically verified for quality and safety.', icon: <ShieldCheck size={28} className="text-pitch" /> },
                        { title: 'Transparent Pricing', desc: 'No hidden charges. The price you see is what you pay.', icon: <CircleDollarSign size={28} className="text-pitch" /> },
                        { title: 'Smart Discovery', desc: 'Find the perfect ground based on your sport, location, and needs.', icon: <Target size={28} className="text-pitch" /> }
                      ].map((feature, i) => (
                        <ScrollReveal key={i} delay={i * 0.1} className="bg-white p-6 rounded-[20px] shadow-sm border border-ink/5 flex flex-col items-start gap-4 hover:shadow-md transition-shadow">
                          <div className="text-3xl">{feature.icon}</div>
                          <div>
                            <h3 className="font-sans text-lg font-bold text-pitch mb-2">{feature.title}</h3>
                            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">{feature.desc}</p>
                          </div>
                        </ScrollReveal>
                      ))}
                    </div>
                  </section>

                  {/* ================= TESTIMONIALS ================= */}
                  <section className="py-12 bg-pitch/5 rounded-[32px] px-8 sm:px-12 my-12">
                    <ScrollReveal>
                      <h2 className="font-display text-3xl sm:text-4xl text-ink font-semibold mb-12 text-center">Loved by Our Community</h2>
                    </ScrollReveal>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {[
                        { text: "Finding a quality ground for our weekend matches used to take hours. GroundKart made it effortless.", name: "Rahul Sharma", role: "Event Host" },
                        { text: "The transparent pricing and instant booking are game changers. We book our corporate turfs here exclusively.", name: "Anita Desai", role: "HR Manager" },
                        { text: "Super clean interface and verified grounds. I never have to worry about arriving to a double-booked turf again.", name: "Vikram Singh", role: "Cricket Captain" }
                      ].map((t, i) => (
                        <ScrollReveal key={i} delay={i * 0.1} className="bg-white p-8 rounded-[24px] shadow-sm border border-ink/5 flex flex-col justify-between">
                          <p className="font-sans text-sm italic text-on-surface-variant leading-relaxed mb-6">"{t.text}"</p>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pitch to-marigold flex items-center justify-center text-chalk font-bold text-sm">
                              {t.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-sans text-sm font-bold text-ink">{t.name}</h4>
                              <p className="font-sans text-xs text-on-surface-variant">{t.role}</p>
                            </div>
                          </div>
                        </ScrollReveal>
                      ))}
                    </div>
                  </section>

                  {/* ================= FINAL CTA ================= */}
                  <section className="py-16 sm:py-24 px-6 bg-pitch rounded-[32px] text-center relative overflow-hidden mb-12">
                    <div className="absolute inset-0 bg-gradient-to-br from-pitch via-pitch/90 to-[#145A3E]" />
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_100%)] pointer-events-none" />
                    
                    <ScrollReveal className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
                      <h2 className="font-display text-4xl sm:text-5xl text-chalk font-bold mb-4 drop-shadow-sm">Your next occasion starts here.</h2>
                      <p className="font-sans text-lg text-chalk/80 mb-8 font-light">Discover, compare and book the perfect space.</p>
                      
                      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
                        <button
                          onClick={() => {
                            setCategoryInput('');
                            navigate('/search');
                          }}
                          className="bg-marigold hover:bg-amber-500 text-pitch font-sans text-base font-bold px-8 py-4 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          Explore Grounds
                        </button>
                        <button
                          onClick={() => requireAuth(() => {
                            if (user?.role === 'admin') navigate('/admin');
                            else navigate('/owner');
                          })}
                          className="bg-transparent border border-chalk/30 hover:bg-chalk/10 text-chalk font-sans text-base font-bold px-8 py-4 rounded-full transition-colors cursor-pointer"
                        >
                          List Your Venue
                        </button>
                      </div>
                    </ScrollReveal>
                  </section>

                </div>
              </div>
            )}

            {/* ================= VIEW 2: SEARCH & Advanced FILTER CONTEXT ================= */}
            {currentView === 'search' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-8 py-8 w-full">
                <SEOHead
                  title={categoryInput ? `${categoryInput} in Metropolis | ${SITE_NAME}` : `Explore Verified Venues in Metropolis | ${SITE_NAME}`}
                  description={categoryInput ? `Discover and book verified ${categoryInput} in Metropolis. View real-time availability, authentic photos, amenities, and transparent hourly rates.` : 'Browse verified sports grounds, banquet halls, farmhouses, and corporate spaces in Metropolis with transparent pricing and real-time slot booking.'}
                  canonicalUrl={categoryInput ? absUrl(`/search?category=${encodeURIComponent(categoryInput)}`) : absUrl('/search')}
                  jsonLd={[
                    generateCollectionPageSchema(
                      categoryInput ? `${categoryInput} in Metropolis` : 'Explore Venues in Metropolis',
                      categoryInput ? `/search?category=${encodeURIComponent(categoryInput)}` : '/search',
                      'Browse verified sports grounds, banquet halls, farmhouses, and corporate spaces.'
                    ),
                    generateBreadcrumbSchema([
                      { name: 'Home', path: '/' },
                      { name: 'Venues', path: '/search' },
                      ...(categoryInput ? [{ name: categoryInput, path: `/search?category=${encodeURIComponent(categoryInput)}` }] : []),
                    ]),
                  ]}
                />
                
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
                            const target = venue.slug || id;
                            setSelectedVenueId(target);
                            navigate(`/venues/${target}`);
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
                      <h3 className="font-sans text-lg font-bold text-ink mb-1.5">No venues available yet</h3>
                      <p className="font-sans text-xs sm:text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
                        New spaces are being added to GroundKart.
                      </p>
                      <button
                        onClick={handleClearFilters}
                        className="bg-pitch hover:bg-[#15462E] text-chalk px-5 py-2.5 rounded-lg font-sans text-xs font-bold shadow-xs active:scale-[0.97] transition cursor-pointer ease-out"
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
                {isVenueLoading ? (
                  <DetailSkeleton />
                ) : isVenueNotFound ? (
                  <NotFound />
                ) : isVenueError ? (
                  <VenueErrorState onRetry={() => refetchVenue()} />
                ) : !activeVenueObj ? (
                  <NotFound />
                ) : (
                  <React.Suspense fallback={<DetailSkeleton />}>
                    <DetailView
                      venue={activeVenueObj}
                      slots={activeVenueSlots}
                      onBack={() => navigate('/search')}
                      onSupport={(id) => { setSupportContext({ type: 'venue', id }); navigate('/support'); }}
                      onInitiateBooking={handleInitiateBooking}
                      onRequestAuth={() => setAuthModalMode('login')}
                      waitingBooking={realBookings?.find(b => b.venueId === activeVenueObj.id && b.status === 'pending_payment')}
                      onGoToBookings={() => navigate('/my-bookings')}
                    />
                  </React.Suspense>
                )}
              </div>
            )}

            {/* ================= VIEW 4: checkout payment details ================= */}
            {currentView === 'checkout' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-grow">
                <SEOHead
                  title={`Review & Confirm Booking — ${SITE_NAME}`}
                  description={`Review your venue slot reservation and secure your booking with ${SITE_NAME}.`}
                  canonicalUrl={absUrl('/checkout')}
                  noindex={true}
                />
                {isVenueLoading ? (
                  <CheckoutSkeleton />
                ) : isVenueNotFound ? (
                  <NotFound />
                ) : isVenueError ? (
                  <VenueErrorState onRetry={() => refetchVenue()} />
                ) : !activeVenueObj ? (
                  <NotFound />
                ) : (
                  <React.Suspense fallback={<CheckoutSkeleton />}>
                    <ReviewPay
                      venue={activeVenueObj}
                      selectedSlot={selectedSlot}
                      selectedSlotId={selectedSlotId}
                      selectedDate={bookingDate}
                      currentUser={user}
                      onNavigateHome={() => navigate('/')}
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
                )}
              </div>
            )}

            {/* ================= VIEW 5: client my bookings/reservations ================= */}
            {currentView === 'my-bookings' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <SEOHead
                  title={`My Bookings — ${SITE_NAME}`}
                  description={`Manage and track your venue reservations and tickets on ${SITE_NAME}.`}
                  canonicalUrl={absUrl('/my-bookings')}
                  noindex={true}
                />
                <React.Suspense fallback={<MyBookingsSkeleton />}>
                  <MyBookings
                    bookings={realBookings}
                    venues={realVenues}
                    onSupport={(id) => { setSupportContext({ type: 'booking', id }); navigate('/support'); }}
                    onCancelBooking={(id) => {

                      cancelBookingMutation.mutate(
                        { bookingId: id },
                        {
                          onSuccess: (res) => {
                            const pct = res.refund_tier === 'full_refund' ? '100%' : res.refund_tier === 'partial_refund' ? '50%' : '0%';
                            toast.success(`Booking cancelled. Refund: ${pct} (₹${res.refund_amount})`);
                          },
                          onError: (err: any) => {
                            const msg = err instanceof ApiError ? err.detail : err?.message || 'Could not cancel this booking. Please try again.';
                            toast.error(msg);
                          },
                        },
                      );
                    }}
                    onBookAgain={(venueId) => {
                      const v = realVenues.find(rv => rv.id === venueId);
                      const target = v?.slug || venueId;
                      setSelectedVenueId(target);
                      navigate(`/venues/${target}`);
                    }}
                  />
                </React.Suspense>
              </div>
            )}

            {currentView === 'support' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
                <SEOHead
                  title={`Customer Support & Tickets — ${SITE_NAME}`}
                  description={`Submit and track support inquiries for venue reservations on ${SITE_NAME}.`}
                  canonicalUrl={absUrl('/support')}
                  noindex={true}
                />
                <React.Suspense fallback={<DashboardSkeleton />}>
                  <SupportTickets defaultContext={supportContext} />
                </React.Suspense>
              </div>
            )}

            {/* ================= VIEW 6: STATIC INFORMATIONAL & LEGAL PAGES ================= */}
            {currentView === 'about' && <About />}
            {currentView === 'contact' && <Contact />}
            {currentView === 'privacy' && <PrivacyPolicy />}
            {currentView === 'terms' && <TermsOfService />}
            {currentView === '404' && <NotFound />}

          </>
        )}

      </main>

      {/* Floating Action Button (Active Filters for search page on Mobile) */}
      {currentView === 'search' && activeRole === 'client' && (
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-pitch text-chalk flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg hover:bg-[#15462E] active:scale-[0.97] transition md:hidden cursor-pointer ease-out"
        >
          <Filter size={16} />
          <span className="font-sans text-xs font-bold">Filters</span>
        </button>
      )}


      
      {/* ================= GLOBAL DESIGN SYSTEM FOOTER ================= */}
      {activeRole === 'client' && (
<footer className="bg-pitch mt-auto pt-16 pb-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
            
            {/* Brand column */}
            <div className="lg:col-span-4 space-y-4">
              <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="inline-block cursor-pointer">
                <img src="/logo-full.png" alt="GroundKart" className="h-16 md:h-20 w-auto object-contain" />
              </a>
              <p className="font-sans text-sm text-chalk/60 leading-relaxed max-w-sm font-light">
                Find. Explore. Own. The ultimate premium marketplace for booking venues and event spaces.
              </p>
            </div>
            
            <div className="lg:col-span-2 lg:col-start-6">
              <h4 className="font-sans text-sm font-bold text-chalk mb-4 tracking-wider uppercase">Explore</h4>
              <ul className="space-y-3 font-sans text-sm text-chalk/60">
                <li><a href="/search" onClick={(e) => { e.preventDefault(); navigate('/search'); }} className="hover:text-marigold transition">Find Grounds</a></li>
                <li><a href="/categories/sports" onClick={(e) => { e.preventDefault(); navigate('/categories/sports'); }} className="hover:text-marigold transition">Sports Grounds</a></li>
                <li><a href="/categories/banquet-halls" onClick={(e) => { e.preventDefault(); navigate('/categories/banquet-halls'); }} className="hover:text-marigold transition">Banquet Halls</a></li>
                <li><a href="/categories/corporate" onClick={(e) => { e.preventDefault(); navigate('/categories/corporate'); }} className="hover:text-marigold transition">Corporate Spaces</a></li>
              </ul>
            </div>
            
            <div className="lg:col-span-2">
              <h4 className="font-sans text-sm font-bold text-chalk mb-4 tracking-wider uppercase">For Owners</h4>
              <ul className="space-y-3 font-sans text-sm text-chalk/60">
                <li><button onClick={() => requireAuth(() => { if (user?.role === 'admin') navigate('/admin'); else navigate('/owner'); })} className="hover:text-marigold transition cursor-pointer text-left">List Your Venue</button></li>
                <li><button onClick={() => requireAuth(() => { if (user?.role === 'admin') navigate('/admin'); else navigate('/owner'); })} className="hover:text-marigold transition cursor-pointer text-left">Owner Dashboard</button></li>
                <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }} className="hover:text-marigold transition">Owner Support</a></li>
              </ul>
            </div>
            
            <div className="lg:col-span-2">
              <h4 className="font-sans text-sm font-bold text-chalk mb-4 tracking-wider uppercase">Company</h4>
              <ul className="space-y-3 font-sans text-sm text-chalk/60">
                <li><a href="/about" onClick={(e) => { e.preventDefault(); navigate('/about'); }} className="hover:text-marigold transition">About Us</a></li>
                <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigate('/contact'); }} className="hover:text-marigold transition">Contact</a></li>
                <li><a href="/support" onClick={(e) => { e.preventDefault(); navigate('/support'); }} className="hover:text-marigold transition">Help &amp; Support</a></li>
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h4 className="font-sans text-sm font-bold text-chalk mb-4 tracking-wider uppercase">Legal</h4>
              <ul className="space-y-3 font-sans text-sm text-chalk/60">
                <li><a href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }} className="hover:text-marigold transition">Privacy Policy</a></li>
                <li><a href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }} className="hover:text-marigold transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-sans text-xs text-chalk/50 font-medium">
              © {new Date().getFullYear()} GroundKart. All rights reserved.
            </p>
            <p className="font-sans text-xs text-chalk/50 font-medium flex items-center gap-1.5">
              Made with <Heart size={12} className="text-marigold" fill="currentColor" /> in India
            </p>
          </div>
        </div>
      </footer>
)}


    </div>
  );
}
