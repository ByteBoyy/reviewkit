# """
# Reviews routes - CRUD, sync, and AI analysis
# Updated to match new service files
# """
# from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
# from typing import List
# import uuid
# from datetime import datetime

# from ..database import get_supabase_admin
# from ..models import (
#     Review,
#     ReviewCreate,
#     ReviewUpdate,
#     SyncRequest,
#     AnalysisResult
# )
# from ..auth_utils import get_current_user_id
# # Updated imports to match new service files
# from ..services.gemini_service import analyze_reviews
# from ..services.scraper_service import fetch_real_external_reviews
# from ..services.gmb_service import gmb_service

# router = APIRouter()

# @router.get("/{location_id}/reviews", response_model=List[Review])
# async def get_reviews(
#     location_id: str,
#     user_id: str = Depends(get_current_user_id)
# ):
#     """Get all reviews for a location"""
#     supabase = get_supabase_admin()
    
#     # Verify location ownership
#     location = supabase.table("locations")\
#         .select("id")\
#         .eq("id", location_id)\
#         .eq("user_id", user_id)\
#         .execute()
    
#     if not location.data:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Location not found"
#         )
    
#     # Get reviews
#     result = supabase.table("reviews")\
#         .select("*")\
#         .eq("location_id", location_id)\
#         .eq("is_archived", False)\
#         .order("review_date", desc=True)\
#         .execute()
    
#     return result.data

# @router.post("/{location_id}/reviews", response_model=Review, status_code=status.HTTP_201_CREATED)
# async def create_review(
#     location_id: str,
#     review_data: ReviewCreate,
#     user_id: str = Depends(get_current_user_id)
# ):
#     """Create a new review manually"""
#     supabase = get_supabase_admin()
    
#     # Verify location ownership
#     location = supabase.table("locations")\
#         .select("id")\
#         .eq("id", location_id)\
#         .eq("user_id", user_id)\
#         .execute()
    
#     if not location.data:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Location not found"
#         )
    
#     # Create review
#     review_dict = review_data.model_dump()
    
#     # Convert datetime to ISO string for JSON serialization
#     if 'review_date' in review_dict and hasattr(review_dict['review_date'], 'isoformat'):
#         review_dict['review_date'] = review_dict['review_date'].isoformat()
    
#     insert_data = {
#         "id": str(uuid.uuid4()),
#         "location_id": location_id,
#         "tags": [],  # Add default empty tags
#         "is_archived": False,  # Add default archived status
#         **review_dict
#     }
    
#     result = supabase.table("reviews").insert(insert_data).execute()
    
#     if not result.data:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail="Failed to create review"
#         )
    
#     # Ensure tags field exists in response
#     created_review = result.data[0]
#     if created_review.get('tags') is None:
#         created_review['tags'] = []
    
#     return created_review

# @router.put("/{review_id}", response_model=Review)
# async def update_review(
#     review_id: str,
#     update_data: ReviewUpdate,
#     user_id: str = Depends(get_current_user_id)
# ):
#     """Update review (tags, assignment, archive status)"""
#     supabase = get_supabase_admin()
    
#     # Verify review belongs to user's location
#     review = supabase.table("reviews")\
#         .select("location_id")\
#         .eq("id", review_id)\
#         .execute()
    
#     if not review.data:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Review not found"
#         )
    
#     location_id = review.data[0]["location_id"]
    
#     location = supabase.table("locations")\
#         .select("id")\
#         .eq("id", location_id)\
#         .eq("user_id", user_id)\
#         .execute()
    
#     if not location.data:
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Not authorized to update this review"
#         )
    
#     # Update review
#     update_dict = {
#         k: v for k, v in update_data.model_dump().items()
#         if v is not None
#     }
    
#     result = supabase.table("reviews")\
#         .update(update_dict)\
#         .eq("id", review_id)\
#         .execute()
    
#     return result.data[0]

# @router.post("/{location_id}/sync")
# async def sync_reviews(
#     location_id: str,
#     sync_data: SyncRequest,
#     background_tasks: BackgroundTasks,
#     user_id: str = Depends(get_current_user_id)
# ):
#     """Sync reviews from external source"""
#     supabase = get_supabase_admin()
    
#     # Verify location ownership
#     location = supabase.table("locations")\
#         .select("*")\
#         .eq("id", location_id)\
#         .eq("user_id", user_id)\
#         .execute()
    
#     if not location.data:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Location not found"
#         )
    
#     # Check usage limits with daily reset logic
#     user_profile = supabase.table("profiles")\
#         .select("subscription, usage")\
#         .eq("id", user_id)\
#         .execute()
    
#     # Get usage and subscription with safe defaults
#     profile_data = user_profile.data[0] if user_profile.data else {}
#     usage = profile_data.get("usage", {})
#     subscription = profile_data.get("subscription", {})
#     tier = subscription.get("tier", "free")
    
#     # Check if we need to reset daily usage
#     last_reset = usage.get("lastReset")
#     current_imports = usage.get("importsToday", 0)
    
#     # Reset usage if it's a new day or if lastReset is missing
#     should_reset = False
#     if not last_reset:
#         should_reset = True
#     else:
#         try:
#             last_reset_date = datetime.fromisoformat(last_reset).date()
#             today = datetime.utcnow().date()
#             should_reset = today > last_reset_date
#         except:
#             should_reset = True
    
#     if should_reset:
#         # Reset daily usage counter
#         current_imports = 0
#         usage = {
#             "importsToday": 0,
#             "lastReset": datetime.utcnow().isoformat()
#         }
#         supabase.table("profiles")\
#             .update({"usage": usage})\
#             .eq("id", user_id)\
#             .execute()
    
#     # Tier limits
#     TIER_LIMITS = {
#         "free": {"reviews": 500},
#         "basic": {"reviews": 200},
#         "pro": {"reviews": 1000},
#         "enterprise": {"reviews": 10000}
#     }
    
#     limit = TIER_LIMITS.get(tier, {"reviews": 50})["reviews"]
    
#     # Check if user has exceeded their daily limit
#     if current_imports >= limit:
#         raise HTTPException(
#             status_code=status.HTTP_429_TOO_MANY_REQUESTS,
#             detail=f"Import limit reached ({current_imports}/{limit}). Resets tomorrow."
#         )
    
#     # Set syncing status
#     supabase.table("locations")\
#         .update({"is_syncing": True, "sync_stage": "scraping"})\
#         .eq("id", location_id)\
#         .execute()
    
#     # Perform sync based on source
#     try:
#         reviews = []
        
#         if sync_data.source == "gmb" and sync_data.gmb_location:
#             # Use GMB service (requires OAuth token to be set)
#             # Note: Token should be set elsewhere in your auth flow
#             reviews = await gmb_service.get_reviews(sync_data.gmb_location)
#         elif sync_data.url and sync_data.source in ["trustpilot", "tripadvisor", "getyourguide"]:
#             # Use scraper service with new function name
#             reviews = await fetch_real_external_reviews(
#                 url=sync_data.url,
#                 source=sync_data.source
#             )
        
#         # Insert new reviews (skip duplicates)
#         for review in reviews[:limit - current_imports]:
#             try:
#                 # Ensure date is string, not datetime object
#                 review_date = review["date"]
#                 if hasattr(review_date, 'isoformat'):
#                     review_date = review_date.isoformat()
                
#                 supabase.table("reviews").insert({
#                     "id": str(uuid.uuid4()),
#                     "location_id": location_id,
#                     "external_id": review.get("id"),
#                     "author": review["author"],
#                     "rating": review["rating"],
#                     "text": review.get("text", ""),
#                     "review_date": review_date,
#                     "source": sync_data.source,
#                     "url": review.get("url"),
#                     "tags": [],  # Add default empty tags
#                     "is_archived": False  # Add default archived status
#                 }).execute()
#             except Exception as e:
#                 # Skip duplicate reviews
#                 continue
        
#         # Update linked accounts
#         linked_accounts = location.data[0].get("linked_accounts", {})
#         if not isinstance(linked_accounts,dict):
#             linked_accounts = {}
#         linked_accounts[sync_data.source] = {
#             "url": sync_data.url or sync_data.gmb_location,
#             "lastSync": datetime.utcnow().isoformat(),
#             "importCount": len(reviews)
#         }
#         print(f"🔗 Updating linkedAccounts: {linked_accounts}")
#         # Update usage
#         new_imports = current_imports + len(reviews)
#         supabase.table("profiles")\
#             .update({"usage": {**usage, "importsToday": new_imports}})\
#             .eq("id", user_id)\
#             .execute()
        
#         # Change to analyzing stage
#         supabase.table("locations")\
#             .update({
#                 "sync_stage": "analyzing",
#                 "linked_accounts": linked_accounts,
#                 "updated_at": datetime.utcnow().isoformat()
#             })\
#             .eq("id", location_id)\
#             .execute()
        
#         # Get all reviews for analysis
#         all_reviews = supabase.table("reviews")\
#             .select("*")\
#             .eq("location_id", location_id)\
#             .eq("is_archived", False)\
#             .execute()
        
#         # Analyze with Gemini AI (updated function name)
#         analysis = await analyze_reviews(all_reviews.data)
        
#         # Update location with analysis
#         supabase.table("locations")\
#             .update({
#                 "last_analysis": analysis,
#                 "is_syncing": False,
#                 "sync_stage": "idle",
#                 "updated_at": datetime.utcnow().isoformat()
#             })\
#             .eq("id", location_id)\
#             .execute()
        
#         return {
#             "success": True,
#             "imported": len(reviews),
#             "analysis": analysis
#         }
        
#     except Exception as e:
#         # Reset syncing status on error
#         supabase.table("locations")\
#             .update({"is_syncing": False, "sync_stage": "idle"})\
#             .eq("id", location_id)\
#             .execute()
        
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=str(e)
#         )

# @router.post("/{location_id}/analyze", response_model=AnalysisResult)
# async def analyze_location_reviews(
#     location_id: str,
#     user_id: str = Depends(get_current_user_id)
# ):
#     """Trigger AI analysis for location reviews"""
#     supabase = get_supabase_admin()
    
#     # Verify ownership and get reviews
#     location = supabase.table("locations")\
#         .select("id")\
#         .eq("id", location_id)\
#         .eq("user_id", user_id)\
#         .execute()
    
#     if not location.data:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Location not found"
#         )
    
#     reviews = supabase.table("reviews")\
#         .select("*")\
#         .eq("location_id", location_id)\
#         .eq("is_archived", False)\
#         .execute()
    
#     if not reviews.data:
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="No reviews to analyze"
#         )
    
#     # Perform analysis (updated function name - removed _with_gemini suffix)
#     analysis = await analyze_reviews(reviews.data)
    
#     # Save analysis
#     supabase.table("locations")\
#         .update({"last_analysis": analysis})\
#         .eq("id", location_id)\
#         .execute()
    
#     return analysis
"""
Reviews routes - CRUD, sync, and AI analysis
Updated to match new service files - LIMITS DISABLED
"""
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from typing import List
import uuid
from datetime import datetime

from ..database import get_supabase_admin
from ..models import (
    Review,
    ReviewCreate,
    ReviewUpdate,
    SyncRequest,
    AnalysisResult
)
from ..auth_utils import get_current_user_id
# Updated imports to match new service files
from ..services.gemini_service import analyze_reviews
from ..services.scraper_service import fetch_real_external_reviews
from ..services.gmb_service import gmb_service

router = APIRouter()

@router.get("/{location_id}/reviews", response_model=List[Review])
async def get_reviews(
    location_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get all reviews for a location"""
    supabase = get_supabase_admin()
    
    # Verify location ownership
    location = supabase.table("locations")\
        .select("id")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    # Get reviews
    result = supabase.table("reviews")\
        .select("*")\
        .eq("location_id", location_id)\
        .eq("is_archived", False)\
        .order("review_date", desc=True)\
        .execute()
    
    return result.data

@router.post("/{location_id}/reviews", response_model=Review, status_code=status.HTTP_201_CREATED)
async def create_review(
    location_id: str,
    review_data: ReviewCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Create a new review manually"""
    supabase = get_supabase_admin()
    
    # Verify location ownership
    location = supabase.table("locations")\
        .select("id")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    # Create review
    review_dict = review_data.model_dump()
    
    # Convert datetime to ISO string for JSON serialization
    if 'review_date' in review_dict and hasattr(review_dict['review_date'], 'isoformat'):
        review_dict['review_date'] = review_dict['review_date'].isoformat()
    
    insert_data = {
        "id": str(uuid.uuid4()),
        "location_id": location_id,
        "tags": [],  # Add default empty tags
        "is_archived": False,  # Add default archived status
        **review_dict
    }
    
    result = supabase.table("reviews").insert(insert_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create review"
        )
    
    # Ensure tags field exists in response
    created_review = result.data[0]
    if created_review.get('tags') is None:
        created_review['tags'] = []
    
    return created_review

@router.put("/{review_id}", response_model=Review)
async def update_review(
    review_id: str,
    update_data: ReviewUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Update review (tags, assignment, archive status)"""
    supabase = get_supabase_admin()
    
    # Verify review belongs to user's location
    review = supabase.table("reviews")\
        .select("location_id")\
        .eq("id", review_id)\
        .execute()
    
    if not review.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    location_id = review.data[0]["location_id"]
    
    location = supabase.table("locations")\
        .select("id")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this review"
        )
    
    # Update review
    update_dict = {
        k: v for k, v in update_data.model_dump().items()
        if v is not None
    }
    
    result = supabase.table("reviews")\
        .update(update_dict)\
        .eq("id", review_id)\
        .execute()
    
    return result.data[0]

@router.post("/{location_id}/sync")
async def sync_reviews(
    location_id: str,
    sync_data: SyncRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id)
):
    """Sync reviews from external source - LIMITS DISABLED"""
    supabase = get_supabase_admin()
    
    # Verify location ownership
    location = supabase.table("locations")\
        .select("*")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    # Get user profile for usage tracking (but don't enforce limits)
    user_profile = supabase.table("profiles")\
        .select("subscription, usage")\
        .eq("id", user_id)\
        .execute()
    
    # Get usage and subscription with safe defaults
    profile_data = user_profile.data[0] if user_profile.data else {}
    usage = profile_data.get("usage", {})
    subscription = profile_data.get("subscription", {})
    
    # Check if we need to reset daily usage
    last_reset = usage.get("lastReset")
    current_imports = usage.get("importsToday", 0)
    
    # Reset usage if it's a new day or if lastReset is missing
    should_reset = False
    if not last_reset:
        should_reset = True
    else:
        try:
            last_reset_date = datetime.fromisoformat(last_reset).date()
            today = datetime.utcnow().date()
            should_reset = today > last_reset_date
        except:
            should_reset = True
    
    if should_reset:
        # Reset daily usage counter
        current_imports = 0
        usage = {
            "importsToday": 0,
            "lastReset": datetime.utcnow().isoformat()
        }
        supabase.table("profiles")\
            .update({"usage": usage})\
            .eq("id", user_id)\
            .execute()
    
    # LIMIT CHECK REMOVED - Allow unlimited imports
    # This section is commented out to disable the limit
    # if current_imports >= limit:
    #     raise HTTPException(
    #         status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    #         detail=f"Import limit reached ({current_imports}/{limit}). Resets tomorrow."
    #     )
    
    # Set syncing status
    supabase.table("locations")\
        .update({"is_syncing": True, "sync_stage": "scraping"})\
        .eq("id", location_id)\
        .execute()
    
    # Perform sync based on source
    try:
        reviews = []
        
        if sync_data.source == "gmb" and sync_data.gmb_location:
            # Use GMB service (requires OAuth token to be set)
            # Note: Token should be set elsewhere in your auth flow
            reviews = await gmb_service.get_reviews(sync_data.gmb_location)
        elif sync_data.url and sync_data.source in ["trustpilot", "tripadvisor", "getyourguide"]:
            # Use scraper service with new function name
            reviews = await fetch_real_external_reviews(
                url=sync_data.url,
                source=sync_data.source
            )
        
        # Insert ALL new reviews (no limit applied)
        for review in reviews:
            try:
                # Ensure date is string, not datetime object
                review_date = review["date"]
                if hasattr(review_date, 'isoformat'):
                    review_date = review_date.isoformat()
                
                supabase.table("reviews").insert({
                    "id": str(uuid.uuid4()),
                    "location_id": location_id,
                    "external_id": review.get("id"),
                    "author": review["author"],
                    "rating": review["rating"],
                    "text": review.get("text", ""),
                    "review_date": review_date,
                    "source": sync_data.source,
                    "url": review.get("url"),
                    "tags": [],  # Add default empty tags
                    "is_archived": False  # Add default archived status
                }).execute()
            except Exception as e:
                # Skip duplicate reviews
                continue
        
        # Update linked accounts
        linked_accounts = location.data[0].get("linked_accounts", {})
        if not isinstance(linked_accounts,dict):
            linked_accounts = {}
        linked_accounts[sync_data.source] = {
            "url": sync_data.url or sync_data.gmb_location,
            "lastSync": datetime.utcnow().isoformat(),
            "importCount": len(reviews)
        }
        print(f"🔗 Updating linkedAccounts: {linked_accounts}")
        
        # Update usage (tracking only, no limits)
        new_imports = current_imports + len(reviews)
        supabase.table("profiles")\
            .update({"usage": {**usage, "importsToday": new_imports}})\
            .eq("id", user_id)\
            .execute()
        
        # Change to analyzing stage
        supabase.table("locations")\
            .update({
                "sync_stage": "analyzing",
                "linked_accounts": linked_accounts,
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", location_id)\
            .execute()
        
        # Get all reviews for analysis
        all_reviews = supabase.table("reviews")\
            .select("*")\
            .eq("location_id", location_id)\
            .eq("is_archived", False)\
            .execute()
        
        # Analyze with Gemini AI (updated function name)
        analysis = await analyze_reviews(all_reviews.data)
        
        # Update location with analysis
        supabase.table("locations")\
            .update({
                "last_analysis": analysis,
                "is_syncing": False,
                "sync_stage": "idle",
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", location_id)\
            .execute()
        
        return {
            "success": True,
            "imported": len(reviews),
            "analysis": analysis
        }
        
    except Exception as e:
        # Reset syncing status on error
        supabase.table("locations")\
            .update({"is_syncing": False, "sync_stage": "idle"})\
            .eq("id", location_id)\
            .execute()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{location_id}/analyze", response_model=AnalysisResult)
async def analyze_location_reviews(
    location_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Trigger AI analysis for location reviews"""
    supabase = get_supabase_admin()
    
    # Verify ownership and get reviews
    location = supabase.table("locations")\
        .select("id")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    reviews = supabase.table("reviews")\
        .select("*")\
        .eq("location_id", location_id)\
        .eq("is_archived", False)\
        .execute()
    
    if not reviews.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No reviews to analyze"
        )
    
    # Perform analysis (updated function name - removed _with_gemini suffix)
    analysis = await analyze_reviews(reviews.data)
    
    # Save analysis
    supabase.table("locations")\
        .update({"last_analysis": analysis})\
        .eq("id", location_id)\
        .execute()
    
    return analysis