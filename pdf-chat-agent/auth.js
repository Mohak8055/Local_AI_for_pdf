import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { initializeDatabase } from './database.js';

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = 'your-super-secret-key-change-me';

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const db = await initializeDatabase();
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: `User '${username}' registered successfully.` });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user.' });
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
        const db = await initializeDatabase();
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Login successful!', token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

export { router as authRouter, authenticateToken };