import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Chat from './components/Chat';
import Register from './components/Register';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const navigate = useNavigate();

  const handleSetToken = (token) => {
    localStorage.setItem('token', token);
    setToken(token);
    navigate('/chat');
  };

  return (
    <div>
      <Routes>
        <Route path="/login" element={<Login setToken={handleSetToken} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={<Chat token={token} />} />
        <Route path="/" element={<Login setToken={handleSetToken} />} />
      </Routes>
    </div>
  );
}

export default App;