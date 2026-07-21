import bcrypt from "bcrypt"
// import { sendVerificationEmail } from "@/workers/emailWorker";
import {prisma} from "@/lib/prisma"
import { ApiError } from "@/lib/ApiError";



interface RegisterBody {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    token: string;
    role?: "TICKETER" | "SUPERVISOR" | "ADMIN" | "AUDITOR";
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorAddress?: string;
    phoneNumber?: string;
    address?: string;
    companyCode: string;
    companyName?: string;
}


export default async function register(body: RegisterBody) {
    const { 
        email, 
        password, 
        firstName, 
        lastName, 
        token, 
        role, 
        guarantorName, 
        guarantorPhone, 
        guarantorAddress, 
        phoneNumber, 
        address, 
        companyCode,
        companyName 
    } = body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const user = await prisma.$transaction(async (tx) => {
        let regToken = null;
        let targetCompanyId = "";
        if(!companyCode||!token||!email||!password||!firstName||!lastName||!role){
            throw new ApiError(400,"Invalid Request");
        }
        // Admin Registration using global token
        if (token === process.env.REGISTER_TOKEN && role === "ADMIN") {
            // Find or create company
            let company = await tx.company.findFirst({
                where: { code: companyCode.toUpperCase() }
            });
            
            if (!company) {
                // Create company database record
                company = await tx.company.create({
                    data: {
                        name: companyName || `${companyCode.toUpperCase()} Venture`,
                        code: companyCode.toUpperCase()
                    }
                });
                              // 💡 CRITICAL: Initialize the CompanyFloat record with 0 balance for the company
               await tx.companyFloat.upsert({
                   where: { id:"COMPANY_ACCOUNT",company_id: company.id },
                   create: {
                       id: "COMPANY_ACCOUNT",
                       company_id: company.id,
                       available_balance: 0.00
                   },
                   update: {} // No-op if it already exists
               });

               // Initialize the TopUpBank record with 0 balance for the company
               await tx.topUpBank.upsert({
                   where: {id: "TOPUP_BANK",company_id: company.id },
                   create: {
                       id: "TOPUP_BANK",
                       company_id: company.id,
                       available_balance: 0.00
                   },
                   update: {} // No-op if it already exists
               });
            }

            targetCompanyId = company.id;
        } else {
            // Standard invite-based registration (Ticketer, Supervisor, Auditor)
            const company = await tx.company.findUnique({
                where: { code: companyCode.toUpperCase() }
            });
            
            if (!company) {
                throw new ApiError(404,"Company code not found. Please make sure the company code is correct.");
            }
            regToken = await tx.registrationToken.findUnique({
                where: { token }
            });
            if (!regToken) {
                throw new ApiError(401,"Invalid registration token");
            }
            
            // Validate token is for the user-specified company
            if (regToken.company_id !== company.id) {
                throw new ApiError(400,"Registration token does not match the provided company code");
            }
            
            if (regToken.is_used) {
                throw new ApiError(401,"Registration token has been used");
            }
            
            if (regToken.expires_at && regToken.expires_at < new Date()) {
                throw new ApiError(401,"Registration token has expired");
            }
            targetCompanyId = regToken.company_id;
        }
        // Check if user is already registered under this specific company
        const existingUser = await tx.user.findFirst({
            where: { 
                email,
                company_id: targetCompanyId
            }
        });
        if (existingUser) {
            throw new ApiError(400,"User already registered in this company. Please log in.");
        }
        // Use the token if registering standard user
        if (regToken) {
            await tx.registrationToken.update({
                where: { token },
                data: { is_used: true }
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create the scoped user
        const newUser = await tx.user.create({
            data: {
                email,
                password: hashedPassword,
                first_name: firstName,
                last_name: lastName,
                role: regToken?.role || "ADMIN",
                company_id: targetCompanyId,
                address,
                ...(guarantorName && { guarantor_name: guarantorName }),
                ...(guarantorPhone && { guarantor_phone: guarantorPhone }),
                ...(guarantorAddress && { guarantor_address: guarantorAddress }),
                ...(phoneNumber && { phone: phoneNumber }),
                verificationToken: otp,
                verificationTokenExpires: otpExpiry
            }
        });
        return newUser;
    });
    if (!user) {
        throw new ApiError(500,"User not registered");
    }
    return {
        success: true,
        message: "Registration successful. Please log in.",
        user: {
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name
        }
    };
}

export async function verifyRegToken(body:{token:string,companyCode:string}) {
    const {token,companyCode} = body;  
    
    if(!token || !companyCode){
        throw new ApiError(400,"Invalid Request");
    }
    // 💡 ADMIN global token verification: Bypasses check for pre-existing company
    if (token === process.env.REGISTER_TOKEN) {
        return {
            success: true,
            message: "Token verified",
            role: "ADMIN"
        };
    }
    const company = await prisma.company.findUnique({
        where: {
            code: companyCode.toUpperCase()
        }
    });
    
    if (!company) {
        throw new ApiError(404,"Company not found");
    }
    const regToken = await prisma.registrationToken.findUnique({
        where: {
            token,
            company_id: company.id
        }
    });
    if (!regToken) {
        console.log("Token not found",company.id,company.code,token)
        throw new ApiError(404,"Token not found");
    }
    if (regToken.is_used) {
        
        throw new ApiError(401,"Token already used");
    }
    if (regToken.expires_at && regToken.expires_at < new Date()) {
        throw new ApiError(401,"Token expired");
    }
    return {
        success: true,
        message: "Token verified",
        role: regToken.role
    };
}




// export async function regenerateOtp(body:{email:string,companyCode:string}) {
//     const {email,companyCode} = body;

//     if(!email || !companyCode){
//         throw new ApiError("Invalid Request", 400);
//     }

//         const company = await prisma.company.findUnique({
//         where: {
//             code: companyCode
//         }
//     })
//     if (!company) {
//         throw new ApiError("Company not found", 404)
//     }

//     const user = await prisma.user.findFirst({
//         where: { email, company_id: company.id }
//     });
//     if (!user) {
//         return { success: false, message: "No record found please Register",statusCode:401 };
//     }
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
//     await prisma.user.update({
//         where: { email ,company_id: company.id},
//         data: {
//             verificationToken: otp,
//             verificationTokenExpires: otpExpiry
//         }
//     })
//     sendVerificationEmail(email, otp);
//     return ({
//         success: true,
//         message: "OTP regenerated successfully",
//         user: {
//             email: user.email,
//             firstName: user.first_name,
//             lastName: user.last_name
//         }
//     })
// }


// export async function verifyEmail(body:{email:string,otp:string}) {



//     const { email, otp } = body;

//     try {
//         const user = await prisma.user.findFirst({
//             where: { email: email }
//         });

//         if (!user) {
//             throw new ApiError("User not found", 404)
//         }

   

//         if (user.verificationToken !== otp || !user.verificationTokenExpires ||
//             user.verificationTokenExpires < new Date()) {
//             throw new ApiError("Invalid or expired verification code", 400)
//         }

//         await prisma.user.update({
//             where: { id: user.id },
//             data: {
//                 isVerified: true,
//                 verificationToken: null,
//                 verificationTokenExpires: null
//             }
//         });
//         return {
//             success: true,
//             message: "Email verified successfully....",
//             user: { email: user.email }
//         };
//     } catch (err) {
//         if (err instanceof ApiError) {
//             return { success: false, message: err.message, statusCode: err.statusCode };
//         }
//         return { success: false, message: "Internal server error", statusCode: 500 };
//     }
// };







