from langchain_community.llms import Ollama
# FIX: Import from the new, correct package
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from pdfminer.high_level import extract_text
import io

# --- Configuration ---
# FIX: Use the standard model name for Python's sentence-transformers
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
OLLAMA_MODEL = "llama3"

embeddings = HuggingFaceEmbeddings(model_name=MODEL_NAME)
llm = Ollama(model=OLLAMA_MODEL)

# This will store vector stores in memory, keyed by userId
user_vector_stores = {}

# --- RAG Functions ---
def process_pdf_to_chunks(pdf_bytes: bytes):
    text = extract_text(io.BytesIO(pdf_bytes))
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_text(text)
    return chunks

def get_vector_store(text_chunks: list):
    vector_store = FAISS.from_texts(texts=text_chunks, embedding=embeddings)
    return vector_store

def get_qa_chain(vector_store):
    prompt_template = """
    You are an intelligent assistant. Answer the user's question based ONLY on the following context.
    If the information is not in the context, say "I don't have enough information from the documents to answer that."
    Do not use any prior knowledge. Be concise and helpful.

    CONTEXT:
    {context}

    QUESTION:
    {question}

    ANSWER:
    """
    prompt = PromptTemplate(
        template=prompt_template, input_variables=["context", "question"]
    )
    
    chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vector_store.as_retriever(search_kwargs={'k': 3}),
        return_source_documents=False,
        chain_type_kwargs={"prompt": prompt}
    )
    return chain
