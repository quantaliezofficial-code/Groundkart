import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, PlusCircle, Menu, X } from 'lucide-react';

interface AuthNavbarProps {
  logoOnly?: boolean;
}

export default function AuthNavbar({ logoOnly = false }: AuthNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Dark navigation bar matching the homepage */}
      <div className="bg-[#032017]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px]">
            {/* ── Brand Logo (Always visible) ── */}
            <Link to="/" className="flex items-center flex-shrink-0 cursor-pointer" id="logo">
              <img src="/logo-full.png" alt="GroundKart" className="h-14 sm:h-16 w-auto object-contain py-1" />
            </Link>

            {/* If logoOnly is false, render search, nav items, and CTAs */}
            {!logoOnly && (
              <>
                {/* ── Center search bar (matching homepage) ── */}
                <div className="relative hidden md:block mx-4 lg:mx-8 w-[280px] lg:w-[320px]">
                  <Link to="/?view=search" className="block relative rounded-full bg-white/10 hover:bg-white/[0.13] transition group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-hover:text-white/60">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      readOnly
                      placeholder="Search venues, sports, cities..."
                      className="w-full bg-transparent rounded-full pl-11 pr-4 py-2.5 text-[13px] text-white placeholder:text-white/40 focus:outline-none cursor-pointer"
                    />
                  </Link>
                </div>

                {/* ── Right Navigation Links & CTAs ── */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <nav className="hidden lg:flex items-center gap-0.5 mr-3">
                    <Link to="/" className="px-3.5 py-2 rounded-full text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition">
                      Explore
                    </Link>
                    <Link to="/?view=search" className="px-3.5 py-2 rounded-full text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition">
                      Find Venues
                    </Link>
                    <Link to="/?view=my-bookings" className="px-3.5 py-2 rounded-full text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition">
                      My Bookings
                    </Link>
                    <Link to="/?view=support" className="px-3.5 py-2 rounded-full text-[13px] font-medium text-white/80 hover:text-white hover:bg-white/10 transition">
                      Support
                    </Link>
                  </nav>

                  <div className="hidden lg:block w-px h-5 bg-white/15 mx-1" />

                  <Link
                    to="/?action=list-venue"
                    className="hidden sm:flex items-center gap-1.5 bg-marigold hover:bg-[#e5952e] text-pitch px-4 py-[7px] rounded-full text-[13px] font-semibold active:scale-[0.97] transition cursor-pointer shadow-[0_2px_8px_rgba(242,163,59,0.25)]"
                  >
                    <PlusCircle size={14} strokeWidth={2.5} />
                    <span>List a Venue</span>
                  </Link>

                  <Link
                    to="/"
                    className="rounded-full border border-white/25 px-4 py-[7px] text-[13px] font-semibold text-white transition hover:bg-white hover:text-pitch cursor-pointer active:scale-[0.97] ml-0.5"
                  >
                    Log in
                  </Link>

                  {/* Mobile menu toggle */}
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="lg:hidden p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer ml-0.5"
                    aria-label="Toggle menu"
                  >
                    {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile dropdown navigation */}
        {!logoOnly && mobileMenuOpen && (
          <div className="lg:hidden px-4 pt-2 pb-4 space-y-1 bg-[#032017] border-b border-white/10 animate-in slide-in-from-top-2 duration-150">
            <Link to="/" className="block px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10">
              Explore
            </Link>
            <Link to="/?view=search" className="block px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10">
              Find Venues
            </Link>
            <Link to="/?view=my-bookings" className="block px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10">
              My Bookings
            </Link>
            <Link to="/?view=support" className="block px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10">
              Support
            </Link>
            <div className="pt-2 flex gap-2">
              <Link to="/?action=list-venue" className="flex-1 text-center bg-marigold text-pitch py-2 rounded-xl text-xs font-semibold">
                List a Venue
              </Link>
              <Link to="/" className="flex-1 text-center border border-white/20 text-white py-2 rounded-xl text-xs font-semibold">
                Log in
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
