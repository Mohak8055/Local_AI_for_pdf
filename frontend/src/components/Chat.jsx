import React, { useState, useEffect, useRef } from 'react';

// --- SVG Icon Components ---
const UserIcon = () => (
    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-700 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    </div>
);
const BotIcon = () => (
    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-cyan-800 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    </div>
);
const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);
const LogoutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);
const ThumbsUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.085a2 2 0 00-1.736.97l-2.714 4.887M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
);
const ThumbsDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.738 3h4.017c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.085a2 2 0 001.736-.97l2.714-4.887M17 4h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
    </svg>
);

// --- Main Chat Component ---
const Chat = ({ token, onLogout }) => {
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isBotTyping, setIsBotTyping] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [userPdfs, setUserPdfs] = useState([]);
    
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const eventSourceRef = useRef(null);

    const API_BASE_URL = 'http://localhost:8000/api';

    const fetchUserPdfs = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/pdfs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch your documents.');
            const data = await response.json();
            setUserPdfs(data);
            if (data.length > 0 && messages.length === 0) {
                 setMessages([{ id: Date.now(), sender: 'bot', text: "Your documents are loaded and ready. Ask me anything about them!", sources: [] }]);
            } else if (messages.length === 0) {
                 setMessages([{ id: Date.now(), sender: 'bot', text: "Hello! Upload a PDF from the sidebar to get started.", sources: [] }]);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchUserPdfs();
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [token]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isBotTyping]);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Failed to upload PDF.');
            }

            setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: `Successfully processed "${file.name}". Your knowledge base is updated.`, sources: [] }]);
            fetchUserPdfs();

        } catch (err) {
            setError(`Upload Error: ${err.message}`);
        } finally {
            setIsUploading(false);
            if(fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!userInput.trim() || isBotTyping || isUploading) return;
    
        const question = userInput;
        const userMessage = { id: Date.now(), sender: 'user', text: userInput };
        const botMessageId = Date.now() + 1;
    
        setMessages(prev => [...prev, userMessage, { id: botMessageId, sender: 'bot', text: '', sources: [] }]);
        setUserInput('');
        setIsBotTyping(true);
        setError('');
    
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
    
        const eventSource = new EventSource(`${API_BASE_URL}/ask?question=${encodeURIComponent(question)}&token=${encodeURIComponent(token)}`);
        eventSourceRef.current = eventSource;
    
        eventSource.addEventListener('answer_chunk', (e) => {
            const data = JSON.parse(e.data);
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === botMessageId
                        ? { ...msg, text: msg.text + data.answer_chunk }
                        : msg
                )
            );
        });

        eventSource.addEventListener('sources', (e) => {
            const data = JSON.parse(e.data);
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === botMessageId
                        ? { ...msg, sources: data.sources }
                        : msg
                )
            );
            setIsBotTyping(false);
            eventSource.close();
        });
    
        eventSource.onerror = (e) => {
            setError("An error occurred with the streaming connection.");
            setIsBotTyping(false);
            eventSource.close();
        };
    };
    

    const handleFeedback = async (messageId, isHelpful) => {
        const message = messages.find(msg => msg.id === messageId);
        const questionMessage = messages.slice().reverse().find(msg => msg.id < messageId && msg.sender === 'user');

        if (!message || !questionMessage || message.feedback !== undefined) return;

        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, feedback: isHelpful } : msg
        ));

        try {
            await fetch(`${API_BASE_URL}/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    question: questionMessage.text,
                    answer: message.text,
                    is_helpful: isHelpful
                })
            });
        } catch (err) {
            setError("Failed to send feedback.");
        }
    };
    
    return (
       <div className="flex h-screen bg-gray-900 text-white font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900/80 backdrop-blur-sm p-4 border-r border-cyan-500/20 flex flex-col">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">Your Documents</h2>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {userPdfs.map(pdf => (
                        <div key={pdf.id} className="p-2 bg-gray-800 rounded-md text-sm text-gray-300 truncate" title={pdf.fileName}>
                            📄 {pdf.fileName}
                        </div>
                    ))}
                    {userPdfs.length === 0 && !isUploading && (
                         <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                    )}
                </div>
                <div className="mt-auto">
                     <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileChange} ref={fileInputRef} className="hidden" disabled={isUploading} />
                     <label htmlFor="pdf-upload" className={`w-full text-center cursor-pointer block bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all shadow-md hover:shadow-lg ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {isUploading ? 'Uploading...' : '+ Upload PDF'}
                     </label>
                </div>
            </aside>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                 <header className="bg-gray-900/80 backdrop-blur-sm p-4 border-b border-cyan-500/20 shadow-lg flex justify-between items-center">
                    <h1 className="text-xl md:text-2xl font-bold">Chat Interface</h1>
                     <button onClick={onLogout} className="p-2 rounded-md hover:bg-gray-700 transition-colors" title="Logout" aria-label="Logout">
                         <LogoutIcon />
                     </button>
                 </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'bot' && <BotIcon />}
                            <div className={`max-w-xl p-4 rounded-xl shadow-md break-words ${msg.sender === 'user' ? 'bg-blue-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
                               {msg.sender === 'bot' && !msg.text && isBotTyping ? (
                                    <div className="flex items-center space-x-1">
                                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-75"></span>
                                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-150"></span>
                                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-300"></span>
                                    </div>
                               ) : (
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                               )}

                               {msg.sources && msg.sources.length > 0 && (
                                   <div className="mt-4 border-t border-gray-600 pt-2">
                                       <h4 className="text-xs font-bold text-gray-400 mb-2">Sources:</h4>
                                       {msg.sources.map((source, index) => (
                                           <div key={index} className="mb-2 p-2 bg-gray-800 rounded-md text-xs text-gray-300">
                                               <p className="font-bold">{source.file_name}</p>
                                               <p className="italic mt-1">"{source.page_content}"</p>
                                           </div>
                                       ))}
                                   </div>
                               )}
                               {msg.sender === 'bot' && msg.text && !isBotTyping && (
                                   <div className="flex gap-2 mt-2">
                                       <button onClick={() => handleFeedback(msg.id, true)} className={`p-1 rounded-full ${msg.feedback === true ? 'bg-green-500 text-white' : 'hover:bg-gray-600'}`} title="Helpful" aria-label="Helpful" disabled={msg.feedback !== undefined}><ThumbsUpIcon /></button>
                                       <button onClick={() => handleFeedback(msg.id, false)} className={`p-1 rounded-full ${msg.feedback === false ? 'bg-red-500 text-white' : 'hover:bg-gray-600'}`} title="Not Helpful" aria-label="Not Helpful" disabled={msg.feedback !== undefined}><ThumbsDownIcon /></button>
                                   </div>
                               )}
                            </div>
                            {msg.sender === 'user' && <UserIcon />}
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </main>
                <footer className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-cyan-500/20">
                     <div className="max-w-3xl mx-auto">
                        {error && <p className="text-red-400 text-center text-sm mb-2">{error}</p>}
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                             <input
                                id="question-input"
                                name="question"
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Ask a question about your documents..."
                                className="flex-1 p-3 bg-gray-700 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-800 disabled:cursor-not-allowed"
                                disabled={isBotTyping || isUploading || userPdfs.length === 0}
                            />
                             <button
                                type="submit"
                                className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-600 hover:to-blue-700"
                                disabled={isBotTyping || isUploading || !userInput.trim()}
                                title="Send Message"
                                aria-label="Send Message"
                            >
                                <SendIcon />
                            </button>
                        </form>
                    </div>
                </footer>
            </div>
       </div>
    );
};

export default Chat;