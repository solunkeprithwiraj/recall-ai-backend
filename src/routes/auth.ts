import { Router } from "express";
import authService from "../services/auth.service";
import { authenticate, login, signup } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", signup);

/**
 * POST /api/auth/login
 * Login a user
 */
router.post("/login", login);

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, but we log it here for tracking)
 */
router.post("/logout", authenticate, async (req, res) => {
  // In a JWT system, logout is primarily client-side (token removal)
  // This endpoint is here for consistency and future token blacklisting
  return res.json({
    success: true,
    message: "Logout successful",
  });
});

/**
 * GET /api/auth/profile
 * Get current user profile (protected route)
 */
router.get("/profile", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.getUserById(userId);

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
