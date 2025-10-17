import axios from 'axios';
import API_CONFIG from '../config/api';

// Crear instancia de axios con configuración del backend
const api = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // necesario para enviar cookies HttpOnly desde el navegador
});

// Promesa compartida para evitar múltiples refresh en paralelo
let refreshPromise = null;

// Token en memoria para evitar llamadas a backend desde el interceptor
// (previene 401s y ciclos de importación). App.js debe llamar setInMemoryToken
// justo después de un login exitoso, y clearInMemoryToken en logout.
let _inMemoryAccessToken = null;
const setInMemoryToken = (token) => { _inMemoryAccessToken = token; };
const clearInMemoryToken = () => { _inMemoryAccessToken = null; };
const getInMemoryToken = () => _inMemoryAccessToken;

// Interceptor para agregar token automáticamente
// Interceptor: usar token en memoria (no llamar al backend aquí)
api.interceptors.request.use(
  (config) => {
    try {
      const token = getInMemoryToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      // no-op
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const originalRequest = error?.config;
    if (!originalRequest) return Promise.reject(error);

    // No intentar refresh si la petición original es la misma ruta de refresh
    if (originalRequest.url && originalRequest.url.includes('/refresh-cookie')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      // Si ya hay un refresh en curso, esperar esa promesa
      if (!refreshPromise) {
        // Usar fetch con credentials:'include' para forzar que el navegador envíe
        // la cookie HttpOnly al endpoint proxied `/api/refresh-cookie/` y evitar
        // recursiones por interceptores de axios.
        const refreshUrl = `${API_CONFIG.baseURL}/refresh-cookie/`;
        refreshPromise = fetch(refreshUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(response => {
          if (!response.ok) throw new Error('Refresh fallido');
          return response.json();
        })
        .then(data => {
          if (data && data.access) {
            // Actualizar token en memoria para que el interceptor lo use
            try { setInMemoryToken(data.access); } catch (e) {}
            return data.access;
          }
          // Si el backend responde con access: null, limpiar token y forzar logout inmediato
          if (data && data.access === null) {
            try { clearInMemoryToken(); } catch (e) {}
            if (typeof window !== 'undefined') window.location.href = '/';
            throw new Error('Refresh fallido: access=null, sesión inválida');
          }
          throw new Error('Refresh fallido: no se devolvió access');
        })
        .catch(err => {
          try { clearInMemoryToken(); } catch (e) {}
          throw err;
        })
        .finally(() => { refreshPromise = null; });
      }

      return refreshPromise.then(access => {
        originalRequest.headers['Authorization'] = `Bearer ${access}`;
        return axios(originalRequest);
      }).catch(err => Promise.reject(err));
    }

    return Promise.reject(error);
  }
);

// Helper para login que delega al endpoint legacy y backend que ahora setea refresh cookie
const backendLogin = async (email, password) => {
  return api.post('/auth/login/', { email, password });
};

const backendLogout = async () => {
  return api.post('/logout/');
};

// Función para obtener los datos del usuario actual
const getCurrentUserData = async () => {
    const response = await api.get('/users/me/');
    return response.data;
};

// Funciones para la gestión de solicitudes de compra
const getPendingPurchases = () => {
  return api.get('/purchases/pending-approval/');
};

const approvePurchase = (id) => {
  return api.post(`/purchases/${id}/approve/`);
};

const rejectPurchase = (id) => {
  return api.post(`/purchases/${id}/reject/`);
};

const getPurchaseHistory = () => {
  return api.get('/purchases/history/');
};

export default api;

// Exportar los helpers públicos (incluyendo setters para el token en memoria)
export { 
  backendLogin, 
  backendLogout, 
  setInMemoryToken, 
  clearInMemoryToken, 
  getInMemoryToken, 
  getCurrentUserData,
  getPendingPurchases,
  approvePurchase,
  rejectPurchase,
  getPurchaseHistory
};