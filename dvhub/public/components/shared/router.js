import { signal } from '@preact/signals';

export const currentRoute = signal(window.location.hash.slice(1) || '/');

window.addEventListener('hashchange', () => {
  currentRoute.value = window.location.hash.slice(1) || '/';
});

export function navigate(path) {
  window.location.hash = path;
}
