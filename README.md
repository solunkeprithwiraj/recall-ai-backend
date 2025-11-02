# SmartFlash Backend

AI-Powered Flashcard Learning Companion - Backend API

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Prisma
- **Authentication**: JWT + OAuth (Google/Apple)
- **Caching**: Redis
- **AI**: Google Gemini API + LangGraph

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for local PostgreSQL and Redis)
- PostgreSQL 15+ with pgvector extension
- Redis

### Installation

```bash
npm install
```

### Development

```bash
# Start development server
npm run dev

# Run database migrations
npm run db:migrate

# Generate Prisma Client
npm run db:generate

# Open Prisma Studio
npm run db:studio
```

### Build

```bash
npm run build
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/smartflash_db"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# AI Provider
AI_PROVIDER="openai" # or 'vertex-ai', 'google-api-key', 'openrouter'
OPENAI_API_KEY="your-openai-api-key"

# See .env.example for all available options
```

## Deployment

### Railway

This backend is configured for Railway deployment:

1. Connect your GitHub repository to Railway
2. Set Root Directory to `.` (root of backend folder)
3. Railway will automatically detect the Dockerfile
4. Add PostgreSQL and Redis plugins
5. Configure environment variables in Railway dashboard

See [docs/DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `GET /api/flashcards` - Get all flashcards
- `POST /api/flashcards` - Create flashcard
- `GET /api/study/session` - Start study session
- `POST /api/study-modules/ai/generate` - Generate AI study module

See the route files in `src/routes/` for complete API documentation.

## Health Check

```bash
curl http://localhost:5000/health
```

## License

MIT

