import React, { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';

function App() {
    // Check localStorage for an existing token to maintain the session
    const [token, setToken] = useState(localStorage.getItem('authToken'));

    // This function is passed to the Login component
    // It updates the token in state and localStorage upon successful login
    const handleLoginSuccess = (newToken) => {
        localStorage.setItem('authToken', newToken);
        setToken(newToken);
    };

    // This function is passed to the Chat component
    // It clears the token from state and localStorage to log the user out
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setToken(null);
    };

    return (
        <div className="h-screen w-screen bg-gray-800">
            {token ? (
                <Chat token={token} onLogout={handleLogout} />
            ) : (
                <Login onLoginSuccess={handleLoginSuccess} />
            )}
        </div>
    );
}

export default App;