// src/lib/tickets.js
// Ticket check-in sessions and QR codes, in one place.

// The database keeps its ORIGINAL slot values ("breakfast" and "dinner"), so every existing check-in
// stays valid and nothing needs migrating. People only ever see them as Day and Night.
export const TICKET_SLOTS = [
  { id: 'breakfast', label: 'Day',   icon: '☀️' },
  { id: 'dinner',    label: 'Night', icon: '🌙' },
]
export const slotLabel = (id) => TICKET_SLOTS.find(s => s.id === id)?.label || id

// What goes inside a ticket's QR code. New tickets use TICKET-<id>; the scanner still accepts
// MEAL-<id> so QR codes already issued (screenshots, printouts, older app versions) keep working.
export const ticketQrValue = (registrationId) => `TICKET-${registrationId}`
export const parseTicketQr = (text) => String(text || '').replace(/^(?:TICKET|MEAL)-/i, '').trim()
