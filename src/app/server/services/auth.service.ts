import bcrypt from "bcrypt"
import { sendVerificationEmail } from "@/workers/emailWorker";
import { Roles} from "@prisma/client"
import crypto from "crypto"
import {prisma} from "@/lib/prisma"

// this was for handling errors since i dont want to download fastify/sensitive 
// so this make me able to throw errors with status codes to add status code to throw new Error
export class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}



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
}


export default async function register(body:RegisterBody) {

    const { email, password, firstName, lastName, token, role ,guarantorName,guarantorPhone,guarantorAddress,phoneNumber,address} = body


    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.$transaction(async (tx) => {
        let regToken = null;

        if(token !== process.env.REGISTER_TOKEN&&role === "ADMIN" ){
            throw new AppError("Invalid registration token ", 401)
            
        }

console.log("this is the regToken", regToken)

        if (role !== "ADMIN") {
            console.log("this is the regToken", regToken)
            regToken = await tx.registrationToken.findUnique({
                where: {
                    token: token
                }
            })

            if (!regToken) {
                throw new AppError("Invalid registration token ", 401)
                
            }
            if (regToken?.is_used) {
                throw new AppError("Registration token has been used", 401)
            }
            if (regToken?.expires_at && regToken?.expires_at < new Date()) {
                throw new AppError("Registration token has expired", 401)
            }

        const existingUser = await tx.user.findUnique({
            where: { email }
        });
        if (existingUser?.isVerified) {
            throw new AppError("User already registered. Please log in.", 400);
        }

        // if (existingUser && !existingUser.isVerified && existingUser.verificationToken) {
        //     sendVerificationEmail(email, otp);
        //     await tx.user.update({
        //         where: {
        //             email
        //         },
        //         data: {
        //             verificationTokenExpires: otpExpiry,
        //             verificationToken: otp
        //         }
        //     })
        //     return existingUser
        // }
          await tx.registrationToken.update({
                where: {
                    token
                },
                data: {
                    is_used: true,
                }
            }
            )
    }
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await tx.user.create({
            data: {
                email,
                password: hashedPassword,
                first_name: firstName,
                last_name: lastName,
                role: regToken?.role||"ADMIN",
                address,
                ...(guarantorName && {guarantor_name:guarantorName}),
                ...(guarantorPhone && {guarantor_phone:guarantorPhone}),
                ...(guarantorAddress && {guarantor_address:guarantorAddress}),
                ...(phoneNumber && {phone:phoneNumber}),
                verificationToken: otp,
                verificationTokenExpires: otpExpiry
            }
        })

        
      
        
        return user
        
    }
    )
    if (!user) {
        throw new AppError("User not registered", 500);
    }

    return {
        success: true,
        message: "Registration successful pls login",
        user: {
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name
        }
    }
    
  
}


export async function verifyRegToken(body:{token:string}) {
    const {token} = body;   
    const regToken = await prisma.registrationToken.findUnique({
        where: {
            token
        }
    })

       if (token === process.env.REGISTER_TOKEN&&!regToken) {
            return {
                success: true,
                message: "Token verified",
                role:"ADMIN"
            }
        }
    if (!regToken) {
        throw new AppError("admin Token not found", 404)
    }
    if (regToken.is_used) {
        throw new AppError("Token already used", 400)
    }
    if (regToken.expires_at && regToken.expires_at < new Date()) {
        throw new AppError("Token expired", 400)
    }
    return {
        success: true,
        message: "Token verified",
        role:regToken.role
    }

}

export  async function login(body:{email:string,password:string}) {
    // Assuming your body has email and password
    const { email, password } = body; // Cast properly to your LoginBody interface


    // 1. Find User
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return {
            success: false,
            message: "No record found please Register",
            statusCode: 401
        }
    }

    // 2. Check Password using your pepper
    const combinedPassword = password + (process.env.PASSWORD_SALT || "osarenowhen");
    const isValid = await bcrypt.compare(combinedPassword, user.password);
    console.log(isValid, "this is the bcrypt result")

    if (!isValid) {
        throw new AppError("Invalid email or password", 401);
    }

    // 3. Immediately block them if they are restricted!
    if (user.restricted) {
        throw new AppError("Your account has been restricted by an Admin.", 403);
    }


    // 5. Send success to React
    return {
        success: true,
        message: "Login successful",
        data: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
        }
    };
    
}

export async function regenerateOtp(body:{email:string}) {
    const {email} = body;
    const user = await prisma.user.findUnique({
        where: { email }
    });
    if (!user) {
        return { success: false, message: "No record found please Register",statusCode:401 };
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
        where: { email },
        data: {
            verificationToken: otp,
            verificationTokenExpires: otpExpiry
        }
    })
    sendVerificationEmail(email, otp);
    return ({
        success: true,
        message: "OTP regenerated successfully",
        user: {
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name
        }
    })
}


export async function verifyEmail(this: FastifyInstance, req: FastifyRequest, reply: FastifyReply) {




    const { email, otp } = req.body as any;

    try {
        const user = await this.prisma.user.findUnique({
            where: { email: email }
        });

        if (!user) {
            throw new AppError("User not found", 404)
        }

        if (user.isVerified) {
            req.session.set('userId', user.id);
            req.session.set('role', user.role);
            return reply.status(200).send({ success: true, message: "Email is already verified" });
        }

        if (user.verificationToken !== otp || !user.verificationTokenExpires ||
            user.verificationTokenExpires < new Date()) {
            throw new AppError("Invalid or expired verification code", 400)
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
                verificationTokenExpires: null
            }
        });
        return reply.send({
            success: true,
            message: "Email verified successfully....",
            user: { email: user.email }
        });
    } catch (err) {
        throw new AppError(err.message, 500)
    }
};





export async function deleteToken({token,userId}: {token: string,userId:string}) {
    try {

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        })
        const registrationToken = await this.prisma.registrationToken.findUnique({
            where: {
                token
            }
        })
        if (!user) {
            reply.status(404).send({
                success: false,
                message: "User not found"
            })
            return
        }
        if (user.role === registrationToken?.issued_by || user.role !== Roles.ADMIN) {
            reply.status(403).send({
                success: false,
                message: "User is not authorized to delete token"
            })
            return
        }
        const regToken = await this.prisma.registrationToken.deleteMany({
            where: {
                token
            }
        })
        if (regToken.count === 0) {
            reply.status(404).send({
                success: false,
                message: "Error in deleting token try again"
            })
            return
        }
        reply.send({
            success: true,
            message: "Token deleted successfully",
            token
        })
    }
    catch (error) {
        console.log("error in deleting token  ", error)
        reply.status(500).send({
            success: false,
            message: "Internal server error",
            error
        })
    }
}

