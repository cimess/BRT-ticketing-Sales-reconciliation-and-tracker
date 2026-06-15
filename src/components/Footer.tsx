"use client"
import Link from 'next/link';
import { FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa';

const Footer: React.FC = () => {
  const date = `${new Date().getFullYear()}`;
  return (
    <footer className="bg-black border-t border-white/5 pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
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

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-6">Platform</h4>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/reports" className="hover:text-white transition-colors">Reports</Link></li>
              <li><Link href="/sales" className="hover:text-white transition-colors">Sales</Link></li>
              <li><Link href="/news" className="hover:text-white transition-colors">News</Link></li>
              <li><Link href="/supervisor" className="hover:text-white transition-colors">Supervisor</Link></li>
              <li><Link href="/messages" className="hover:text-white transition-colors">Messages</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-6">Support</h4>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API Support</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Fees</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-xs uppercase tracking-widest mb-6">Legal</h4>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-slate-500">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/risk" className="hover:text-white transition-colors">Risk Disclosure</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] text-center md:text-left">
              © {date} CimessDev Inc. <br className="md:hidden" /> All rights reserved.
            </p>
            <Link href="/consent" className="text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-[0.2em] transition-colors border-l border-white/10 pl-6 h-4 flex items-center">
              Consent Preferences
            </Link>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white transition-colors"><FaTwitter className="w-5 h-5" strokeWidth={1.5} /></a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors"><FaLinkedin className="w-5 h-5" strokeWidth={1.5} /></a>
            <a href="#" className="text-slate-500 hover:text-white transition-colors"><FaInstagram className="w-5 h-5" strokeWidth={1.5} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;