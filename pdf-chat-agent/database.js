import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let db;

async function initializeDatabase() {
    if (db) return db;

    db = await open({
        filename: './local-rag-db.sqlite', // The database will be a single file
        driver: sqlite3.Database
    });

    console.log('Connected to the SQLite database.');

    // --- Create Tables (SQLite Syntax) ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            fileName TEXT NOT NULL,
            uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pdfId INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding TEXT NOT NULL, -- Storing embedding as JSON string
            FOREIGN KEY (pdfId) REFERENCES pdfs(id) ON DELETE CASCADE
        );
    `);

    console.log('Database tables are ready.');
    return db;
}

export { initializeDatabase };