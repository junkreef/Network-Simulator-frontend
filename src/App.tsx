import React from 'react';
import Header from './components/layout/Header';
import Canvas from './features/topology/Canvas';
import PropertyPanel from './components/property/PropertyPanel';
import WebTerminal from './components/terminal/WebTerminal';
import { ReactFlowProvider } from 'reactflow';
import './styles/global.css';

function App() {
  return (
    <ReactFlowProvider>
      <div className="app-container">
        <Header />
        <Canvas />
        <PropertyPanel />
        <WebTerminal />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
