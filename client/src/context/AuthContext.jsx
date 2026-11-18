import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken } from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let alive = true;
    api
      .get('/auth/me')
      .then((res) => alive && setUser(res.data.user))
      .catch(() => alive && logout())
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token, logout]);

  useEffect(() => {
    window.addEventListener('orchestra:unauthorized', logout);
    return () => window.removeEventListener('orchestra:unauthorized', logout);
  }, [logout]);

  const authenticate = useCallback(async (path, body, remember = false) => {
    const res = await api.post(path, body);
    setToken(res.data.token, remember);
    setUser(res.data.user);
    setTokenState(res.data.token);
    return res.data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAdmin: user?.role === 'admin',
      login: (email, password, remember = false) => authenticate('/auth/login', { email, password }, remember),
      register: (name, email, password, remember = false) => authenticate('/auth/register', { name, email, password }, remember),
      logout,
    }),
    [user, token, loading, authenticate, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
