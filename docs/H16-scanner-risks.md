# H16 follow-up: scanner async lifecycle

H15 adds explicit phase transitions and a one-shot save gate. It does not add
request cancellation or per-session identity, so H16 still needs to address:

- Open Food Facts and Gemini requests continue after the scanner closes. There
  is no shared `AbortController` owned by a scanner session.
- Requests have no session token. A delayed response can still update status or
  show an error toast after a later close/reopen, even though phase transitions
  reject product confirmation from an invalid phase.
- Camera `start()` and `stop()` calls have no generation token or serialized
  queue. Closing or reopening while either promise is pending can race the
  camera library's internal state.
- Modal animation and confirmation focus use existing `setTimeout` callbacks;
  closing the scanner does not cancel those callbacks.
- Existing OFF and Gemini request timeouts remain local to those requests.
  H15 adds no global timeout or timer between scanner sessions.

H16 should cover delayed OFF/Gemini responses across close/reopen, cancellation,
camera start/stop ordering, and timer cleanup without changing H15's synchronous
`SCANNING → LOOKUP` or `CONFIRM → SAVING` guards.
