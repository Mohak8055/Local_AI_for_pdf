from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import json
from sse_starlette.sse import EventSourceResponse
import asyncio

import database, schemas, auth, rag_core

database.create_db_and_tables()
app = FastAPI(title="Local AI PDF Agent API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])

# --- Helper for streaming authentication ---
async def get_user_from_token(token: str, db: Session = Depends(database.get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await auth.get_current_user(token=token, db=db)


# --- API Endpoints ---

@app.get("/api/pdfs", response_model=List[schemas.PDF])
def get_user_pdfs(current_user: schemas.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    try:
        return db.query(database.PDF).filter(database.PDF.userId == current_user.id).all()
    except Exception as e:
        print(f"Error fetching PDFs: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch PDFs.")

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    try:
        pdf_bytes = await file.read()
        new_pdf = database.PDF(
            fileName=file.filename,
            userId=current_user.id,
            fileContent=pdf_bytes
        )
        db.add(new_pdf)
        db.commit()
        db.refresh(new_pdf)
        
        raw_text = rag_core.get_text_from_pdf(pdf_bytes)
        chunks = rag_core.get_text_chunks(raw_text)
        embeddings = rag_core.get_embeddings(chunks)
        for i, chunk_text in enumerate(chunks):
            embedding_json = json.dumps(embeddings[i])
            new_chunk = database.Chunk(pdfId=new_pdf.id, content=chunk_text, embedding=embedding_json)
            db.add(new_chunk)
        db.commit()
        return {"message": f"PDF '{file.filename}' was successfully processed and stored."}
    except Exception as e:
        db.rollback()
        print(f"Error during upload: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during file processing: {e}")


@app.get("/api/ask")
async def ask_question(
    question: str = Query(...),
    token: str = Query(...),
    db: Session = Depends(database.get_db)
):
    current_user = await get_user_from_token(token, db)
    
    feature_phrases = [
        "can you", "are you able", "is it possible", "do you support",
        "what are your features", "what can you do"
    ]
    if any(phrase in question.lower() for phrase in feature_phrases):
        async def feature_stream():
            yield {"event": "answer_chunk", "data": json.dumps({"answer_chunk": "That's a great question! This feature is not yet implemented, but it is planned for a future update. Stay tuned!"})}
            yield {"event": "sources", "data": json.dumps({"sources": []})}
        return EventSourceResponse(feature_stream())

    user_pdfs = db.query(database.PDF).filter(database.PDF.userId == current_user.id).all()
    if not user_pdfs:
        raise HTTPException(status_code=404, detail="No documents uploaded. Please upload a PDF first.")
    pdf_ids = [pdf.id for pdf in user_pdfs]
    all_user_chunks = db.query(database.Chunk).filter(database.Chunk.pdfId.in_(pdf_ids)).all()
    if not all_user_chunks:
        raise HTTPException(status_code=404, detail="Could not find processed data for your documents.")

    vector_store = rag_core.create_vector_store_from_db_chunks(all_user_chunks)
    if not vector_store:
         raise HTTPException(status_code=500, detail="Failed to build knowledge base from your documents.")

    qa_chain = rag_core.get_qa_chain(vector_store)

    async def stream_answer():
        try:
            result = qa_chain.invoke({"query": question})
            answer = result["result"]
            
            source_documents_data = []
            if "source_documents" in result:
                for doc in result["source_documents"]:
                    chunk = db.query(database.Chunk).filter(database.Chunk.content == doc.page_content).first()
                    if chunk:
                         pdf = db.query(database.PDF).filter(database.PDF.id == chunk.pdfId).first()
                         if pdf:
                            source_documents_data.append({"file_name": pdf.fileName, "page_content": doc.page_content, "pdf_id": pdf.id})

            for chunk_text in answer:
                yield {"event": "answer_chunk", "data": json.dumps({"answer_chunk": chunk_text})}
                await asyncio.sleep(0.01)

            yield {"event": "sources", "data": json.dumps({"sources": source_documents_data})}
        except Exception as e:
            print(f"Error during query invocation: {e}")
            yield {"event": "error", "data": json.dumps({"error": "An error occurred while getting an answer."})}

    return EventSourceResponse(stream_answer())


@app.post("/api/feedback")
async def give_feedback(
    feedback: schemas.FeedbackCreate,
    current_user: schemas.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    new_feedback = database.Feedback(userId=current_user.id, question=feedback.question, answer=feedback.answer, is_helpful=feedback.is_helpful)
    db.add(new_feedback)
    db.commit()
    return {"message": "Feedback received. Thank you!"}