"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Enums
class SubscriptionTier(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    NONE = "none"

class ReviewSource(str, Enum):
    GMB = "gmb"
    TRUSTPILOT = "trustpilot"
    TRIPADVISOR = "tripadvisor"
    GETYOURGUIDE = "getyourguide"
    MANUAL = "manual"

class SyncStage(str, Enum):
    IDLE = "idle"
    SCRAPING = "scraping"
    ANALYZING = "analyzing"

# Subscription Models
class Subscription(BaseModel):
    tier: SubscriptionTier = SubscriptionTier.FREE
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    currentPeriodEnd: Optional[str] = None

class Usage(BaseModel):
    chatsToday: int = 0
    importsToday: int = 0
    lastResetDate: Optional[str] = None

# User/Profile Models
class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str
    subscription: Optional[Subscription] = None
    usage: Optional[Usage] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserResponse(User):
    locations: List['Location'] = []

# Location Models
class LinkedAccounts(BaseModel):
    gmb: Optional[Dict[str, Any]] = None
    trustpilot: Optional[Dict[str, Any]] = None
    tripadvisor: Optional[Dict[str, Any]] = None
    getyourguide: Optional[Dict[str, Any]] = None

class LocationBase(BaseModel):
    name: str

class LocationCreate(LocationBase):
    pass

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    linked_accounts: Optional[Dict[str, Any]] = None
    last_analysis: Optional[Dict[str, Any]] = None
    is_syncing: Optional[bool] = None
    sync_stage: Optional[SyncStage] = None

class Location(LocationBase):
    id: str
    user_id: str
    linked_accounts: Dict[str, Any] = {}
    last_analysis: Optional[Dict[str, Any]] = None
    is_syncing: bool = False
    sync_stage: str = "idle"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LocationWithReviews(Location):
    reviews: List['Review'] = []

# Review Models
class ReviewBase(BaseModel):
    author: str
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = None
    review_date: datetime
    source: ReviewSource
    url: Optional[str] = None

class ReviewCreate(ReviewBase):
    external_id: Optional[str] = None

class ReviewUpdate(BaseModel):
    tags: Optional[List[str]] = None
    assigned_to: Optional[str] = None
    is_archived: Optional[bool] = None

class Review(ReviewBase):
    id: str
    location_id: str
    external_id: Optional[str] = None
    tags: List[str] = []
    assigned_to: Optional[str] = None
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Analysis Models
class Theme(BaseModel):
    name: str
    sentiment: str
    frequency: int
    description: str

class SentimentAnalysis(BaseModel):
    positive: int
    neutral: int
    negative: int
    score: int = Field(ge=0, le=100)

class SWOTAnalysis(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]

class AnalysisResult(BaseModel):
    overview: str
    sentiment: SentimentAnalysis
    themes: List[Theme]
    recommendations: List[str]
    swot: SWOTAnalysis

# Sync Request Models
class SyncRequest(BaseModel):
    location_id: str
    source: ReviewSource
    url: Optional[str] = None
    gmb_location: Optional[str] = None

# Portal Models
class PortalURLCreate(BaseModel):
    platform: str
    url: str

class PortalClickCreate(BaseModel):
    platform: str

# Token Models
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[str] = None