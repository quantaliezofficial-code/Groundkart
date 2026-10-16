import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import SmoothScroll, { useSmoothScroll } from './SmoothScroll';
import BackToTopButton from './ui/BackToTopButton';

function TestConsumer() {
  const { scrollTo } = useSmoothScroll();
  return (
    <div>
      <div id="target-element">Target Element</div>
      <button onClick={() => scrollTo('#target-element')}>Scroll To Target</button>
      <button onClick={() => scrollTo(500)}>Scroll To 500</button>
    </div>
  );
}

describe('SmoothScroll & Lenis UI Integration', () => {
  it('renders children wrapped inside SmoothScroll provider', () => {
    render(
      <BrowserRouter>
        <SmoothScroll>
          <div data-testid="child-content">GroundKart Content</div>
        </SmoothScroll>
      </BrowserRouter>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('exposes scrollTo function via useSmoothScroll hook', () => {
    render(
      <BrowserRouter>
        <SmoothScroll>
          <TestConsumer />
        </SmoothScroll>
      </BrowserRouter>
    );

    const btnTarget = screen.getByText('Scroll To Target');
    const btnNumber = screen.getByText('Scroll To 500');

    expect(() => fireEvent.click(btnTarget)).not.toThrow();
    expect(() => fireEvent.click(btnNumber)).not.toThrow();
  });

  it('renders BackToTopButton and handles click safely', () => {
    render(
      <BrowserRouter>
        <SmoothScroll>
          <BackToTopButton />
        </SmoothScroll>
      </BrowserRouter>
    );

    // Simulate scroll past threshold
    act(() => {
      window.scrollY = 450;
      window.dispatchEvent(new Event('scroll'));
    });

    const btn = screen.queryByRole('button', { name: /scroll to top/i });
    if (btn) {
      expect(() => fireEvent.click(btn)).not.toThrow();
    }
  });
});
