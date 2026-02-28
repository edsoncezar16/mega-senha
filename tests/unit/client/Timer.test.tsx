import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Timer from '../../../client/src/components/Timer';

// Circumference for r=36: 2 * π * 36 ≈ 226.195
const CIRCUMFERENCE = 2 * Math.PI * 36;

function getProgressCircle(container: HTMLElement): SVGCircleElement {
  // The second circle is the progress arc (first is background track)
  const circles = container.querySelectorAll('circle');
  return circles[1] as SVGCircleElement;
}

describe('Timer component', () => {
  it('renders remaining time as text in the SVG', () => {
    const { container } = render(<Timer remaining={90} total={90} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('90');
  });

  it('shows 0 when remaining is 0', () => {
    const { container } = render(<Timer remaining={0} total={90} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('0');
  });

  it('shows any positive remaining value', () => {
    const { container } = render(<Timer remaining={45} total={90} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('45');
  });

  it('progress arc dashoffset is 0 when remaining=total (full circle)', () => {
    const { container } = render(<Timer remaining={90} total={90} />);
    const arc = getProgressCircle(container);
    // progress=1 → dashOffset = circumference * (1-1) = 0
    expect(Number(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 1);
  });

  it('progress arc dashoffset is ~half circumference when remaining=total/2', () => {
    const { container } = render(<Timer remaining={45} total={90} />);
    const arc = getProgressCircle(container);
    const offset = Number(arc.getAttribute('stroke-dashoffset'));
    // progress=0.5 → dashOffset = circumference * 0.5
    expect(offset).toBeCloseTo(CIRCUMFERENCE * 0.5, 0);
  });

  it('progress arc dashoffset is circumference when remaining=0 (empty)', () => {
    const { container } = render(<Timer remaining={0} total={90} />);
    const arc = getProgressCircle(container);
    const offset = Number(arc.getAttribute('stroke-dashoffset'));
    // progress=0 → dashOffset = circumference * 1
    expect(offset).toBeCloseTo(CIRCUMFERENCE, 0);
  });

  it('stroke is green (#22c55e) when remaining > 30', () => {
    const { container } = render(<Timer remaining={60} total={90} />);
    const arc = getProgressCircle(container);
    expect(arc.getAttribute('stroke')).toBe('#22c55e');
  });

  it('stroke is amber (#f59e0b) when remaining is between 11 and 30', () => {
    const { container } = render(<Timer remaining={20} total={90} />);
    const arc = getProgressCircle(container);
    expect(arc.getAttribute('stroke')).toBe('#f59e0b');
  });

  it('stroke is red (#ef4444) when remaining ≤ 10', () => {
    const { container } = render(<Timer remaining={5} total={90} />);
    const arc = getProgressCircle(container);
    expect(arc.getAttribute('stroke')).toBe('#ef4444');
  });

  it('stroke is red at exactly 10', () => {
    const { container } = render(<Timer remaining={10} total={90} />);
    const arc = getProgressCircle(container);
    expect(arc.getAttribute('stroke')).toBe('#ef4444');
  });

  it('stroke is green at exactly 31', () => {
    const { container } = render(<Timer remaining={31} total={90} />);
    const arc = getProgressCircle(container);
    expect(arc.getAttribute('stroke')).toBe('#22c55e');
  });

  it('uses default total=90 when not provided', () => {
    const { container } = render(<Timer remaining={45} />);
    const arc = getProgressCircle(container);
    const offset = Number(arc.getAttribute('stroke-dashoffset'));
    expect(offset).toBeCloseTo(CIRCUMFERENCE * 0.5, 0);
  });
});
