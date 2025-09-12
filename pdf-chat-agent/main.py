from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List

import database, schemas, auth, rag_core

# Create DB tables on startup
database.create_db_and_tables()

app = FastAPI(title="Local AI PDF Agent API")

# Mount the authentication router
app.include_router(auth.router, prefix="/auth", tags=["Auth"])


# --- API Endpoints ---

@app.get("/api/pdfs", response_model=List[schemas.PDF])
def get_user_pdfs(current_user: schemas.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    return db.query(database.PDF).filter(database.PDF.userId == current_user.id).all()

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...), 
    current_user: schemas.User = Depends(auth.get_current_user), 
    db: Session = Depends(database.get_db)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    pdf_bytes = await file.read()
    
    # Process the PDF
    chunks = rag_core.process_pdf_to_chunks(pdf_bytes)
    vector_store = rag_core.get_vector_store(chunks)
    
    # For simplicity, we store the vector store in-memory. 
    # A more robust solution would serialize and save it or rebuild from DB.
    rag_core.user_vector_stores[current_user.id] = vector_store

    # Save PDF metadata to the database
    new_pdf = database.PDF(fileName=file.filename, userId=current_user.id)
    db.add(new_pdf)
    db.commit()
    
    return {"message": f"PDF '{file.filename}' processed successfully."}

@app.post("/api/ask")
def ask_question(
    question: str,
    current_user: schemas.User = Depends(auth.get_current_user)
):
    user_id = current_user.id
    if user_id not in rag_core.user_vector_stores:
        raise HTTPException(status_code=404, detail="No documents uploaded. Please upload a PDF first.")
        
    vector_store = rag_core.user_vector_stores[user_id]
    qa_chain = rag_core.get_qa_chain(vector_store)
    
    result = qa_chain({"query": question})
    return {"answer": result["result"]}