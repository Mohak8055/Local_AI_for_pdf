Local AI PDF Agent with Python Backend
A full-stack web application that allows users to upload PDF documents and have a conversational chat with them, powered by a local Large Language Model (LLM). This version features a high-performance Python backend.

The system is secure, multi-user, and all data processing happens on your machine, ensuring complete privacy.

# Key Features
Secure User Authentication: Full registration and login system using JWT (JSON Web Tokens) and hashed passwords (bcrypt).

Multi-Document & User-Specific Storage: Each user has their own private library of documents. The AI will only answer questions based on the documents uploaded by the logged-in user.

Persistent Database: User data and PDF metadata are securely stored in a local SQLite database file.

100% Local AI Processing: All AI tasks, from text embedding to answer generation, are handled by a local LLM running via Ollama. Your data never leaves your computer.

Automatic Interactive API Docs: The FastAPI backend automatically generates an interactive API documentation page (at /docs) for easy testing and user registration.

Modern, Responsive UI: A clean and intuitive chat interface built with React and styled with Tailwind CSS.

# Project Architecture
This project implements a Retrieval-Augmented Generation (RAG) architecture. This powerful approach ensures the AI's answers are grounded in the content of your documents, preventing it from making up information.

The workflow remains the same, but the backend is now powered by Python for a more seamless integration with the AI ecosystem.

# Technology Stack

Backend

Python, FastAPI, SQLAlchemy, LangChain, SQLite, JWT, bcrypt

Frontend

React, Vite, Tailwind CSS

AI Model

Ollama running a local LLM (e.g., Llama 3)

Prerequisites
Before you begin, ensure you have the following installed on your system:

Python (v3.9 or higher recommended)

Ollama

Installation & Setup
You will need three separate terminal windows to run the full application.

# 1. Terminal 1: Run the AI Model
This terminal will run the local LLM that powers the chat.

Download and run the Llama 3 model (or another model of your choice)
ollama run llama3

Keep this terminal running.

# 2. Terminal 2: Run the Backend Server (Python)
This terminal will run the FastAPI server, API, and database.

Navigate to the backend project folder
cd pdf-chat-agent

It is highly recommended to use a Python virtual environment
Create the virtual environment
python -m venv venv

Activate it (on Windows)
venv\Scripts\activate
On macOS/Linux: source venv/bin/activate

Install all necessary dependencies from the requirements file
pip install -r requirements.txt

Start the server. This will also create the 'local-rag-db.sqlite' file.
uvicorn main:app --reload

You should see log messages confirming the server is running on http://127.0.0.1:8000.

# 3. Terminal 3: Run the Frontend Application
This terminal will run the React user interface.

Navigate to the frontend project folder
cd frontend

Install all necessary dependencies
npm install

Start the development server
npm run dev

Your frontend application will now be running, typically at http://localhost:5173.

How to Use the Application
Create a User Account:

Open your browser and navigate to the automatically generated API documentation at http://localhost:8000/docs.

Find the POST /auth/register endpoint, expand it, and click "Try it out".

Enter a username and password in the request body and click "Execute".

Log In:

Go to the frontend application in your browser (e.g., http://localhost:5173).

Use the credentials you just created to log in.

Upload Documents:

Once logged in, you will see the chat interface. Use the "+ Upload PDF" button in the sidebar to upload your documents.

Start Chatting:

After a document is successfully processed, you can start asking questions about it. The AI will answer based on the knowledge from all the documents you have uploaded.