import axios from 'axios';

export const TOKEN_KEY = 'orchestra-token';

// By default a login lives in this tab only (sessionStorage), so you can sign in as different
// people in different tabs. "Keep me signed in" stores it in localStorage, which every tab
// and every incognito window in the same browser session shares.
export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token, remember = false) => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable */
  }
};

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/');
    if (err.response?.status === 401 && !isAuthCall) window.dispatchEvent(new Event('orchestra:unauthorized'));
    return Promise.reject(err);
  }
);

// Turn any axios error into a message a user can act on.
export function errorMessage(err, fallback = 'Something went wrong. Try again.') {
  if (err?.response?.data?.issues?.length) return err.response.data.issues.map((i) => i.message).join('. ');
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the API. Check that the server is running.';
  // A reply without our JSON error means something other than the Orchestra API answered.
  const status = err?.response?.status;
  if (status === 403) return 'Something other than the Orchestra API answered (403). On a Mac, port 5000 belongs to AirPlay Receiver: run the API on port 5050.';
  if (status === 404) return 'The API route was not found. Check that the dashboard is pointed at the Orchestra server.';
  if (status >= 500) return `The API server is not responding (error ${status}). Make sure the server, MongoDB and Redis are running.`;
  return fallback;
}

export default api;
