"""
Locations routes - CRUD operations for business locations
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
import uuid
from datetime import datetime

from ..database import get_supabase_admin
from ..models import (
    Location,
    LocationCreate,
    LocationUpdate,
    LocationWithReviews
)
from ..auth_utils import get_current_user_id

router = APIRouter()

@router.get("/", response_model=List[Location])
async def get_locations(user_id: str = Depends(get_current_user_id)):
    """Get all locations for current user"""
    supabase = get_supabase_admin()
    
    result = supabase.table("locations")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .execute()
    
    # Ensure linked_accounts is always an object for each location
    locations = result.data
    for location in locations:
        if not location.get('linked_accounts'):
            location['linked_accounts'] = {}
    
    return locations

@router.post("/", response_model=Location, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationCreate,
    user_id: str = Depends(get_current_user_id)
):
    """Create a new location"""
    supabase = get_supabase_admin()
    
    insert_data = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": location_data.name,
        "linked_accounts": {},
        "is_syncing": False,
        "sync_stage": "idle"
    }
    
    result = supabase.table("locations").insert(insert_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create location"
        )
    
    return result.data[0]

@router.get("/{location_id}", response_model=LocationWithReviews)
async def get_location(
    location_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Get a specific location with its reviews"""
    supabase = get_supabase_admin()
    
    # Get location
    location_result = supabase.table("locations")\
        .select("*")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    location = location_result.data[0]
    
    # Ensure linked_accounts is always an object (not null)
    if not location.get('linked_accounts'):
        location['linked_accounts'] = {}
    
    # Get reviews for this location
    reviews_result = supabase.table("reviews")\
        .select("*")\
        .eq("location_id", location_id)\
        .eq("is_archived", False)\
        .order("review_date", desc=True)\
        .execute()
    
    # Ensure each review has default values for required fields
    reviews = reviews_result.data or []
    for review in reviews:
        if review.get('tags') is None:
            review['tags'] = []
        if review.get('assigned_to') is None:
            review['assigned_to'] = None
    
    location["reviews"] = reviews
    
    return location

@router.put("/{location_id}", response_model=Location)
async def update_location(
    location_id: str,
    update_data: LocationUpdate,
    user_id: str = Depends(get_current_user_id)
):
    """Update a location"""
    supabase = get_supabase_admin()
    
    # Verify ownership
    existing = supabase.table("locations")\
        .select("id")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    # Prepare update data (exclude None values)
    update_dict = {
        k: v for k, v in update_data.model_dump().items()
        if v is not None
    }
    
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update"
        )
    
    update_dict["updated_at"] = datetime.utcnow().isoformat()
    
    result = supabase.table("locations")\
        .update(update_dict)\
        .eq("id", location_id)\
        .execute()
    
    return result.data[0]

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Delete a location (cascade deletes reviews)"""
    supabase = get_supabase_admin()
    
    # Verify ownership
    existing = supabase.table("locations")\
        .select("id")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    # Delete (will cascade to reviews due to foreign key)
    supabase.table("locations").delete().eq("id", location_id).execute()
    
    return None