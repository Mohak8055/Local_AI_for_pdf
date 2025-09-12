import express from 'express';
import multer from 'multer';
import pdf from '@cyber2024/pdf-parse-fixed';
import { initializeDatabase } from './database.js';
import { createVectorStoreForUser, queryUserVectorStore } from './server.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/pdfs', async (req, res) => {
    try {
        const db = await initializeDatabase();
        const pdfs = await db.all('SELECT id, fileName FROM pdfs WHERE userId = ?', [req.user.userId]);
        res.json(pdfs);
    } catch (error) {
        console.error("Error fetching user's PDFs:", error);
        res.status(500).json({ error: "Failed to fetch user's PDFs." });
    }
});

router.post('/upload', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    try {
        const db = await initializeDatabase();
        const pdfData = await pdf(req.file.buffer);
        const result = await db.run('INSERT INTO pdfs (userId, fileName) VALUES (?, ?)',[req.user.userId, req.file.originalname]);
        const pdfId = result.lastID;
        await createVectorStoreForUser(req.user.userId, pdfId, pdfData.text);
        res.status(200).json({ message: 'PDF processed and stored successfully.' });
    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ error: 'Failed to process PDF.' });
    }
});

router.post('/ask', async (req, res) => {
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'No question provided.' });
    }
    try {
        const answer = await queryUserVectorStore(req.user.userId, question);
        res.json({ answer });
    } catch (error) {
        console.error('Error during question answering:', error);
        res.status(500).json({ error: 'Failed to get an answer.' });
    }
});

export { router as apiRouter };