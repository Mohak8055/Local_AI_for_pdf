from pydantic import BaseModel, ConfigDict
from typing import List

# --- PDF Schemas ---
class PDFBase(BaseModel):
    fileName: str

class PDF(PDFBase):
    id: int
    userId: int

    model_config = ConfigDict(from_attributes=True)

# --- User Schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    pdfs: List[PDF] = []

    model_config = ConfigDict(from_attributes=True)

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

# --- Feedback Schema ---
class FeedbackCreate(BaseModel):
    question: str
    answer: str
    is_helpful: bool

# --- Source Document Schema ---
class SourceDocument(BaseModel):
    file_name: str
    page_content: str