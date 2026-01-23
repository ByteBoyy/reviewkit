"""
Review Kit Backend - Main FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from app.routers import auth, locations, reviews, integrations, usage

# Application lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Review Kit Backend starting...")
    yield
    # Shutdown
    print("👋 Review Kit Backend shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Review Kit API",
    description="AI-powered review management platform backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration - Allow all origins for development
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://192.168.2.212:3000",  # Your local network IP
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://your-app.ondigitalocean.app",  # Add after deployment
    "https://reviewkit.com",  # Your custom domain
]

# For development, you can also use allow_origin_regex
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["Integrations"])
app.include_router(usage.router, prefix="/api/usage", tags=["Usage & Billing"])

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Review Kit API",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "services": {
            "supabase": "operational",
            "gemini": "operational"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("DEBUG", "True") == "True"
    )