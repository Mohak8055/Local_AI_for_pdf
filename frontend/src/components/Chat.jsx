import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import LanguagePopover from './LanguagePopover';

const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const MicIcon = ({ isRecording }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`w-6 h-6 ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}
    >
        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
        <path d="M6 15a1.5 1.5 0 0 0-1.5 1.5v.092a4.502 4.502 0 0 0 4.125 4.406 4.48 4.48 0 0 0 4.758 0A4.502 4.502 0 0 0 19.5 16.592V16.5A1.5 1.5 0 0 0 18 15h-.092a4.502 4.502 0 0 0-4.406 4.125 4.48 4.48 0 0 0 0 4.758A4.502 4.502 0 0 0 15.092 18H15a1.5 1.5 0 0 0-1.5-1.5H9a1.5 1.5 0 0 0-1.5 1.5h-.092a4.502 4.502 0 0 0-4.406-4.125 4.48 4.48 0 0 0-4.758 0A4.502 4.502 0 0 0 1.5 15.092V15A1.5 1.5 0 0 0 3 13.5h.092a4.502 4.502 0 0 0 4.125 4.406 4.48 4.48 0 0 0 4.758 0A4.502 4.502 0 0 0 16.592 12H16.5a1.5 1.5 0 0 0-1.5-1.5H12a1.5 1.5 0 0 0-1.5 1.5H9.092a4.502 4.502 0 0 0-4.125-4.406 4.48 4.48 0 0 0-4.758 0A4.502 4.502 0 0 0 .092 12H0a1.5 1.5 0 0 0-1.5 1.5v.092a4.502 4.502 0 0 0 4.125 4.406 4.48 4.48 0 0 0 4.758 0A4.502 4.502 0 0 0 12 19.592V19.5a1.5 1.5 0 0 0 1.5-1.5h.092a4.502 4.502 0 0 0 4.406-4.125 4.48 4.48 0 0 0 0-4.758A4.502 4.502 0 0 0 13.592 9H13.5a1.5 1.5 0 0 0-1.5 1.5H7.5a1.5 1.5 0 0 0-1.5-1.5H6Z" />
    </svg>
);


const Chat = ({ token }) => {
    const [pdfs, setPdfs] = useState([]);
    const [selectedPdf, setSelectedPdf] = useState(null);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('indian');

    const [shouldStartRecording, setShouldStartRecording] = useState(false);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        const fetchPdfs = async () => {
            if (!token) return;
            try {
                const response = await axios.get('http://localhost:8000/api/pdfs', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPdfs(response.data);
                if (response.data.length > 0) {
                    setSelectedPdf(response.data[0].id);
                }
            } catch (error) { // --- THIS IS THE FIX ---
                console.error('Failed to fetch PDFs', error);
            }
        };
        fetchPdfs();
    }, [token]);


    useEffect(() => {
    // This effect runs only when shouldStartRecording becomes true
    if (shouldStartRecording) {
      startRecording();
      // Reset the trigger so it can be used again
      setShouldStartRecording(false);
    }
  }, [shouldStartRecording]);


    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleFileUpload = async () => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await axios.post('http://localhost:8000/api/pdfs', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            const response = await axios.get('http://localhost:8000/api/pdfs', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPdfs(response.data);
            setFile(null);
        } catch (error) {
            console.error('File upload failed', error);
        }
    };

    const addMessage = (text, sender) => {
        setMessages(prev => [...prev, { text, sender }]);
    };

    const handleAskQuestion = async () => {
        if (!question.trim() || !selectedPdf) return;
        addMessage(question, 'user');
        setIsLoading(true);
        setQuestion('');
        try {
            const response = await axios.post('http://localhost:8000/api/ask', {
                pdf_id: selectedPdf,
                question: question
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            addMessage(response.data.answer, 'ai');
        } catch (error) {
            console.error('Failed to ask question', error);
            addMessage('Sorry, something went wrong.', 'ai');
        } finally {
            setIsLoading(false);
        }
    };
    
    const sendAudioData = async (audioBlob) => {
        if (!selectedPdf) {
            addMessage('Please select a PDF before asking a question.', 'ai');
            return;
        }
        setIsProcessing(true);
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        formData.append('pdf_id', selectedPdf);
        formData.append('language_model', selectedLanguage);
        
        try {
            const response = await axios.post('http://localhost:8000/api/ask_voice', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}` 
                }
            });
            addMessage(response.data.question, 'user');
            addMessage(response.data.answer, 'ai');
        } catch (error) {
            console.error('Failed to process voice question', error);
            addMessage('Sorry, I couldn\'t process the audio.', 'ai');
        } finally {
            setIsProcessing(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                sendAudioData(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (error) {
            console.error('Error accessing microphone', error);
            addMessage('Microphone access denied.', 'ai');
        }
    };
    
    const handleVoiceClick = async () => {
        if (isListening) {
            mediaRecorderRef.current.stop();
            setIsListening(false);
        } else {
            setIsPopoverOpen(!isPopoverOpen);
        }
    };


    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <div className="w-1/4 flex-shrink-0 p-4 bg-white border-r">
                <h2 className="mb-4 text-xl font-bold text-gray-800">Your Documents</h2>
                <div className="mb-4">
                    <input type="file" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    <button onClick={handleFileUpload} disabled={!file} className="w-full px-4 py-2 mt-2 text-white bg-blue-500 rounded hover:bg-blue-600 disabled:bg-blue-300">Upload PDF</button>
                </div>
                <div className="space-y-2">
                    {pdfs.map(pdf => (
                        <div key={pdf.id} onClick={() => setSelectedPdf(pdf.id)} className={`p-2 rounded cursor-pointer transition-colors ${selectedPdf === pdf.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50'}`}>
                            {pdf.filename}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col flex-1">
                <header className="p-4 font-bold text-center text-gray-700 bg-white border-b">
                    {selectedPdf ? `Chatting with ${pdfs.find(p => p.id === selectedPdf)?.filename}` : 'Select a document to start'}
                </header>
                <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <div className="space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-lg px-4 py-2 rounded-lg shadow-md ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isListening && <div className="text-center text-gray-500 animate-pulse">Listening...</div>}
                        {isProcessing && <div className="text-center text-gray-500">Processing...</div>}
                    </div>
                </div>
                <div className="p-4 bg-white border-t">
                    <div className="flex items-center">
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleAskQuestion()}
                            className="flex-1 p-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={!selectedPdf ? "Please select a document first" : "Ask a question..."}
                            disabled={!selectedPdf || isLoading}
                        />
                         <div className="relative">
                            <button onClick={handleVoiceClick} disabled={!selectedPdf || isLoading || isProcessing} className="p-2 border-t border-b bg-gray-50 hover:bg-gray-100 disabled:bg-gray-200">
                                <MicIcon isRecording={isListening} />
                            </button>
                            <LanguagePopover
    isOpen={isPopoverOpen}
    onSelectLanguage={(lang) => {
        setSelectedLanguage(lang);
        setIsPopoverOpen(false);
        // This line is the fix. It uses the trigger instead of calling the function directly.
        setShouldStartRecording(true);
    }}
/>
                        </div>
                        <button onClick={handleAskQuestion} disabled={!selectedPdf || isLoading} className="px-4 py-2 text-white bg-green-500 rounded-r-md hover:bg-green-600 disabled:bg-green-300 flex items-center">
                            {isLoading ? <Spinner /> : 'Ask'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;