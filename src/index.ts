import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Import routes
import authRoutes from "./routes/auth";
import flashcardRoutes from "./routes/flashcards";
import flashcardAIRoutes from "./routes/flashcards-ai";
import studyRoutes from "./routes/study";
import studyModuleRoutes from "./routes/study-modules";
import userRoutes from "./routes/user";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

// Import AI config validation
import { validateAIConfig } from "./config/ai.config";

// Load environment variables
dotenv.config();

const app = express();
// Railway and other platforms provide PORT via environment variable
// Default to 5000 for local development
const PORT = parseInt(process.env.PORT || "5000", 10);

// Security middleware - configure helmet to allow React Native connections
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP for API (not needed for backend API)
  })
);
// CORS configuration - Allow all origins in development for React Native
// In production, allow Vercel frontend URL and any specified FRONTEND_URL
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
          ? [process.env.FRONTEND_URL]
          : true // Allow all in production if FRONTEND_URL not set (for Railway)
        : true, // Allow all origins in development (needed for React Native)
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/flashcards-ai", flashcardAIRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/study-modules", studyModuleRoutes);
app.use("/api/user", userRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server - bind to 0.0.0.0 to accept connections from network (needed for React Native)
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`🚀 SmartFlash Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Server listening on ${HOST}:${PORT}`);
  console.log(`📱 For Android emulator, use: http://10.0.2.2:${PORT}`);

  // Validate AI configuration after server starts
  console.log("\n🤖 AI Configuration:");
  validateAIConfig();
});

export default app;
