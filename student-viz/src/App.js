import React from 'react';
import StudentViz from './StudentViz';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">Lab Performance Analysis</h1>
        </header>
        <StudentViz />
      </div>
    </div>
  );
}

export default App;