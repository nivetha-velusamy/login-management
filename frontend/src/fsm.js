export const STATES = { OUT: 'Logged Out', AUTH: 'Authenticating', IN: 'Logged In', EXPIRED: 'Session Expired' };
export const initialFSM = { state: STATES.OUT, history: [{ state: STATES.OUT, event: 'INITIAL', at: new Date().toISOString() }] };
export function fsmReducer(current, action) {
  const event = typeof action === 'string' ? action : action?.type;
  const transitions = {
    LOGIN_REQUEST: STATES.AUTH,
    LOGIN_SUCCESS: STATES.IN,
    LOGIN_FAILURE: STATES.OUT,
    LOGOUT: STATES.OUT,
    SESSION_EXPIRED: STATES.EXPIRED,
    RETURN_TO_LOGIN: STATES.OUT
  };
  const next = transitions[event];
  if (!next) return current;
  return { state: next, history: [...current.history, { state: next, event, at: new Date().toISOString() }].slice(-12) };
}
