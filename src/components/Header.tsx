"use client"
import React, { useState, useEffect } from 'react';
import { Menu, X, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation'

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate=useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Reports', href: '/reports' },
    { name: 'Sales', href: '/sales' },
    { name: 'News', href: '/news' },
    { name: 'Supervisor', href: '/supervisor' },
    { name: 'Messages', href: '/messages' }
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div
        onClick={()=>{navigate.push('/');window.scrollTo({top:0,behavior:'smooth'})}}
         className="flex items-center gap-4 cursor-pointer group">
          <div className="md:w-16 w-12 md:h-16 h-12 rounded-full overflow-hidden border border-white/10 shadow-xl group-hover:scale-105 transition-transform duration-300">
            <img src="/mylogo.png" className='w-full h-full object-cover' alt="logo"/>
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white hidden sm:block">
            Ticketing<span className="text-slate-400">System</span>
          </span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {link.name}
            </a>
          ))}

        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate.push('/login')}
            className="text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors px-4 py-2"
          >
            Log In
          </button>
          <button
            onClick={() => navigate.push('/signup')}
            className="bg-white text-black text-xs font-bold uppercase tracking-widest px-6 py-2.5 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
          >
            Get Started
          </button>
        </div>
        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X strokeWidth={1.5} /> : <Menu strokeWidth={1.5} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-black border-b border-white/5 p-8 animate-in slide-in-from-top-5">
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-slate-400 hover:text-white text-sm font-bold uppercase tracking-widest"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}

            <button
              onClick={() => {navigate.push('/login');setIsMobileMenuOpen(false)}}
              className="bg-white text-black py-4 rounded-xl font-bold uppercase text-xs tracking-widest w-full active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
