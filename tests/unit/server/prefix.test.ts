import { describe, it, expect } from 'vitest';
import { sharesPrefix } from '../../../server/src/game/prefix';

describe('sharesPrefix', () => {
  it('first 3 chars match → returns true', () => {
    expect(sharesPrefix('casa', 'casamento')).toBe(true);
  });

  it('only 2 chars match → returns false', () => {
    // 'cam' vs 'cap' — differ at position 2
    expect(sharesPrefix('cama', 'capaz')).toBe(false);
  });

  it('same word → returns true', () => {
    expect(sharesPrefix('casa', 'casa')).toBe(true);
  });

  it('case-insensitive: CASA vs casamento → true', () => {
    expect(sharesPrefix('CASA', 'casamento')).toBe(true);
  });

  it('diacritics normalized: café vs cafeína → true', () => {
    // 'café' → 'cafe', 'cafeína' → 'cafeina'; first 3 chars 'caf' === 'caf'
    expect(sharesPrefix('café', 'cafeína')).toBe(true);
  });

  it('diacritics normalized: ânimo vs animado → true', () => {
    // 'ânimo' → 'animo', 'animado' → 'animado'; first 3 chars 'ani' === 'ani'
    expect(sharesPrefix('ânimo', 'animado')).toBe(true);
  });

  it('diacritics normalized: açúcar vs acupuntura → true', () => {
    // 'açúcar' → 'acucar', 'acupuntura' → 'acupuntura'; first 3 chars 'acu' === 'acu'
    expect(sharesPrefix('açúcar', 'acupuntura')).toBe(true);
  });

  it('hint shorter than 3 chars: "ca" vs "cama" uses len=2 → true', () => {
    // len = min(2, 4, 3) = 2; 'ca' === 'ca'
    expect(sharesPrefix('ca', 'cama')).toBe(true);
  });

  it('hint shorter than 3 chars: "be" vs "bola" — differ → false', () => {
    // len = min(2, 4, 3) = 2; 'be' !== 'bo'
    expect(sharesPrefix('be', 'bola')).toBe(false);
  });

  it('empty hint → returns false', () => {
    expect(sharesPrefix('', 'palavra')).toBe(false);
  });

  it('completely different words → false', () => {
    expect(sharesPrefix('zebra', 'palavra')).toBe(false);
  });

  it('hint is exact prefix of target → true', () => {
    expect(sharesPrefix('abc', 'abcdef')).toBe(true);
  });

  it('target is exact prefix of hint → true', () => {
    expect(sharesPrefix('abcdef', 'abc')).toBe(true);
  });

  it('shares exactly 3 chars: partido vs parafuso → true', () => {
    // 'par' === 'par'
    expect(sharesPrefix('partido', 'parafuso')).toBe(true);
  });

  it('only first char matches → false', () => {
    // 'bol' vs 'ber' — 'b' matches but len=3 comparison fails at char 2
    expect(sharesPrefix('bola', 'berra')).toBe(false);
  });

  it('both hints are 1-char and match → true', () => {
    // len = min(1, 1, 3) = 1; 'a' === 'a'
    expect(sharesPrefix('a', 'a')).toBe(true);
  });

  it('both hints are 1-char and differ → false', () => {
    expect(sharesPrefix('a', 'b')).toBe(false);
  });

  it('mixed case with diacritics: CAFÉ vs cafeteira → true', () => {
    // 'CAFÉ' → 'cafe', 'cafeteira' → 'cafeteira'; 'caf' === 'caf'
    expect(sharesPrefix('CAFÉ', 'cafeteira')).toBe(true);
  });

  it('trailing whitespace trimmed before comparison', () => {
    // normalize() trims; 'cas ' → 'cas'
    expect(sharesPrefix('cas ', 'casamento')).toBe(true);
  });
});
