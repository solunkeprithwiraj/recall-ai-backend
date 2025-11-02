import { Request } from "express";

/**
 * Gets the user ID from the authenticated request.
 * Requires the authenticate middleware to be used before this function.
 */
export function getUserIdFromRequest(req: Request): string {
  if (!req.user || !req.user.userId) {
    throw new Error("User not authenticated. Please login first.");
  }
  return req.user.userId;
}
