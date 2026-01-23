"""
Integrations routes - Connect external platforms (GMB, Scraping)
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from ..database import get_supabase_admin
from ..auth_utils import get_current_user_id

router = APIRouter()

class GMBConnectRequest(BaseModel):
    location_id: str
    gmb_account_id: str
    gmb_location_id: str
    gmb_location_title: str
    access_token: str

@router.post("/gmb/connect")
async def connect_gmb(
    request: GMBConnectRequest,
    user_id: str = Depends(get_current_user_id)
):
    """Connect a Google My Business location"""
    supabase = get_supabase_admin()
    
    # Verify location ownership
    location = supabase.table("locations")\
        .select("*")\
        .eq("id", request.location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    # Update linked accounts
    linked_accounts = location.data[0].get("linked_accounts", {})
    linked_accounts["gmb"] = {
        "accountId": request.gmb_account_id,
        "locationId": request.gmb_location_id,
        "title": request.gmb_location_title,
        "lastSync": None,
        "importCount": 0
    }
    
    supabase.table("locations")\
        .update({"linked_accounts": linked_accounts})\
        .eq("id", request.location_id)\
        .execute()
    
    return {"success": True, "message": "GMB connected successfully"}

@router.delete("/gmb/disconnect/{location_id}")
async def disconnect_gmb(
    location_id: str,
    user_id: str = Depends(get_current_user_id)
):
    """Disconnect Google My Business"""
    supabase = get_supabase_admin()
    
    location = supabase.table("locations")\
        .select("linked_accounts")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    linked_accounts = location.data[0].get("linked_accounts", {})
    if "gmb" in linked_accounts:
        del linked_accounts["gmb"]
    
    supabase.table("locations")\
        .update({"linked_accounts": linked_accounts})\
        .eq("id", location_id)\
        .execute()
    
    return {"success": True, "message": "GMB disconnected"}

@router.delete("/{source}/disconnect/{location_id}")
async def disconnect_source(
    location_id: str,
    source: str,
    user_id: str = Depends(get_current_user_id)
):
    """Disconnect any external source"""
    supabase = get_supabase_admin()
    
    location = supabase.table("locations")\
        .select("linked_accounts")\
        .eq("id", location_id)\
        .eq("user_id", user_id)\
        .execute()
    
    if not location.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found"
        )
    
    linked_accounts = location.data[0].get("linked_accounts", {})
    if source in linked_accounts:
        del linked_accounts[source]
    
    supabase.table("locations")\
        .update({"linked_accounts": linked_accounts})\
        .eq("id", location_id)\
        .execute()
    
    return {"success": True, "message": f"{source} disconnected"}