Local AI PDF Agent with AuthenticationA full-stack web application that allows users to upload PDF documents and have a conversational chat with them, powered by a local Large Language Model (LLM). The system is secure, multi-user, and all data processing happens on your machine, ensuring complete privacy.

# Key Features

Secure User Authentication: Full registration and login system using JWT (JSON Web Tokens) and hashed passwords (bcrypt).Multi-Document & User-Specific Storage: Each user has their own private library of documents. The AI will only answer questions based on the documents uploaded by the logged-in user.
Persistent Database: User data, PDF metadata, and processed text chunks are securely stored in a local SQLite database file (local-rag-db.sqlite).
100% Local AI Processing: All AI tasks, from text embedding to answer generation, are handled by a local LLM running via Ollama. Your data never leaves your computer.
Interactive API Documentation: A built-in Swagger UI page allows for easy API testing and user registration directly from the browser.
Modern, Responsive UI: A clean and intuitive chat interface built with React and styled with Tailwind CSS.

# Project Architecture

This project implements a Retrieval-Augmented Generation (RAG) architecture. This powerful approach ensures the AI's answers are grounded in the content of your documents, preventing it from making up information.
The workflow is as follows:

Upload & Process: When a user uploads a PDF, the backend extracts the text, splits it into smaller "chunks," and uses a local embedding model to convert each chunk into a numerical vector representing its meaning.
Store: These vectors, along with the text chunks, are saved to the SQLite database and linked to the user's account.
Ask (Retrieve): When a user asks a question, the question is also converted into a vector. The system performs a semantic search on the database to find the text chunks with the most similar vectors (i.e., the most relevant information).
Generate (Augment): The retrieved chunks (the "context") are combined with the user's original question into a detailed prompt. This full prompt is then sent to the local LLM (e.g., Llama 3).
Answer: The LLM generates an answer based only on the provided context and sends it back to the user.

# Prerequisites

Before you begin, ensure you have the following installed on your system:
Node.js (v18 or higher recommended)
Ollama

# Installation & Setup

You will need three separate terminal windows to run the full application.

# 1. Terminal 1: Run the AI ModelThis terminal will run the local LLM that powers the chat.

Download and run the Llama 3 model (or another model of your choice)
ollama run llama3

Keep this terminal running.

# 2. Terminal 2: Run the Backend ServerThis terminal will run the Node.js server, API, and database.

Navigate to the backend project folder
cd pdf-chat-agent

Install all necessary dependencies
npm install

Start the server. This will also create the 'local-rag-db.sqlite' file if it doesn't exist.
node server.js
You should see log messages confirming the database connection and that the server is running on http://localhost:3001.3. 

# 3. Terminal 3: Run the Frontend ApplicationThis terminal will run the React user interface.

Navigate to the frontend project folder
cd frontend

Install all necessary dependencies
npm install

Start the development server
npm run dev

Your frontend application will now be running, typically at http://localhost:5173.

# How to Use the Application

Create a User Account:

Open your browser and navigate to the Swagger API documentation at http://localhost:3001/api-docs.
Find the POST /auth/register endpoint, expand it, and click "Try it out".
Enter a username and password in the request body and click "Execute".

Log In:

Go to the frontend application in your browser (e.g., http://localhost:5173).
Use the credentials you just created to log in.

Upload Documents:

Once logged in, you will see the chat interface. Use the "+ Upload PDF" button in the sidebar to upload your documents.

Start Chatting:

After a document is successfully processed, you can start asking questions about it in the chat input at the bottom. The AI will answer based on the knowledge from all the documents you have uploaded.