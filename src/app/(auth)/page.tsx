"use client";

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { redirectByRole } from "@/lib/redirectByRole";

export default function Login({ loginUi = true }: { loginUi?: boolean }) {
  const [showLoader, setShowLoader] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState("Welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Input Validations
    if (!email) {
      toast.warn("Please enter email");
      return;
    }
    if (password.length < 6) {
      toast.warn("Please enter password more than 6 characters");
      return;
    }

    try {
      setShowLoader(true);

      // 1. Fire NextAuth Authentication Check
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false // Keep full control on the client component
      });

      // 2. CATCH THE CREDENTIALS ERROR SEEN IN LOGS
      if (res?.error) {
        setShowLoader(false);
        toast.error("Invalid email or password. Please try again.");
        setMessage("Authentication failed");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return; 
      }

      if (res?.ok) {
        toast.success("Login successful");

        // 3. SOLID FIX FOR TIME RACES: Explicitly fetch the fresh session right now!
        const sessionResponse = await fetch('/api/auth/session').then(res => res.json());
        const userRole = sessionResponse?.user?.role;

        if (userRole) {
          // 4. Force browser redirection to the dashboard
          navigate.push(redirectByRole(userRole));
        } else {
          toast.error("Account authenticated, but role mapping is missing.");
          setShowLoader(false);
        }
      }
    } catch (err) {
      setShowLoader(false);
      const errorMessage = "Something went wrong on the server";
      toast.error(errorMessage);
      setMessage(errorMessage);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <div className="min-h-screen overflow-y-auto flex items-center justify-center py-20 bg-black">
        <div className={`relative w-[92%] sm:w-[85%] md:w-[70%] lg:w-[45%] rounded-3xl p-6 sm:p-12 premium-card transition-all duration-500 ${shake ? "animate-shake" : ""}`}>
          
          <h1 className="text-center text-white text-2xl sm:text-3xl font-bold mb-2 tracking-tighter">
            {loginUi ? "Welcome back" : "Create your account"}
          </h1>

          <p className="text-center text-slate-500 text-xs sm:text-sm mb-8 font-medium">
            {message}
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <input
                type="email"
                placeholder="Email"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setMessage("Enter your email")}
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setMessage("Enter your password")}
              />
              <button 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                type="button"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-indigo-500" />
                Remember me
              </label>
              <a href="#" className="text-cyan-400 hover:underline">Forgot password?</a>
            </div>

            <div className='flex items-center justify-center'>
              <button
                disabled={showLoader}
                className="w-full py-3.5 rounded-xl font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer bg-gradient-to-r from-cyan-400 to-blue-400 text-black hover:from-cyan-500 hover:to-blue-500"
                type="submit"
              >
                {showLoader ? "Signing in..." : "Login"}
              </button>
            </div>
          </form>

          <p className="text-center text-gray-400 text-xs sm:text-sm mt-6">
            Don’t have an account?
            <a href="/signup" className="text-cyan-400 ml-1 hover:underline">Sign up</a>
          </p>

        </div>
      </div>
    </Suspense>
  );
}
