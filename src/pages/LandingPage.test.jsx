import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { pendingConfigTokens } from '@/data/landing-page-content';

describe('37 Music Studio Public Landing Page (Phase 2)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all key sections, headings, and brand identity without raw pending tokens', () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /loud rooms\s*for loud\s*ideas\./i }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /pick your session/i })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /two rooms, zero guesswork/i }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /proof, not renders\./i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /three taps to loud\./i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /booking inquiry/i })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /2 min from the mainline\./i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /don’t rehearse in a garage\./i }),
    ).toBeTruthy();

    const pageText = container.textContent || '';
    for (const rawToken of Object.values(pendingConfigTokens)) {
      expect(pageText).not.toContain(rawToken);
    }
  });

  it('opens and closes the dummy Login coming-soon dialog without authentication inputs', async () => {
    const user = userEvent.setup();
    render(<App />);

    const loginButton = screen.getByRole('button', {
      name: /studio staff and owner login \(coming soon\)/i,
    });
    await user.click(loginButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/studio access is coming soon/i)).toBeTruthy();
    expect(
      within(dialog).getByText(/owner and operator login will be available in a future update\./i),
    ).toBeTruthy();
    expect(within(dialog).queryByLabelText(/password/i)).toBeNull();

    const closeButton = within(dialog).getByRole('button', { name: /got it/i });
    await user.click(closeButton);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('preselects the corresponding service and room when service or room CTAs are clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const mixMasterCta = screen.getByRole('button', {
      name: /check availability — mix & master/i,
    });
    await user.click(mixMasterCta);

    expect(
      screen.getByText(/preselected session: mix & master \(room b — control \+ booth\)/i),
    ).toBeTruthy();

    const mixToggleButton = screen.getByRole('button', { name: /^mix & master$/i });
    expect(mixToggleButton.getAttribute('aria-pressed')).toBe('true');

    const roomSelect = screen.getByLabelText(/room preference/i);
    expect(roomSelect.value).toBe('room-b');

    const roomACta = screen.getByRole('button', { name: /book this room \(room a\)/i });
    await user.click(roomACta);

    expect(screen.getByText(/preselected room: room a — live room/i)).toBeTruthy();
    expect(roomSelect.value).toBe('room-a');
  });

  it('validates booking inquiry inputs and displays the honest demo confirmation state on submit', async () => {
    const user = userEvent.setup();
    render(<App />);

    const submitButton = screen.getByRole('button', { name: /send booking inquiry/i });
    await user.click(submitButton);

    expect(await screen.findByText(/please enter your name or band name/i)).toBeTruthy();
    expect(await screen.findByText(/please enter a valid whatsapp or phone number/i)).toBeTruthy();

    const nameInput = screen.getByLabelText(/name \/ band name/i);
    const contactInput = screen.getByLabelText(/whatsapp \/ contact number/i);
    const notesInput = screen.getByLabelText(/notes \/ setup requirements/i);

    await user.type(nameInput, 'The Velvet Echoes');
    await user.type(contactInput, '+62 812 3456 7890');
    await user.type(notesInput, '4-piece indie rock band, need 2 guitar amps.');

    await user.click(submitButton);

    expect(
      await screen.findByText(
        /demo inquiry only — your request has not been sent\. the booking integration will be added later\./i,
      ),
    ).toBeTruthy();
    expect(screen.getByText('The Velvet Echoes')).toBeTruthy();

    const resetButton = screen.getByRole('button', { name: /reset \/ new inquiry/i });
    await user.click(resetButton);

    expect(screen.getByLabelText(/name \/ band name/i).value).toBe('');
  });

  it('opens the accessible gallery viewer dialog and cycles through studio images', async () => {
    const user = userEvent.setup();
    render(<App />);

    const viewAllButton = screen.getByRole('button', { name: /view all photos/i });
    await user.click(viewAllButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/maintained studio instruments & backline/i)).toBeTruthy();

    const nextButton = within(dialog).getByRole('button', { name: /next studio image/i });
    await user.click(nextButton);

    expect(within(dialog).getByText(/live drum room energy & sightlines/i)).toBeTruthy();
  });

  it('shows honest pending notices for unconfirmed external map and WhatsApp destinations', async () => {
    const user = userEvent.setup();
    render(<App />);

    const mapsButton = screen.getByRole('button', { name: /open in maps/i });
    await user.click(mapsButton);

    expect(
      await screen.findByText(
        /verified studio map coordinates and street address are pending owner confirmation/i,
      ),
    ).toBeTruthy();

    const whatsappButton = screen.getByRole('button', { name: /ask on whatsapp/i });
    await user.click(whatsappButton);

    expect(
      await screen.findByText(
        /the official 37 music studio whatsapp number is pending owner confirmation/i,
      ),
    ).toBeTruthy();
  });
});
