"""
Google My Business service for fetching reviews
Python implementation matching TypeScript gmbService.ts
Handles OAuth2 authentication, accounts, locations, and reviews
"""
import httpx
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# API endpoints (matching TypeScript constants)
ACCOUNT_BASE_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
BUSINESS_BASE_URL = "https://mybusinessbusinessinformation.googleapis.com/v1"
REVIEWS_BASE_URL = "https://mybusiness.googleapis.com/v4"


class GMBService:
    """
    Google My Business Service
    Matches TypeScript GMBService class
    
    Note: Python server-side doesn't need CORS proxy like browser-based TypeScript
    """
    
    def __init__(self):
        self.access_token: Optional[str] = None
    
    def set_token(self, token: str):
        """Set OAuth2 access token"""
        self.access_token = token
        logger.info("GMB access token set")
    
    async def _fetch_with_auth(self, url: str, method: str = "GET", **kwargs) -> Dict[str, Any]:
        """
        Fetch with authentication
        Matches TypeScript fetchWithAuth() private method
        """
        if not self.access_token:
            raise Exception("Authentication token is missing. Please reconnect your Google account.")
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        # Merge with any additional headers
        if "headers" in kwargs:
            headers.update(kwargs["headers"])
            del kwargs["headers"]
        
        try:
            async with httpx.AsyncClient() as client:
                if method.upper() == "POST":
                    response = await client.post(url, headers=headers, **kwargs)
                elif method.upper() == "PUT":
                    response = await client.put(url, headers=headers, **kwargs)
                elif method.upper() == "DELETE":
                    response = await client.delete(url, headers=headers, **kwargs)
                else:
                    response = await client.get(url, headers=headers, **kwargs)
                
                if not response.is_success:
                    error_text = response.text
                    logger.error(f"[GMB API Error] {response.status_code} at {url}: {error_text}")
                    
                    error_message = f"GMB API Error: {response.status_code}"
                    try:
                        error_json = response.json()
                        error_message = error_json.get("error", {}).get("message", error_message)
                    except:
                        pass
                    
                    raise Exception(error_message)
                
                return response.json()
        
        except httpx.RequestError as err:
            logger.error(f"[GMB Service] Fetch failed for {url}: {err}")
            raise Exception("Connectivity Blocked: The request failed to reach Google. Check your internet or try again in a moment.")
    
    async def get_accounts(self) -> List[Dict[str, Any]]:
        """
        Get GMB accounts
        Matches TypeScript getAccounts() method
        
        Returns list of GMBAccount:
            - name: str (accounts/{accountId})
            - accountName: str
            - type: str
        """
        data = await self._fetch_with_auth(ACCOUNT_BASE_URL)
        
        accounts = []
        for acc in data.get("accounts", []):
            accounts.append({
                "name": acc.get("name"),  # accounts/{accountId}
                "accountName": acc.get("accountName"),
                "type": acc.get("type")
            })
        
        return accounts
    
    async def get_locations(self, account_name: str) -> List[Dict[str, Any]]:
        """
        Get locations for a GMB account
        Matches TypeScript getLocations() method
        
        Args:
            account_name: Full account path (accounts/{accountId})
        
        Returns list of GMBLocation:
            - name: str (full path: accounts/{accountId}/locations/{locationId})
            - title: str
            - locationName: str (just locations/{locationId})
        """
        # accountName is in form "accounts/{accountId}"
        url = f"{BUSINESS_BASE_URL}/{account_name}/locations?readMask=name,title"
        data = await self._fetch_with_auth(url)
        
        locations = []
        for loc in data.get("locations", []):
            # The Reviews API (v4) expects the full path: accounts/{accountId}/locations/{locationId}
            # But the Business Information API (v1) returns name as just "locations/{locationId}"
            locations.append({
                "name": f"{account_name}/{loc.get('name')}",  # Full path
                "title": loc.get("title"),
                "locationName": loc.get("name")  # Just locations/{locationId}
            })
        
        return locations
    
    async def get_reviews(self, full_location_path: str) -> List[Dict[str, Any]]:
        """
        Get reviews for a GMB location
        Matches TypeScript getReviews() method
        
        Args:
            full_location_path: Full path (accounts/{accountId}/locations/{locationId})
        
        Returns list of Review:
            - id: str
            - author: str
            - rating: int (1-5)
            - text: str
            - date: str (ISO format)
            - source: str ('gmb')
            - url: str
        """
        # fullLocationPath should be "accounts/{accountId}/locations/{locationId}"
        url = f"{REVIEWS_BASE_URL}/{full_location_path}/reviews"
        logger.info(f"[GMB] Fetching reviews from: {url}")
        
        data = await self._fetch_with_auth(url)
        
        reviews = []
        for rev in data.get("reviews", []):
            # Parse GMB star rating (matches TypeScript parseRating() method)
            rating = self._parse_rating(rev.get("starRating", "FIVE"))
            
            # Extract place ID from path for review URL
            place_id = full_location_path.split('/')[-1]
            
            reviews.append({
                "id": rev.get("reviewId"),
                "author": rev.get("reviewer", {}).get("displayName") or "Google User",
                "rating": rating,
                "text": rev.get("comment", ""),
                "date": rev.get("createTime") or "",
                "source": "gmb",
                "url": f"https://search.google.com/local/reviews?placeid={place_id}"
            })
        
        return reviews
    
    def _parse_rating(self, rating: str) -> int:
        """
        Parse GMB star rating string to integer
        Matches TypeScript parseRating() private method
        """
        rating_map = {
            "FIVE": 5,
            "FOUR": 4,
            "THREE": 3,
            "TWO": 2,
            "ONE": 1
        }
        return rating_map.get(rating, 0)


# Create singleton instance (matching TypeScript export)
gmb_service = GMBService()