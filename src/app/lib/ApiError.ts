// src/lib/ApiError.ts

/**
 * Custom HTTP error class for use in API routes and service functions.
 * 
 * Usage:
 *   throw new ApiError(404, "User not found");
 * 
 * In the catch block:
 *   if (error instanceof ApiError) {
 *     return NextResponse.json({ error: error.message }, { status: error.statusCode });
 *   }
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.isOperational = isOperational; // true = expected business error, false = unexpected crash

    // Maintains proper stack trace in V8 (Node.js/Next.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}
