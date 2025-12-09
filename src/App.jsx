import React from 'react';
import Form from './components/Form';

function App() {
  return (
    <div style={{ width: '100%', paddingBottom: '4rem' }}>
      <h1 className="animate-fade-in" style={{ marginBottom: '0.5rem' }}>LateResponse44</h1>
      <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-secondary)' }}>Automated Late Response PowerPoint Generator</p>

      <Form />
    </div>
  );
}

export default App;
