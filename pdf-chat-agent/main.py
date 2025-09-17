# pdf-chat-agent/main.py

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import database, schemas, auth, rag_core
import logging
import tempfile
from auth import oauth2_scheme
import os
import io
from pydub import AudioSegment

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- CORS Middleware ---
origins = [
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dependency ---
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Authentication & PDF Routes (Unchanged) ---
app.include_router(auth.router, prefix="/auth", tags=["auth"])

@app.post("/auth/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = database.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return database.create_user(db=db, user=user)

@app.post("/api/pdfs", response_model=schemas.PDF)
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = await auth.get_current_user(token=token, db=db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    pdf_bytes = await file.read()
    pdf_text = rag_core.get_text_from_pdf(pdf_bytes)
    text_chunks = rag_core.get_text_chunks(pdf_text)

    db_pdf = database.create_pdf(db, user.id, file.filename)

    for i, chunk in enumerate(text_chunks):
        embedding = rag_core.get_embeddings([chunk])[0]
        database.create_chunk(db, db_pdf.id, i, chunk, embedding)

    return db_pdf

@app.get("/api/pdfs", response_model=list[schemas.PDF])
async def get_pdfs(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    user = await auth.get_current_user(token=token, db=db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return database.get_pdfs_by_user(db, user.id)

@app.post("/api/ask")
async def ask_question(
    request: schemas.QuestionRequest,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    user = await auth.get_current_user(token=token, db=db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    chunks_from_db = database.get_chunks_by_pdf(db, request.pdf_id)
    vector_store = rag_core.create_vector_store_from_db_chunks(chunks_from_db)

    if not vector_store:
        raise HTTPException(status_code=404, detail="PDF not found or has no content.")

    qa_chain = rag_core.get_qa_chain(vector_store)
    result = qa_chain.invoke({"query": request.question})

    return {"answer": result["result"]}


# --- MODIFIED RAG Voice Route ---
@app.post("/api/ask_voice")
async def ask_voice(
    token: str = Depends(oauth2_scheme),
    audio: UploadFile = File(...),
    pdf_id: int = Form(...),
    user_lang: str = Form("en-IN"),
    language_model: str = Form(...), # <-- Accept the language model choice from frontend
    db: Session = Depends(get_db)
):
    user = await auth.get_current_user(token=token, db=db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    temp_audio_path = ""
    try:
        audio_bytes = await audio.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio_file:
            audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
            audio_segment.export(temp_audio_file.name, format="wav")
            temp_audio_path = temp_audio_file.name

        # --- Use the new router function ---
        translated_question, detected_lang = rag_core.transcribe_audio(temp_audio_path, language_model)

        if not translated_question:
            raise HTTPException(status_code=500, detail="Transcription failed for the selected model.")
        
        # Now, proceed with the RAG chain
        chunks_from_db = database.get_chunks_by_pdf(db, pdf_id)
        vector_store = rag_core.create_vector_store_from_db_chunks(chunks_from_db)

        if not vector_store:
            raise HTTPException(status_code=404, detail="PDF not found or has no content.")

        qa_chain = rag_core.get_qa_chain(vector_store)
        result = qa_chain.invoke({"query": translated_question})

        # Translate the final answer back to the user's language
        final_answer = rag_core.translate_text(result["result"], user_lang, "en")

        return {"answer": final_answer, "question": translated_question}

    except Exception as e:
        logger.error(f"Error during voice processing: {e}")
        raise HTTPException(status_code=500, detail="Error processing voice query.")
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)