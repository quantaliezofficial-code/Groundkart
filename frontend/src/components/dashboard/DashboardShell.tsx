import React, { useState } from 'react';
import { Menu, X, LogOut, Globe } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  onClick?: () => void;
  href?: string;
}

export interface DashboardShellProps {
  title: string;
  description?: string;
  navItems: NavItem[];
  activeNavId: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  userRole?: string;
  userName?: string;
  onLogout?: () => void;
  onReturnToSite?: () => void;
}

export function DashboardShell({
  title,
  description,
  navItems,
  activeNavId,
  children,
  headerActions,
  userRole,
  userName,
  onLogout,
  onReturnToSite
}: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] bg-mist w-full">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-pitch/50 transition-opacity lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-surface-container-lowest border-r border-surface-container transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-surface-container lg:hidden">
          <a href="/" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-pitch">GroundKart</span>
          </a>
          <button 
            className="lg:hidden p-1 text-on-surface-variant"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col justify-between h-full">
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 no-scrollbar">
            {navItems.map((item) => {
              const isActive = activeNavId === item.id;
              const content = (
                <>
                  <item.icon size={18} />
                  <span className="font-sans text-sm font-medium">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto rounded-full bg-clay px-2 py-0.5 font-sans text-xs text-chalk">
                      {item.badge}
                    </span>
                  )}
                </>
              );

              const className = `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isActive 
                  ? 'bg-primary-container text-chalk' 
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-ink'
              }`;

              if (item.href) {
                return (
                  <a key={item.id} href={item.href} className={className} onClick={() => setIsMobileMenuOpen(false)}>
                    {content}
                  </a>
                );
              }

              return (
                <button 
                  key={item.id} 
                  onClick={() => {
                    item.onClick?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left ${className}`}
                >
                  {content}
                </button>
              );
            })}
          </nav>
          
          {userName && userRole && (
            <div className="p-4 border-t border-surface-container">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pitch text-sm font-bold text-chalk">
                  {userName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-sm font-semibold text-ink">{userName}</p>
                  <p className="truncate font-sans text-xs text-on-surface-variant capitalize">{userRole}</p>
                </div>
                <div className="flex gap-1">
                  {onReturnToSite && (
                    <button onClick={onReturnToSite} className="p-1.5 text-on-surface-variant hover:text-ink hover:bg-surface-container rounded-md transition-colors" title="Return to site">
                      <Globe size={16} />
                    </button>
                  )}
                  {onLogout && (
                    <button onClick={onLogout} className="p-1.5 text-on-surface-variant hover:text-clay hover:bg-red-50 rounded-md transition-colors" title="Log out">
                      <LogOut size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-surface-container bg-surface-container-lowest/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-on-surface-variant"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-pitch tracking-tight">{title}</h1>
              {description && <p className="hidden sm:block font-sans text-sm text-on-surface-variant">{description}</p>}
            </div>
          </div>
          
          {headerActions && (
            <div className="flex items-center gap-4">
              {headerActions}
            </div>
          )}
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
