from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from passlib.context import CryptContext

DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    pdfs = relationship("PDF", back_populates="owner")

class PDF(Base):
    __tablename__ = "pdfs"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="pdfs")
    chunks = relationship("Chunk", back_populates="pdf")

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"))
    chunk_index = Column(Integer)
    content = Column(String)
    embedding = Column(JSON)
    pdf = relationship("PDF", back_populates="chunks")

Base.metadata.create_all(bind=engine)

def get_user_by_email(db, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db, user):
    hashed_password = pwd_context.hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_pdf(db, user_id, filename):
    db_pdf = PDF(owner_id=user_id, filename=filename)
    db.add(db_pdf)
    db.commit()
    db.refresh(db_pdf)
    return db_pdf

def get_pdfs_by_user(db, user_id):
    return db.query(PDF).filter(PDF.owner_id == user_id).all()

def create_chunk(db, pdf_id, chunk_index, content, embedding):
    db_chunk = Chunk(pdf_id=pdf_id, chunk_index=chunk_index, content=content, embedding=embedding)
    db.add(db_chunk)
    db.commit()
    db.refresh(db_chunk)
    return db_chunk

def get_chunks_by_pdf(db, pdf_id):
    return db.query(Chunk).filter(Chunk.pdf_id == pdf_id).all()

