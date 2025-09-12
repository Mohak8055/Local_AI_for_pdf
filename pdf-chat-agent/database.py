from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime

DATABASE_URL = "sqlite:///./local-rag-db.sqlite"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- SQLAlchemy Models ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    pdfs = relationship("PDF", back_populates="owner", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")

class PDF(Base):
    __tablename__ = "pdfs"
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False)
    fileName = Column(String, nullable=False)
    # --- ADD THIS LINE ---
    fileContent = Column(LargeBinary, nullable=False)
    uploadedAt = Column(DateTime, default=datetime.datetime.utcnow)
    owner = relationship("User", back_populates="pdfs")
    chunks = relationship("Chunk", back_populates="pdf", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True, index=True)
    pdfId = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Text, nullable=False) # Storing as JSON string
    pdf = relationship("PDF", back_populates="chunks")

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("users.id"), nullable=False)
    question = Column(String, nullable=False)
    answer = Column(String, nullable=False)
    is_helpful = Column(Boolean, nullable=False)
    user = relationship("User", back_populates="feedback")


# Function to create tables
def create_db_and_tables():
    Base.metadata.create_all(bind=engine)

# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()