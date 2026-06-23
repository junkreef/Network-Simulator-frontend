import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver which is used by Xterm and React Flow
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// Mock SVG getBBox for React Flow rendering in jsdom
if (global.SVGElement && !global.SVGElement.prototype.getBBox) {
  global.SVGElement.prototype.getBBox = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }) as any;
}

// Mock window.HTMLCanvasElement.prototype.getContext
// Since jsdom doesn't support canvas out of the box and ReactFlow uses it
HTMLCanvasElement.prototype.getContext = () => null as any;
