"""
Authentication routes - Register, Login, Get Current User
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
import uuid

from ..database import get_supabase_admin
from ..models import UserCreate, UserLogin, User, Token, Subscription, Usage
from ..auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user_id
)

router = APIRouter()

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user"""
    supabase = get_supabase_admin()
    
    # Check if user already exists
    existing = supabase.table("profiles").select("id").eq("email", user_data.email.lower()).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create trial subscription (5 days free)
    trial_end = (datetime.utcnow() + timedelta(days=5)).isoformat()
    default_subscription = Subscription(
        tier="free",
        status="active",
        currentPeriodEnd=trial_end
    )
    
    # Create default usage tracking
    default_usage = Usage(
        chatsToday=0,
        importsToday=0,
        lastResetDate=datetime.utcnow().date().isoformat()
    )
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Insert user
    user_id = str(uuid.uuid4())
    insert_data = {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name or user_data.email.split('@')[0],
        "password_hash": hashed_password,
        "subscription": default_subscription.model_dump(),
        "usage": default_usage.model_dump()
    }
    
    result = supabase.table("profiles").insert(insert_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user_id})
    
    return Token(access_token=access_token, token_type="bearer")

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login user"""
    supabase = get_supabase_admin()
    
    # Find user by email
    result = supabase.table("profiles")\
        .select("id, email, name, password_hash, subscription, usage, created_at")\
        .eq("email", credentials.email.lower())\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    user = result.data[0]
    
    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user["id"]})
    
    return Token(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=User)
async def get_current_user(user_id: str = Depends(get_current_user_id)):
    """Get current user profile"""
    supabase = get_supabase_admin()
    
    result = supabase.table("profiles")\
        .select("id, email, name, subscription, usage, created_at")\
        .eq("id", user_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return result.data[0]

@router.put("/me", response_model=User)
async def update_current_user(
    update_data: dict,
    user_id: str = Depends(get_current_user_id)
):
    """Update current user profile"""
    supabase = get_supabase_admin()
    
    # Only allow updating certain fields
    allowed_fields = {"name", "subscription", "usage"}
    filtered_data = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not filtered_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update"
        )
    
    result = supabase.table("profiles")\
        .update(filtered_data)\
        .eq("id", user_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return result.data[0]