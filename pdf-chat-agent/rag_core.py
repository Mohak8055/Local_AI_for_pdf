# pdf-chat-agent/rag_core.py

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
import translators as ts
import logging
from faster_whisper import WhisperModel
import os
from sarvamai import SarvamAI

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
OLLAMA_MODEL = "tinyllama"
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

# --- Core RAG Functions (Unchanged) ---

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
    embeddings_list = [chunk.embedding for chunk in chunks_from_db]
    text_embedding_pairs = list(zip(texts, embeddings_list))
    vector_store = FAISS.from_embeddings(text_embeddings=text_embedding_pairs, embedding=embeddings_model)
    return vector_store

def get_qa_chain(vector_store):
    prompt_template = """
    You are an expert Q&A system. Your task is to answer the user's question with a brief and precise answer, using only the information from the context below.
    Provide a direct answer. Do not repeat the question or use unnecessary filler words.
    If the information is not in the context, say "The answer is not available in the document."

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

def translate_text(text: str, target_language: str, source_language: str = 'auto') -> str:
    if target_language == 'en-IN':
        target_language = 'en'
    
    if not text or source_language == target_language:
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
        return text

# --- NEW: Dedicated Whisper Transcription Function ---
def transcribe_with_whisper(audio_path: str) -> tuple[str, str]:
    """Transcribes audio using the local faster-whisper model and detects the language."""
    try:
        logger.info("Transcribing with local Whisper model...")
        segments, info = whisper_model.transcribe(audio_path, beam_size=5)
        
        transcribed_text = "".join(segment.text for segment in segments)
        detected_language = info.language
        
        logger.info(f"Whisper ASR result: Detected language: {detected_language}, Transcribed text: {transcribed_text}")
        
        # Whisper may not always translate, so we ensure the output is English
        if detected_language != "en":
            translated_text = translate_text(transcribed_text, 'en', detected_language)
            return translated_text, detected_language
        
        return transcribed_text, detected_language
    except Exception as e:
        logger.error(f"Local Whisper transcription error: {e}")
        return "", ""

def transcribe_and_translate_with_sarvam_ai(audio_path: str) -> tuple[str, str]:
    """Transcribes and translates audio to English using Sarvam AI's Saaras model."""
    try:
        logger.info("Transcribing with Sarvam AI model...")
        api_key = os.getenv("SARVAM_API_KEY")
        if not api_key:
            raise ValueError("SARVAM_API_KEY not set in environment variables")
        
        client = SarvamAI(api_subscription_key=api_key)
        
        with open(audio_path, "rb") as audio_file:
            response = client.speech_to_text.translate(
                file=audio_file,
                model="saaras:v2.5" 
            )
        
        transcribed_text = response.transcript
        detected_language = response.language_code
        
        logger.info(f"Sarvam AI ASR result: Transcribed text: {transcribed_text}")
        return transcribed_text, detected_language
        
    except Exception as e:
        logger.error(f"Sarvam AI transcription error: {e}")
        return "", ""

# --- NEW: Main Transcription Router Function ---
def transcribe_audio(audio_path: str, language_model: str) -> tuple[str, str]:
    """
    Routes the audio transcription to the appropriate service based on user selection.
    """
    if language_model == "indian":
        return transcribe_and_translate_with_sarvam_ai(audio_path)
    elif language_model == "foreign":
        return transcribe_with_whisper(audio_path)
    else:
        logger.warning(f"Invalid language model '{language_model}'. Defaulting to Whisper.")
        return transcribe_with_whisper(audio_path)