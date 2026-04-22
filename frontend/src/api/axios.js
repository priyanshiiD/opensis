import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('erp_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('erp_refresh_token');
        if (!refresh) throw new Error('No refresh token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken: refresh });
        localStorage.setItem('erp_access_token', data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('erp_access_token');
        localStorage.removeItem('erp_refresh_token');
        window.location.href = '/login';
      }
    }
    
    // Don't show toast for login/auth related errors (they are handled by the component)
    const isAuthError = err.config?.url?.includes('/auth/login') || 
                       err.config?.url?.includes('/auth/refresh') ||
                       err.response?.status === 401 ||
                       err.response?.status === 404;
    
    if (!isAuthError) {
      const message = err.response?.data?.message || 'Something went wrong';
      toast.error(message);
    }
    
    return Promise.reject(err);
  }
);

export default api;
