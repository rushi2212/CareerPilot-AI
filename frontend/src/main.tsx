import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './features.css';
import './tutor.css';
import './more-modules.css';
import './profile-history.css';
import './knowledge.css';
import './code-arena.css';
import './tutor-markdown.css';
import './jobs-auto.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
