from pydantic import BaseModel
from typing import List, Optional

class QuestionRequest(BaseModel):
    pdf_id: int
    question: str

class ChunkBase(BaseModel):
    chunk_index: int
    content: str

class ChunkCreate(ChunkBase):
    pass

class Chunk(ChunkBase):
    id: int
    pdf_id: int

    class Config:
        from_attributes = True

class PDFBase(BaseModel):
    filename: str

class PDFCreate(PDFBase):
    pass

class PDF(PDFBase):
    id: int
    owner_id: int
    chunks: List[Chunk] = []

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    pdfs: List[PDF] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None