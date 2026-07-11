"use client"
import React from 'react';
import { FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa';

const Footer: React.FC = () => {
  const date = `${new Date().getFullYear()}`;
  return (
    <footer className="bg-black border-t border-white/5 pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-24 max-w-md">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shadow-lg">
                <img src="/mylogo.webp" className="w-full h-full object-cover" alt="logo" />
              </div>
              <span className="text-xl font-bold tracking-tighter text-white">
                Ticketing<span className="text-slate-400">System</span>
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              A multi-role operational reconciliation platform built around float movement,
               transaction tracking, remittance, and commission calculation.
            </p>
          </div>
        </div>

        <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-center md:text-left">
              © {date} CimessDev Inc. All rights reserved.
            </p>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors"><FaTwitter className="w-5 h-5" /></a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors"><FaLinkedin className="w-5 h-5" /></a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors"><FaInstagram className="w-5 h-5" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
