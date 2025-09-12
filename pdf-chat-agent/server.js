import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database.js';
import { authRouter, authenticateToken } from './auth.js';
import { apiRouter } from './api.js';
import setupSwagger from './swagger.js';

// LangChain Imports
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";

// --- CONFIGURATION ---
const PORT = 3001;
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const OLLAMA_MODEL = "llama3";
const OLLAMA_BASE_URL = "http://localhost:11434";

// --- GLOBAL STATE ---
const userVectorStores = new Map();
const embeddings = new HuggingFaceTransformersEmbeddings({ modelName: MODEL_NAME });

// --- RAG CORE LOGIC ---
export async function createVectorStoreForUser(userId, pdfId, rawText) {
    const db = await initializeDatabase();
    
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });
    const docs = await textSplitter.createDocuments([rawText]);

    console.log(`Splitting text for pdfId ${pdfId} into ${docs.length} chunks.`);

    for (const doc of docs) {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        await db.run(
            'INSERT INTO chunks (pdfId, content, embedding) VALUES (?, ?, ?)',
            [pdfId, doc.pageContent, JSON.stringify(embedding)]
        );
    }
    
    // Clear any cached vector store for this user so it gets rebuilt with new data
    if (userVectorStores.has(userId)) {
        userVectorStores.delete(userId);
    }
}

async function loadVectorStoreForUser(userId) {
    if (userVectorStores.has(userId)) {
        return userVectorStores.get(userId);
    }

    console.log(`No vector store in memory for user ${userId}. Loading from DB...`);
    const db = await initializeDatabase();
    
    const userChunks = await db.all(`
        SELECT c.content, c.embedding FROM chunks c
        JOIN pdfs p ON c.pdfId = p.id
        WHERE p.userId = ?
    `, [userId]);

    if (userChunks.length === 0) {
        console.log(`No documents found for user ${userId}.`);
        return null;
    }

    const documents = userChunks.map(chunk => chunk.content);
    const embeddingsArray = userChunks.map(chunk => JSON.parse(chunk.embedding));

    const vectorStore = new MemoryVectorStore(embeddings);
    // Manually add vectors and documents
    await vectorStore.addVectors(embeddingsArray, documents.map(pageContent => ({ pageContent, metadata: {} })));
    
    userVectorStores.set(userId, vectorStore);
    console.log(`Vector store for user ${userId} loaded with ${userChunks.length} documents.`);
    return vectorStore;
}

export async function queryUserVectorStore(userId, question) {
    const vectorStore = await loadVectorStoreForUser(userId);

    if (!vectorStore) {
        return "I have no documents to search. Please upload a PDF file first.";
    }

    const model = new ChatOllama({ baseUrl: OLLAMA_BASE_URL, model: OLLAMA_MODEL });
    const retriever = vectorStore.asRetriever();
    
    const promptTemplate = `
        You are an intelligent assistant. Answer the user's question based ONLY on the following context.
        If the information is not in the context, say "I don't have enough information from the documents to answer that."
        Do not use any prior knowledge. Be concise and helpful.

        CONTEXT:
        {context}

        QUESTION:
        {question}

        ANSWER:
    `;
    const prompt = PromptTemplate.fromTemplate(promptTemplate);
    
    const ragChain = RunnableSequence.from([
        {
            context: retriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough(),
        },
        prompt,
        model,
        new StringOutputParser(),
    ]);

    console.log(`Invoking RAG chain for user ${userId}...`);
    const answer = await ragChain.invoke(question);
    console.log('Answer received from LLM.');
    return answer;
}

// --- SERVER INITIALIZATION ---
async function startServer() {
    // This function initializes the database and creates tables if they don't exist
    await initializeDatabase();
    const app = express();

    app.use(cors());
    app.use(express.json());

    // This function sets up the /api-docs route
    setupSwagger(app);

    // Public routes for login/register
    app.use('/auth', authRouter);

    // Protected API routes that require a token
    app.use('/api', authenticateToken, apiRouter);

    app.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
}

// Start the server
startServer();

