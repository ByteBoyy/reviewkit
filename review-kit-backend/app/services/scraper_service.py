"""
Scraper service using Apify for external review platforms
Python implementation matching TypeScript apifyService.ts
Includes URL cleaning, retry logic, normalization, and progress callbacks
"""
import os
import httpx
import asyncio
import re
import random
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime, timedelta
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

APIFY_API_KEY = os.getenv("APIFY_API_KEY")
APIFY_BASE_URL = "https://api.apify.com/v2"

# Note: Python doesn't need CORS proxy like browser-based TypeScript
# We make direct API calls from server


def clean_url(url: str) -> str:
    """
    Clean URL by removing search params and hash
    Matches TypeScript cleanUrl() function
    """
    try:
        parsed = urlparse(url)
        # Rebuild URL without query and fragment
        cleaned = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        # Remove trailing slash
        return cleaned.rstrip('/')
    except Exception as e:
        logger.warning(f"Failed to clean URL: {e}")
        return url


async def delay(ms: int):
    """Delay in milliseconds (matching TypeScript delay function)"""
    await asyncio.sleep(ms / 1000.0)


async def fetch_with_retry(
    client: httpx.AsyncClient,
    url: str,
    method: str = "GET",
    retries: int = 3,
    backoff: int = 2000,
    **kwargs
) -> httpx.Response:
    """
    Fetch with exponential backoff retry
    Matches TypeScript fetchWithRetry() function
    """
    for attempt in range(retries + 1):
        try:
            if method.upper() == "POST":
                response = await client.post(url, **kwargs)
            else:
                response = await client.get(url, **kwargs)
            
            # Retry on 502, 503, 504 errors
            if not response.is_success and response.status_code in [502, 503, 504] and attempt < retries:
                await delay(backoff)
                backoff *= 2
                continue
            
            return response
            
        except Exception as err:
            if attempt < retries:
                await delay(backoff)
                backoff *= 2
                continue
            raise err


def normalize_items(items: List[Dict[str, Any]], source: str, original_url: str) -> List[Dict[str, Any]]:
    """
    Normalize raw scraper items into Review objects
    Matches TypeScript normalizeItems() function
    """
    # Ensure items is a list
    normalized_items = items if isinstance(items, list) else []
    
    # Flatten nested review structures (matching TypeScript logic)
    if len(normalized_items) > 0:
        flattened_reviews = []
        for item in normalized_items:
            has_text = bool(
                item.get('text') or item.get('comment') or 
                item.get('reviewBody') or item.get('message')
            )
            has_rating = (
                item.get('rating') is not None or 
                item.get('stars') is not None or 
                item.get('score') is not None
            )
            
            if has_text or has_rating:
                flattened_reviews.append(item)
            elif item.get('reviews') and isinstance(item.get('reviews'), list):
                flattened_reviews.extend(item['reviews'])
            elif (item.get('data') and item['data'].get('reviews') and 
                  isinstance(item['data']['reviews'], list)):
                flattened_reviews.extend(item['data']['reviews'])
        
        if len(flattened_reviews) > 0:
            normalized_items = flattened_reviews
    
    # Normalize each review
    normalized = []
    for item in normalized_items:
        try:
            # Extract author (matching TypeScript logic with multiple fallbacks)
            author = (
                (item.get('author', {}).get('fullName') if isinstance(item.get('author'), dict) else None) or
                (item.get('author', {}).get('name') if isinstance(item.get('author'), dict) else None) or
                item.get('name') or
                (item.get('author') if isinstance(item.get('author'), str) else None) or
                (item.get('user', {}).get('username') if isinstance(item.get('user'), dict) else None) or
                item.get('authorName') or
                item.get('reviewerName') or
                item.get('author_name') or
                'Valued Customer'
            )
            
            # Extract and normalize rating (matching TypeScript logic)
            raw_rating = (
                item.get('rating') or item.get('stars') or item.get('score') or
                item.get('ratingValue') or item.get('starRating') or 5
            )
            
            # Convert string to float if needed
            if isinstance(raw_rating, str):
                try:
                    rating = float(raw_rating)
                except ValueError:
                    # Handle word ratings like 'FIVE', 'FOUR', etc
                    word_map = {
                        'FIVE': 5, 'FOUR': 4, 'THREE': 3, 'TWO': 2, 'ONE': 1
                    }
                    rating = word_map.get(raw_rating.upper(), 5)
            else:
                rating = float(raw_rating)
            
            # Normalize rating to 1-5 scale
            if rating > 10:
                rating = rating / 10
            elif rating > 5:
                rating = rating / 2
            
            # Round and clamp to 1-5
            rating = max(1, min(5, round(rating)))
            
            # Extract text (matching TypeScript logic with multiple fallbacks)
            raw_text = (
                item.get('text') or item.get('comment') or item.get('message') or
                item.get('reviewBody') or item.get('description') or
                item.get('reviewText') or item.get('content') or ""
            )
            text = raw_text.strip() if raw_text else "[Rating Only]"
            
            # Extract date (matching TypeScript logic with multiple fallbacks)
            date = (
                item.get('publishedDate') or item.get('created') or item.get('date') or
                item.get('publishedAt') or item.get('createdDate') or
                item.get('review_date') or datetime.now().isoformat()
            )
            
            # Extract URL
            review_url = item.get('url') or item.get('reviewUrl') or item.get('link') or original_url
            
            # Generate ID (matching TypeScript logic)
            review_id = (
                item.get('reviewId') or item.get('id') or
                f"{source}-{random.random()}"[2:11]  # Simulates Math.random().toString(36).substr(2, 9)
            )
            
            normalized.append({
                "id": review_id,
                "author": author,
                "rating": rating,
                "text": text,
                "date": date,
                "source": source,
                "url": review_url
            })
            
        except Exception as e:
            logger.warning(f"Failed to normalize review item: {e}")
            continue
    
    return normalized


async def fetch_real_external_reviews(
    url: str,
    source: str,
    on_progress: Optional[Callable[[List[Dict[str, Any]]], None]] = None
) -> List[Dict[str, Any]]:
    """
    Scrape reviews from external platforms using Apify actors
    Matches TypeScript fetchRealExternalReviews() function
    
    Args:
        url: Platform URL to scrape
        source: Platform identifier ('trustpilot', 'tripadvisor', 'gmb', 'getyourguide')
        on_progress: Optional callback for live progress updates
    
    Returns:
        List of normalized review dictionaries
    """
    
    if not APIFY_API_KEY:
        logger.warning("APIFY_API_KEY not set, returning mock data")
        return await generate_mock_reviews(url, source)
    
    cleaned_url = clean_url(url)
    
    # Actor configurations matching TypeScript
    actor_id = ''
    input_config: Dict[str, Any] = {}
    default_proxy = {"useApifyProxy": True}
    
    if source == 'trustpilot':
        actor_id = 'apify~trustpilot-scraper'
        input_config = {
            "startUrls": [{"url": cleaned_url}],
            "maxReviews": 40,
            "sortBy": "recent",
            "proxyConfiguration": default_proxy
        }
    elif source == 'tripadvisor':
        actor_id = 'maxcopell~tripadvisor-reviews'
        input_config = {
            "startUrls": [{"url": cleaned_url}],
            "maxItems": 40,
            "includeReviews": True,
            "proxyConfiguration": default_proxy
        }
    elif source == 'getyourguide':
        actor_id = 'jupri~get-your-guide-scraper'
        # Extract activity ID from URL (matching TypeScript regex logic)
        id_match = (
            re.search(r't(\d+)$', cleaned_url) or
            re.search(r't(\d+)/', cleaned_url) or
            re.search(r'-t(\d+)', cleaned_url)
        )
        activity_id = id_match.group(1) if id_match else cleaned_url
        query = activity_id if '/reviews' in activity_id else f"{activity_id}/reviews"
        input_config = {
            "query": query,
            "limit": 40
        }
    elif source == 'gmb':
        actor_id = 'apify~google-maps-scraper'
        input_config = {
            "startUrls": [{"url": cleaned_url}],
            "maxReviews": 40,
            "scrapeReviews": True,
            "proxyConfiguration": default_proxy
        }
    else:
        raise ValueError(f"Unsupported source: {source}")
    
    try:
        logger.info(f"Starting Apify scrape for {source} from {url}")
        
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            # Start the actor run
            start_url = f"{APIFY_BASE_URL}/acts/{actor_id}/runs"
            
            logger.info(f"Calling Apify actor: {actor_id}")
            
            run_response = await fetch_with_retry(
                client,
                start_url,
                method="POST",
                params={"token": APIFY_API_KEY},
                json=input_config
            )
            
            if not run_response.is_success:
                raise Exception("Sync Failed to Start")
            
            run_data = run_response.json()
            run_id = run_data["data"]["id"]
            dataset_id = run_data["data"]["defaultDatasetId"]
            
            logger.info(f"Actor started. Run ID: {run_id}, Dataset ID: {dataset_id}")
            
            # Poll for completion (matching TypeScript logic)
            is_finished = False
            attempts = 0
            has_sent_progress = False
            
            while not is_finished and attempts < 60:
                attempts += 1
                await delay(6000)  # 6 seconds (matching TypeScript)
                
                # Check run status
                status_url = f"{APIFY_BASE_URL}/actor-runs/{run_id}"
                check_response = await fetch_with_retry(
                    client,
                    status_url,
                    params={"token": APIFY_API_KEY}
                )
                check_data = check_response.json()
                status = check_data["data"]["status"]
                
                logger.info(f"Attempt {attempts}/60: Status = {status}")
                
                # Check dataset for live progress (matching TypeScript logic)
                if not has_sent_progress or attempts % 2 == 0:
                    dataset_url = f"{APIFY_BASE_URL}/datasets/{dataset_id}/items"
                    try:
                        partial_response = await fetch_with_retry(
                            client,
                            dataset_url,
                            params={"token": APIFY_API_KEY}
                        )
                        if partial_response.is_success:
                            items = partial_response.json()
                            reviews = normalize_items(items, source, url)
                            if len(reviews) > 0 and on_progress:
                                on_progress(reviews)
                                has_sent_progress = True
                    except Exception as e:
                        logger.warning(f"Failed to fetch partial results: {e}")
                
                # Check if finished
                if status == 'SUCCEEDED':
                    is_finished = True
                elif status in ['FAILED', 'ABORTED', 'TIMED-OUT']:
                    is_finished = True
            
            # Get final results
            final_url = f"{APIFY_BASE_URL}/datasets/{dataset_id}/items"
            final_response = await fetch_with_retry(
                client,
                final_url,
                params={"token": APIFY_API_KEY}
            )
            final_items = final_response.json()
            
            return normalize_items(final_items, source, url)
    
    except Exception as error:
        logger.error(f"Scraping error: {error}")
        raise Exception(str(error))


async def generate_mock_reviews(url: str, source: str) -> List[Dict[str, Any]]:
    """
    Generate mock reviews for testing or when API is unavailable
    Same as previous implementation
    """
    logger.info(f"Generating mock reviews for {source}")
    
    mock_reviews = []
    
    authors = [
        "John D.", "Sarah M.", "Mike R.", "Emily L.", "David K.", "Lisa P.",
        "Jennifer W.", "Robert T.", "Amanda B.", "Chris H.", "Nicole S.", "James F."
    ]
    
    positive_comments = [
        "Absolutely amazing experience! Would highly recommend to anyone.",
        "Very satisfied with the service. Everything exceeded expectations.",
        "Outstanding quality and great value for money.",
        "Professional, friendly staff made all the difference.",
        "Will definitely be coming back. Five stars!",
        "Exceeded all my expectations. Truly impressive.",
        "Best decision I made. Couldn't be happier.",
        "Exactly what I was looking for. Perfect!",
        "Incredible attention to detail. Worth every penny.",
        "Simply outstanding from start to finish."
    ]
    
    neutral_comments = [
        "Good overall experience with a few minor issues.",
        "Decent service, met basic expectations.",
        "Average experience, nothing special but acceptable.",
        "Okay for the price, but room for improvement.",
        "Met expectations but didn't wow me."
    ]
    
    negative_comments = [
        "Not what I expected. Quite disappointed.",
        "Several issues that need to be addressed.",
        "Could use significant improvement.",
        "Had problems that weren't resolved properly.",
        "Below average experience. Not recommended."
    ]
    
    # Generate 20 reviews with realistic distribution
    for i in range(20):
        review_date = datetime.now() - timedelta(days=random.randint(1, 365))
        
        # Rating distribution: 40% 5-star, 30% 4-star, 15% 3-star, 10% 2-star, 5% 1-star
        rating = random.choices(
            [5, 4, 3, 2, 1],
            weights=[40, 30, 15, 10, 5]
        )[0]
        
        # Pick comment based on rating
        if rating >= 4:
            comment = random.choice(positive_comments)
        elif rating == 3:
            comment = random.choice(neutral_comments)
        else:
            comment = random.choice(negative_comments)
        
        mock_reviews.append({
            "id": f"mock-{source}-{i}-{random.randint(10000, 99999)}",
            "author": random.choice(authors),
            "rating": rating,
            "text": comment,
            "date": review_date.isoformat(),
            "url": f"{url}#review-{i}",
            "source": source
        })
    
    logger.info(f"Generated {len(mock_reviews)} mock reviews")
    return mock_reviews


# Test function for development
async def test_scraper():
    """Test the scraper with sample URLs"""
    test_urls = {
        "trustpilot": "https://www.trustpilot.com/review/www.airbnb.com",
        "tripadvisor": "https://www.tripadvisor.com/Hotel_Review-g60763-d1762915-Reviews-citizenM_New_York_Times_Square-New_York_City_New_York.html",
    }
    
    for source, url in test_urls.items():
        print(f"\nTesting {source}...")
        reviews = await fetch_real_external_reviews(url, source)
        print(f"Got {len(reviews)} reviews")
        if reviews:
            print(f"Sample: {reviews[0]}")


if __name__ == "__main__":
    # For testing
    asyncio.run(test_scraper())