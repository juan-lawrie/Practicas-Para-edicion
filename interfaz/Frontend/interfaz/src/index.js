import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
// Global error handlers to capture uncaught exceptions and promise rejections
window.addEventListener('error', (event) => {
  console.error('[GlobalError] Uncaught error:', event.error || event.message, event);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[GlobalError] Unhandled rejection:', event.reason);
});

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
