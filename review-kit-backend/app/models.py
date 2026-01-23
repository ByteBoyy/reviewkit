"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# Base model with camelCase serialization
class CamelCaseModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,  # Accept both snake_case and camelCase input
    )

    def model_dump(self, **kwargs):
        # Always serialize using aliases (camelCase)
        kwargs.setdefault('by_alias', True)
        return super().model_dump(**kwargs)


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

class User(UserBase, CamelCaseModel):
    id: str
    subscription: Optional[Subscription] = None
    usage: Optional[Usage] = None
    created_at: datetime = Field(alias="createdAt")

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

class Location(LocationBase, CamelCaseModel):
    id: str
    user_id: str = Field(alias="userId")
    linked_accounts: Dict[str, Any] = Field(default={}, alias="linkedAccounts")
    last_analysis: Optional[Dict[str, Any]] = Field(default=None, alias="lastAnalysis")
    is_syncing: bool = Field(default=False, alias="isSyncing")
    sync_stage: str = Field(default="idle", alias="syncStage")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

class LocationWithReviews(Location):
    reviews: List['Review'] = []

# Review Models
class ReviewBase(CamelCaseModel):
    author: str
    rating: int = Field(ge=1, le=5)
    text: Optional[str] = None
    review_date: datetime = Field(alias="date")
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
    location_id: str = Field(alias="locationId")
    external_id: Optional[str] = Field(default=None, alias="externalId")
    tags: List[str] = []
    assigned_to: Optional[str] = Field(default=None, alias="assignedTo")
    is_archived: bool = Field(default=False, alias="isArchived")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

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


# Rebuild models with forward references
LocationWithReviews.model_rebuild()
UserResponse.model_rebuild()