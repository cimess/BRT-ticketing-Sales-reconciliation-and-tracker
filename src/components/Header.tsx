"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div
          onClick={() => { navigate.push('/'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="flex items-center gap-4 cursor-pointer group"
        >
          <div className="md:w-16 w-12 md:h-16 h-12 rounded-full overflow-hidden border border-white/10 shadow-xl group-hover:scale-105 transition-transform duration-300">
            <img src="/mylogo.png" className="w-full h-full object-cover" alt="logo" />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white hidden sm:block">
            Ticketing<span className="text-slate-400">System</span>
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;
