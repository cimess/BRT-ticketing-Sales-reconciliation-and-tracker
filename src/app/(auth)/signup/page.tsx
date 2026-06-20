"use client"

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link';
import { toast, Zoom } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Eye, EyeOff, User, ChevronDown } from "lucide-react"
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import axios from 'axios';





export default function Register() {

    const [showLoader, setShowLoader] = useState(false)
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [shake, setShake] = useState(false);
    const [message, setMessage] = useState("Welcome");
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [role, setRole] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [token, setToken] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [guarantorName, setGuarantorName] = useState("")
    const [guarantorPhone, setGuarantorPhone] = useState("")
    const [guarantorAddress, setGuarantorAddress] = useState("")
    const [phoneNumber, setPhoneNumber] = useState("")
    const [showPasswordToken, setShowPasswordToken] = useState(false)
    const [tokenMessage, setTokenMessage] = useState("")
    const [companyCode, setCompanyCode] = useState("")
    const [companyName, setCompanyName] = useState("")

    const navigate = useRouter();


    const handleVerifyToken = async (token_to_verify: string, company_code: string) => {


        try {
            const res = await api.post("/verifyToken", { token: token_to_verify, company_code })
            setRole(res.data.role)
            setTokenMessage(res.data.message)
            toast.success(res.data?.message)

        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.log(err?.response?.data, "i am here 1")
                toast.error(err?.response?.data?.message)
                setTokenMessage(err?.response?.data?.message)
            } else {
                console.log(err, "i am here 2")
                toast.error("Network error||system error")
                setTokenMessage("Network error||system error")
            }

            setRole("Please select your account role to proceed")
            setMessage("Please enter a valid token")
            setShake(true)
            setTimeout(() => setShake(false), 500)
        }
    }
    useEffect(() => {
        if (token.length < 16) return


        const timeout = setTimeout(() => {
            try {
                handleVerifyToken(token, companyCode)
            } catch (err) {
                setTokenMessage("Network error||system error")
                setRole("")
            }

        }, 800)

        return () => clearTimeout(timeout)
    }, [token])


    const handleRegistration = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) {
            toast.warning("Please enter token")
            setMessage("Please enter token")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (!email) {
            toast.warning("Please enter email")
            setMessage("Please enter email")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (password.length < 6) {
            toast.warning("Please enter password more than 6 characters")
            setMessage("Please enter password more than 6 characters")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (firstName.length < 3) {
            toast.warning("Please enter first name more than 3 characters")
            setMessage("Please enter first name more than 3 characters")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (lastName.length < 3) {
            toast.warning("Please enter last name more than 3 characters")
            setMessage("Please enter last name more than 3 characters")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (password !== confirmPassword) {
            toast.warning("Passwords do not match")
            setMessage("Passwords do not match")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (phoneNumber.length < 11) {
            toast.warning("Please enter phone number more than 11 characters")
            setMessage("Please enter phone number more than 11 characters")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }


        if (role === "Please select your account role to proceed") {
            toast.warning("Please select your account role")
            setMessage("Please select your account role")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }
        if (!companyCode) {
            toast.warning("Please enter company code")
            setMessage("Please enter company code")
            setShake(true)
            setTimeout(() => setShake(false), 500)
            return
        }


        try {
            setShowLoader(true)
            const res = await api.post('/register', {
                email,
                password,
                firstName,
                lastName,
                token,
                phoneNumber,
                companyCode,
                // so if the role is ADMIN, send the role, otherwise don't 
                // send it so i just dont send stuff that wont be used
                ...(role === "ADMIN" && { role, companyName }),
                ...(role !== "ADMIN" && { guarantorName, guarantorPhone, guarantorAddress, role })
            })

            if (res.data.success) {
                setShowLoader(false)
                toast.success(res.data?.message, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                    transition: Zoom,
                })
                setMessage(res.data?.message)
                navigate.push("/")

                return
            }
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const responseMessage = err?.response?.data?.message || "Something went wrong"
                setShowLoader(false)

                toast.warn(responseMessage)
                setMessage(responseMessage)
            } else {
                toast.error("Network error||system error")
                setMessage("Network error||system error")
            }

            setShake(true)
            setTimeout(() => setShake(false), 500)

        }

    }


    return (
        <Suspense>


            <>

                <div className="min-h-screen overflow-y-auto flex items-center justify-center py-20 bg-black">
                    <div
                        className={`relative w-[92%] sm:w-[85%] md:w-[70%] lg:w-[45%] rounded-3xl p-6 sm:p-12 premium-card transition-all duration-500
        ${shake ? "animate-shake" : ""}`}
                    >
                        {/* Badge */}


                        <h1 className="text-center text-white text-2xl sm:text-3xl font-bold mb-2 tracking-tighter">
                            Create your account
                        </h1>

                        <p className="text-center text-slate-500 text-xs sm:text-sm mb-8 font-medium">
                            {message}
                        </p>






                        <form onSubmit={handleRegistration} className="space-y-6  ">

                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value.trim())}
                                    onFocus={() => setMessage("Enter your email")}
                                />
                            </div>


                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value.trim())}
                                    onFocus={() => { setMessage("Enter your password") }}
                                />
                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-gray-800"
                                    type="button">
                                    {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}

                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Confirm Password"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value.trim())}
                                    onFocus={() => { setMessage("Enter your password") }}
                                />
                                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-gray-800"
                                    type="button">
                                    {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}

                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Company Code"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={companyCode}
                                    onChange={(e) => setCompanyCode(e.target.value.trim())}
                                    onFocus={() => setMessage("Enter your company code")}
                                />
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="First Name"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={firstName}
                                    onChange={(e) => { setFirstName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1).toLowerCase()); }}
                                    onFocus={() => setMessage("Enter your first name")}
                                />
                            </div>


                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={lastName}
                                    onChange={(e) => { setLastName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1).toLowerCase()); }}
                                    onFocus={() => setMessage('Enter your last name')}
                                />
                            </div>





                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Phone Number"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    onFocus={() => { setMessage("Enter your phone number") }}
                                />

                            </div>

                            <div className="relative">
                                <input
                                    type={showPasswordToken ? "text" : "password"}
                                    placeholder="Token"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={token}
                                    onChange={(e) => {
                                        setToken(e.target.value.trim());
                                    }}
                                    onFocus={() => { setMessage("Enter your token") }}
                                />
                                <button onClick={() => setShowPasswordToken(!showPasswordToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-gray-800"
                                    type="button">
                                    {showPasswordToken ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}

                                </button>
                                <p className={`mt-2 text-xs ${tokenMessage?.includes("Token verified") ? "text-green-500" : "text-red-500"}`}>{tokenMessage}</p>
                            </div>


                            <div className="relative group">
                                <div
                                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                                    className="w-full rounded-xl bg-white/10 border border-white/20
                text-white px-4 py-2.5 outline-none focus:ring-2 focus:ring-cyan-400 
                cursor-pointer flex items-center gap-4 transition-all hover:bg-white/15 active:scale-[0.99]"
                                >
                                    <User className="text-gray-400 shrink-0" size={18} />
                                    <span className="grow text-sm font-medium text-gray-400">
                                        {role === "TICKETER" ? "TICKETER" : role === "SUPERVISOR" ? "SUPERVISOR" : role === "ADMIN" ? "ADMIN" : role === "AUDITOR" ? "AUDITOR" : "Select Role"}
                                    </span>
                                    <ChevronDown
                                        className={`text-gray-400 transition-transform duration-300 ${showRoleDropdown ? 'rotate-180 text-cyan-400' : ''}`}
                                        size={18}
                                    />
                                </div>

                                {showRoleDropdown && (
                                    <div className="absolute top-full mt-2 left-0 right-0 rounded-xl bg-[#0f172a] border border-white/20 shadow-2xl overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                        <div
                                            onClick={() => { setRole("TICKETER"); setShowRoleDropdown(false); }}
                                            className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-4 ${role === 'TICKETER' ? 'bg-white/10 text-cyan-400' : 'text-white hover:bg-white/5'}`}
                                        >
                                            <User className={role === 'TICKETER' ? 'text-cyan-400' : 'text-gray-400'} size={18} />
                                            <span className="font-medium text-sm">Ticketer</span>
                                        </div>
                                        <div
                                            onClick={() => { setRole("SUPERVISOR"); setShowRoleDropdown(false); }}
                                            className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-4 ${role === 'SUPERVISOR' ? 'bg-white/10 text-cyan-400' : 'text-white hover:bg-white/5'}`}
                                        >
                                            <User className={role === 'SUPERVISOR' ? 'text-cyan-400' : 'text-gray-400'} size={18} />
                                            <span className="font-medium text-sm">Supervisor</span>
                                        </div>
                                        <div
                                            onClick={() => { setRole("ADMIN"); setShowRoleDropdown(false); }}
                                            className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-4 ${role === 'ADMIN' ? 'bg-white/10 text-cyan-400' : 'text-white hover:bg-white/5'}`}
                                        >
                                            <User className={role === 'ADMIN' ? 'text-cyan-400' : 'text-gray-400'} size={18} />
                                            <span className="font-medium text-sm">Admin</span>
                                        </div>
                                        <div
                                            onClick={() => { setRole("AUDITOR"); setShowRoleDropdown(false); }}
                                            className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-4 ${role === 'AUDITOR' ? 'bg-white/10 text-cyan-400' : 'text-white hover:bg-white/5'}`}
                                        >
                                            <User className={role === 'AUDITOR' ? 'text-cyan-400' : 'text-gray-400'} size={18} />
                                            <span className="font-medium text-sm">Auditor</span>
                                        </div>

                                    </div>
                                )}
                                <div className="text-cyan-300 text-[10px] px-4 mt-2 font-light">
                                    {role}
                                </div>
                            </div>
                            {role === "ADMIN" && <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Company Name"
                                    className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value.trim())}
                                    onFocus={() => setMessage("Enter your company name")}
                                />
                            </div>
                            }

                            {role !== "ADMIN" && role !== "Please select your account role to proceed" &&
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Guarantor's Name"
                                        className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                        value={guarantorName}
                                        onChange={(e) => setGuarantorName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1).toLowerCase())}
                                        onFocus={() => { setMessage("Enter your guarantor's name") }}
                                    />

                                </div>
                            }
                            {role !== "ADMIN" && role !== "Please select your account role to proceed" &&
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Guarantor's Phone Number"
                                        className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                        value={guarantorPhone}
                                        onChange={(e) => setGuarantorPhone(e.target.value.trim())}
                                        onFocus={() => { setMessage("Enter your guarantor's phone number") }}
                                    />

                                </div>
                            }
                            {role !== "ADMIN" && role !== "Please select your account role to proceed" &&
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Guarantor's Address"
                                        className="w-full rounded-xl bg-white/3 border border-white/10
              text-white px-5 py-3.5 outline-none focus:border-white/20 transition-all font-medium"
                                        value={guarantorAddress}
                                        onChange={(e) => setGuarantorAddress(e.target.value.trim())}
                                        onFocus={() => { setMessage("Enter your guarantor's address") }}
                                    />

                                </div>
                            }



                            {/* Button */}
                            <div className='flex items-center justify-center'>

                                <button
                                    disabled={showLoader}
                                    className="w-full py-3.5 rounded-xl font-bold tracking-tight transition-all active:scale-[0.98] disabled:opacity-50
                cursor-pointer bg-linear-to-r from-cyan-400 to-blue-400  text-black hover:from-cyan-500 hover:to-blue-500
            "
                                    type="submit"
                                >
                                    Create account
                                </button>
                            </div>

                            <div className="flex items-center justify-center mt-4 gap-2">
                                <input type="checkbox" className="accent-black" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                                <p className="text-center text-gray-400 text-xs sm:text-sm mt-0">
                                    By signing up, you agree to our{" "}
                                    <Link href="/terms" className="text-cyan-400 hover:underline">
                                        Terms & Policies
                                    </Link>
                                </p>
                            </div>

                        </form>

                        <p className="text-center text-gray-400 text-xs sm:text-sm mt-6">
                            Already have an account?
                            <Link href="/" className="text-cyan-400 ml-1 hover:underline">
                                Login
                            </Link>
                        </p>

                    </div>



                </div>

            </>


        </Suspense>

    );
}


