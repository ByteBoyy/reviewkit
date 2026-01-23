"""
Usage & Billing routes - Track usage and manage subscriptions
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from datetime import datetime

from ..database import get_supabase_admin
from ..models import SubscriptionTier
from ..auth_utils import get_current_user_id

router = APIRouter()

class UsageStats(BaseModel):
    chatsToday: int
    importsToday: int
    lastResetDate: str
    tier: str
    limits: dict

class SubscriptionUpdate(BaseModel):
    tier: SubscriptionTier

@router.get("/", response_model=UsageStats)
async def get_usage_stats(user_id: str = Depends(get_current_user_id)):
    """Get current usage statistics"""
    supabase = get_supabase_admin()
    
    result = supabase.table("profiles")\
        .select("usage, subscription")\
        .eq("id", user_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    profile = result.data[0]
    usage = profile.get("usage", {})
    subscription = profile.get("subscription", {})
    tier = subscription.get("tier", "free")
    
    # Define tier limits
    TIER_LIMITS = {
        "free": {"chats": 5, "reviews": 50},
        "basic": {"chats": 20, "reviews": 200},
        "pro": {"chats": 100, "reviews": 1000},
        "enterprise": {"chats": 1000, "reviews": 10000}
    }
    
    # Reset usage if it's a new day
    today = datetime.utcnow().date().isoformat()
    last_reset = usage.get("lastResetDate")
    
    if last_reset != today:
        usage = {
            "chatsToday": 0,
            "importsToday": 0,
            "lastResetDate": today
        }
        supabase.table("profiles")\
            .update({"usage": usage})\
            .eq("id", user_id)\
            .execute()
    
    return UsageStats(
        chatsToday=usage.get("chatsToday", 0),
        importsToday=usage.get("importsToday", 0),
        lastResetDate=usage.get("lastResetDate", today),
        tier=tier,
        limits=TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    )

@router.post("/subscription/upgrade")
async def upgrade_subscription(
    subscription_data: SubscriptionUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Upgrade user subscription"""
    supabase = get_supabase_admin()
    
    # Calculate new period end (30 days from now)
    from datetime import timedelta
    period_end = (datetime.utcnow() + timedelta(days=30)).isoformat()
    
    new_subscription = {
        "tier": subscription_data.tier,
        "status": "active",
        "currentPeriodEnd": period_end
    }
    
    result = supabase.table("profiles")\
        .update({"subscription": new_subscription})\
        .eq("id", user_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "success": True,
        "subscription": new_subscription,
        "message": f"Upgraded to {subscription_data.tier} plan"
    }

@router.post("/subscription/cancel")
async def cancel_subscription(user_id: str = Depends(get_current_user_id)):
    """Cancel user subscription"""
    supabase = get_supabase_admin()
    
    result = supabase.table("profiles")\
        .select("subscription")\
        .eq("id", user_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    subscription = result.data[0].get("subscription", {})
    subscription["status"] = "canceled"
    
    supabase.table("profiles")\
        .update({"subscription": subscription})\
        .eq("id", user_id)\
        .execute()
    
    return {
        "success": True,
        "message": "Subscription canceled"
    }

@router.post("/increment/{usage_type}")
async def increment_usage(
    usage_type: str,
    count: int = 1,
    user_id: str = Depends(get_current_user_id)
):
    """Increment usage counter (chats or imports)"""
    if usage_type not in ["chats", "imports"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid usage type. Must be 'chats' or 'imports'"
        )
    
    supabase = get_supabase_admin()
    
    result = supabase.table("profiles")\
        .select("usage")\
        .eq("id", user_id)\
        .execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    usage = result.data[0].get("usage", {})
    today = datetime.utcnow().date().isoformat()
    
    # Reset if new day
    if usage.get("lastResetDate") != today:
        usage = {
            "chatsToday": 0,
            "importsToday": 0,
            "lastResetDate": today
        }
    
    # Increment appropriate counter
    if usage_type == "chats":
        usage["chatsToday"] = usage.get("chatsToday", 0) + count
    else:
        usage["importsToday"] = usage.get("importsToday", 0) + count
    
    supabase.table("profiles")\
        .update({"usage": usage})\
        .eq("id", user_id)\
        .execute()
    
    return {"success": True, "usage": usage}