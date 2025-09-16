from langchain_ollama import OllamaLLM
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from pdfminer.high_level import extract_text
import io
import json
import torch
from faster_whisper import WhisperModel
import translators as ts
import logging

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
OLLAMA_MODEL = "llama3"
WHISPER_MODEL = "large-v3"

# --- Device Configuration for PyTorch ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if torch.cuda.is_available() else "int8"

# --- Initialize Models ---
embeddings_model = HuggingFaceEmbeddings(model_name=MODEL_NAME)
llm = OllamaLLM(model=OLLAMA_MODEL)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len
)
logger.info(f"Loading Whisper model '{WHISPER_MODEL}' on device '{DEVICE}' with compute type '{COMPUTE_TYPE}'")
whisper_model = WhisperModel(WHISPER_MODEL, device=DEVICE, compute_type=COMPUTE_TYPE)
logger.info("Whisper model loaded successfully.")


# --- Core RAG Functions ---

def get_text_from_pdf(pdf_bytes: bytes) -> str:
    return extract_text(io.BytesIO(pdf_bytes))

def get_text_chunks(text: str) -> list[str]:
    return text_splitter.split_text(text)

def get_embeddings(chunks: list[str]) -> list[list[float]]:
    return embeddings_model.embed_documents(chunks)

def create_vector_store_from_db_chunks(chunks_from_db):
    if not chunks_from_db:
        return None
    texts = [chunk.content for chunk in chunks_from_db]
    embeddings_list = [json.loads(chunk.embedding) for chunk in chunks_from_db]
    text_embedding_pairs = list(zip(texts, embeddings_list))
    vector_store = FAISS.from_embeddings(text_embeddings=text_embedding_pairs, embedding=embeddings_model)
    return vector_store

def get_qa_chain(vector_store):
    prompt_template = """
    You are an expert on the provided document. Your task is to answer the user's question using only the information from the context below.
    Be direct, concise, and helpful. Do not mention the words "context", "document", or "text" in your answer. Just provide the answer directly.
    If the information is not in the context, say "I don't have enough information from the documents to answer that."

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
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt}
    )
    return chain

# --- Audio and Translation Functions ---

def transcribe_audio(audio_bytes: bytes) -> tuple[str, str]:
    """
    Transcribes audio using Whisper and detects the language.
    """
    audio_file = io.BytesIO(audio_bytes)
    segments, info = whisper_model.transcribe(audio_file, beam_size=5)
    
    detected_language = info.language
    transcribed_text = "".join(segment.text for segment in segments)
    
    logger.info(f"Detected language: {detected_language}, Transcribed text: {transcribed_text}")
    
    return transcribed_text, detected_language

def translate_text(text: str, target_language: str, source_language: str = 'auto') -> str:
    """
    Translates text to the target language.
    """
    if source_language == target_language:
        return text
    try:
        translated_text = ts.translate_text(
            text, 
            from_language=source_language, 
            to_language=target_language
        )
        logger.info(f"Translating from '{source_language}' to '{target_language}': '{text}' -> '{translated_text}'")
        return translated_text
    except Exception as e:
        logger.error(f"Translation error from '{source_language}' to '{target_language}': {e}")
        return text # Fallback to original text if translation fails