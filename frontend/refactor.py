import re
import os

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace(
    "import React, { useState, useEffect, useMemo } from 'react';",
    "import React, { useState, useEffect, useMemo } from 'react';\nimport { Routes, Route, useNavigate, useLocation, useParams, Navigate, Link } from 'react-router-dom';\nimport PrivacyPolicy from './components/PrivacyPolicy';\nimport TermsOfService from './components/TermsOfService';\nimport NotFound from './components/NotFound';\nimport ForgotPassword from './components/ForgotPassword';"
)

# 2. currentView state -> navigate
code = re.sub(
    r"const \[currentView, setCurrentView\] = useState<'home' \| 'search' \| 'detail' \| 'checkout' \| 'my-bookings'>\('home'\);",
    "const navigate = useNavigate();\n  const location = useLocation();\n  const currentView = location.pathname.startsWith('/search') ? 'search' : location.pathname.startsWith('/venues') ? 'detail' : location.pathname.startsWith('/checkout') ? 'checkout' : location.pathname.startsWith('/my-bookings') ? 'my-bookings' : 'home';",
    code
)

code = code.replace("setCurrentView('search');", "navigate('/search');")
code = code.replace("setCurrentView('checkout');", "navigate('/checkout');")
code = code.replace("setCurrentView('my-bookings');", "navigate('/my-bookings');")
code = code.replace("setCurrentView('home');", "navigate('/');")
code = code.replace("setCurrentView('detail');", "navigate(`/venues/${selectedVenueId}`);")


# 3. Header onNavigate
code = code.replace(
    """        onNavigate={(view) => {
          setActiveRole('client');
          if (view === 'search') {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
          }
          setCurrentView(view);
        }}""",
    """        onNavigate={(view) => {
          setActiveRole('client');
          if (view === 'search') {
            setIsLoading(true);
            setTimeout(() => setIsLoading(false), 500);
            navigate('/search');
          } else if (view === 'home') {
            navigate('/');
          } else if (view === 'detail') {
            navigate(`/venues/${selectedVenueId}`);
          } else if (view === 'checkout') {
            navigate('/checkout');
          } else if (view === 'my-bookings') {
            navigate('/my-bookings');
          }
        }}"""
)

# 4. Detail view navigation in VenueCard click & Hero featured click
code = code.replace(
    """                      onClick={() => {
                        setSelectedVenueId(featuredVenueObj.id);
                        setCurrentView('detail');
                      }}""",
    """                      onClick={() => {
                        setSelectedVenueId(featuredVenueObj.id);
                        navigate('/venues/' + featuredVenueObj.id, { state: { venue: featuredVenueObj } });
                      }}"""
)
code = code.replace(
    """                            onClick={(id) => {
                              setSelectedVenueId(id);
                              setCurrentView('detail');
                            }}""",
    """                            onClick={(id) => {
                              setSelectedVenueId(id);
                              navigate('/venues/' + id, { state: { venue: trendingVenues.find((v: any) => v.id === id) } });
                            }}"""
)

# 5. Active Role navigation
code = code.replace(
    "localStorage.setItem('groundbooking_active_role', activeRole);",
    "localStorage.setItem('groundbooking_active_role', activeRole);\n    if (activeRole === 'owner' && location.pathname !== '/owner') navigate('/owner');\n    else if (activeRole === 'admin' && location.pathname !== '/admin') navigate('/admin');\n    else if (activeRole === 'client' && (location.pathname === '/owner' || location.pathname === '/admin')) navigate('/');"
)

# 6. Skip link
code = code.replace(
    '<div className="bg-mist text-ink font-sans min-h-screen flex flex-col antialiased">',
    '<div className="bg-mist text-ink font-sans min-h-screen flex flex-col antialiased">\n      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-green-600 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:font-medium">Skip to main content</a>'
)
code = code.replace(
    '<main className="flex-grow flex flex-col">',
    '<main id="main-content" className="flex-grow flex flex-col">'
)

# 7. Add wrapper before App component
wrapper = '''
function VenueDetailWrapper({ realVenues, handleInitiateBooking }: any) {
  const { id } = useParams();
  const location = useLocation();
  const stateVenue = location.state?.venue;
  const { venue: activeVenueFromApi } = useVenue(id);
  const { slots: activeVenueSlots } = useVenueSlots(id);
  
  const activeVenueObj = stateVenue || activeVenueFromApi || realVenues.find((v: any) => v.id === id);
  const navigate = useNavigate();

  return (
    <React.Suspense fallback={<DetailSkeleton />}>
      {activeVenueObj ? (
        <DetailView 
          venue={activeVenueObj} 
          slots={activeVenueSlots || []}
          onBack={() => navigate(-1)} 
          onInitiateBooking={handleInitiateBooking}
        />
      ) : (
        <DetailSkeleton />
      )}
    </React.Suspense>
  )
}

export default function App() {
'''
code = code.replace('export default function App() {', wrapper)

# 8. Routes

start_idx = code.find("{activeRole === 'owner' ?")
end_idx = code.find("</main>", start_idx)

if start_idx != -1 and end_idx != -1:
    def extract_jsx(view_name):
        pattern = re.compile(r"\{\s*currentView === '" + view_name + r"' && \(\s*(.*?)\s*\)\s*\}", re.DOTALL)
        match = pattern.search(code[start_idx:end_idx])
        if match:
            return match.group(1)
        return ""
    
    home_jsx = extract_jsx("home")
    search_jsx = extract_jsx("search")
    
    checkout_match = re.compile(r"\{\s*currentView === 'checkout' && \(\s*(<div.*?</React.Suspense>\s*</div>)\s*\)\s*\}", re.DOTALL).search(code[start_idx:end_idx])
    checkout_jsx = checkout_match.group(1) if checkout_match else ""
    
    my_bookings_match = re.compile(r"\{\s*currentView === 'my-bookings' && \(\s*(<div.*?</React.Suspense>\s*</div>)\s*\)\s*\}", re.DOTALL).search(code[start_idx:end_idx])
    my_bookings_jsx = my_bookings_match.group(1) if my_bookings_match else ""

    new_router = f'''
        <Routes>
          <Route path="/owner" element={{
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
              <React.Suspense fallback={{<DashboardSkeleton />}}>
                <OwnerLayout />
              </React.Suspense>
            </div>
          }} />
          <Route path="/admin" element={{
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
              <React.Suspense fallback={{<DashboardSkeleton />}}>
                <AdminLayout />
              </React.Suspense>
            </div>
          }} />
          <Route path="/" element={{
            {home_jsx}
          }} />
          <Route path="/search" element={{
            {search_jsx}
          }} />
          <Route path="/venues/:id" element={{
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
              <VenueDetailWrapper realVenues={{realVenues}} handleInitiateBooking={{handleInitiateBooking}} />
            </div>
          }} />
          <Route path="/checkout" element={{
            {checkout_jsx}
          }} />
          <Route path="/my-bookings" element={{
            {my_bookings_jsx}
          }} />
          <Route path="/privacy" element={{<PrivacyPolicy />}} />
          <Route path="/terms" element={{<TermsOfService />}} />
          <Route path="/forgot-password" element={{<ForgotPassword />}} />
          <Route path="*" element={{<NotFound />}} />
        </Routes>
    '''
    
    code = code[:start_idx] + new_router + code[end_idx:]
else:
    print("Could not find start/end indices for routing")


# 9. Footer Links
code = code.replace(
    '''onClick={(e) => { e.preventDefault(); alert('Help center ticketing is active at support@venuesetu.com'); }}''',
    ''''''
)
code = code.replace(
    '''<a href="#" onClick={(e) => { e.preventDefault(); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Privacy Policy
              </a>''',
    '''<Link to="/privacy" className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Privacy Policy
              </Link>'''
)
code = code.replace(
    '''<a href="#" onClick={(e) => { e.preventDefault(); }} className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Terms of Service
              </a>''',
    '''<Link to="/terms" className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Terms of Service
              </Link>'''
)
code = code.replace(
    '''<a href="#" className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Help Center
              </a>''',
    '''<a href="mailto:support@groundbooking.in" className="font-sans text-sm text-chalk/60 hover:text-marigold transition-colors w-fit">
                Help Center
              </a>'''
)

# Social links replacements
social_links_pattern = re.compile(r'<div className="flex gap-4 pt-2">\s*\{\s*/\*\s*Social icons placeholder dots\s*\*/\s*\}\s*<div.*?<span.*?</span></div>\s*<div.*?<span.*?</span></div>\s*<div.*?<span.*?</span></div>\s*</div>', re.DOTALL)
social_links_replacement = '''<div className="flex gap-4 pt-2">
                {/* Social icons placeholder dots */}
                <a href="https://twitter.com/groundbooking" target="_blank" rel="noopener noreferrer" aria-label="Follow GroundBooking on X (Twitter)" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-marigold/20 hover:text-marigold text-chalk/60 transition-colors cursor-pointer"><span className="text-lg">𝕏</span></a>
                <a href="https://twitter.com/groundbooking" target="_blank" rel="noopener noreferrer" aria-label="Follow GroundBooking on X (Twitter)" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-marigold/20 hover:text-marigold text-chalk/60 transition-colors cursor-pointer"><span className="text-lg">in</span></a>
                <a href="https://twitter.com/groundbooking" target="_blank" rel="noopener noreferrer" aria-label="Follow GroundBooking on X (Twitter)" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-marigold/20 hover:text-marigold text-chalk/60 transition-colors cursor-pointer"><span className="text-lg">ig</span></a>
              </div>'''
code = social_links_pattern.sub(social_links_replacement, code)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("App.tsx refactored")
