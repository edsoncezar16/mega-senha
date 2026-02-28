import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Home from '../../../client/src/components/Home';

function makeSocket() {
  return { emit: vi.fn() };
}

describe('Home component', () => {
  let socket: ReturnType<typeof makeSocket>;
  const onClearError = vi.fn();

  beforeEach(() => {
    socket = makeSocket();
    onClearError.mockReset();
  });

  function renderHome(serverError: string | null = null) {
    return render(
      <Home
        socket={socket as any}
        serverError={serverError}
        onClearError={onClearError}
      />
    );
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  it('renders the title "Mega Senha"', () => {
    renderHome();
    expect(screen.getByText('Mega Senha')).toBeTruthy();
  });

  it('shows "Criar sala" and "Entrar" buttons in home mode', () => {
    renderHome();
    expect(screen.getByText('Criar sala')).toBeTruthy();
    expect(screen.getByText('Entrar')).toBeTruthy();
  });

  // ── Mode transitions ─────────────────────────────────────────────────────

  it('"Criar sala" button switches to create form', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Criar sala'));
    // In create mode the submit button is also "Criar sala"; the back button appears
    expect(screen.getByText('Voltar')).toBeTruthy();
  });

  it('"Entrar" button switches to join form', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Entrar'));
    expect(screen.getByPlaceholderText('Ex: ABCD')).toBeTruthy();
    expect(screen.getByText('Voltar')).toBeTruthy();
  });

  it('"Voltar" in create mode returns to home screen', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Criar sala'));
    await userEvent.click(screen.getByText('Voltar'));
    // Back in home mode: two primary buttons again
    expect(screen.getByText('Entrar')).toBeTruthy();
  });

  it('"Voltar" in join mode returns to home screen', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Entrar'));
    await userEvent.click(screen.getByText('Voltar'));
    expect(screen.getByText('Criar sala')).toBeTruthy();
  });

  // ── Create form ──────────────────────────────────────────────────────────

  it('create submit button is disabled when name is empty', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Criar sala'));
    // Find the submit "Criar sala" button (the one with disabled attr)
    const buttons = screen.getAllByText('Criar sala');
    const submitBtn = buttons.find(
      (b) => b.tagName === 'BUTTON' && (b as HTMLButtonElement).disabled
    );
    expect(submitBtn).toBeTruthy();
  });

  it('create form emits create_room with player name on click', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Criar sala'));

    const nameInput = screen.getByPlaceholderText('Ex: Maria');
    await userEvent.type(nameInput, 'Ana');

    // Find the enabled submit button
    const buttons = screen.getAllByText('Criar sala');
    const submitBtn = buttons.find(
      (b) => b.tagName === 'BUTTON' && !(b as HTMLButtonElement).disabled
    ) as HTMLButtonElement;
    await userEvent.click(submitBtn);

    expect(socket.emit).toHaveBeenCalledWith('create_room', { playerName: 'Ana' });
  });

  // ── Join form ────────────────────────────────────────────────────────────

  it('join submit button is disabled when code has fewer than 4 chars', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Entrar'));

    const nameInput = screen.getByPlaceholderText('Ex: Maria');
    await userEvent.type(nameInput, 'Ana');

    const codeInput = screen.getByPlaceholderText('Ex: ABCD');
    await userEvent.type(codeInput, 'AB'); // only 2 chars

    const submitBtn = screen.getByText('Entrar na sala') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('join form emits join_room with name and uppercased code on click', async () => {
    renderHome();
    await userEvent.click(screen.getByText('Entrar'));

    const nameInput = screen.getByPlaceholderText('Ex: Maria');
    await userEvent.type(nameInput, 'Bia');

    const codeInput = screen.getByPlaceholderText('Ex: ABCD');
    await userEvent.type(codeInput, 'ABCD');

    await userEvent.click(screen.getByText('Entrar na sala'));

    expect(socket.emit).toHaveBeenCalledWith('join_room', {
      roomCode: 'ABCD',
      playerName: 'Bia',
    });
  });

  // ── Error display ────────────────────────────────────────────────────────

  it('shows error message when serverError is non-null', () => {
    renderHome('Sala não encontrada.');
    expect(screen.getByText('Sala não encontrada.')).toBeTruthy();
  });

  it('does not show error when serverError is null', () => {
    renderHome(null);
    expect(screen.queryByText('Sala não encontrada.')).toBeNull();
  });

  it('dismiss button calls onClearError', async () => {
    renderHome('Algum erro');
    const dismissBtn = screen.getByText('✕');
    await userEvent.click(dismissBtn);
    expect(onClearError).toHaveBeenCalledTimes(1);
  });
});
