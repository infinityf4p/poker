export type Route =
  | { kind: 'home' }
  | { kind: 'admin' }
  | { kind: 'join'; token: string }
  | { kind: 'room'; roomId: string };

export function currentRoute(): Route {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'admin') return { kind: 'admin' };
  if (parts[0] === 'join' && parts[1]) return { kind: 'join', token: parts[1] };
  if (parts[0] === 'room' && parts[1]) return { kind: 'room', roomId: parts[1] };
  return { kind: 'home' };
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, left: 0 });
}
