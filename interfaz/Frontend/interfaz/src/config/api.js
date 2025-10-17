// Archivo de configuración simple para la API.
// NOTA: Anteriormente este archivo exportaba directamente una instancia de axios y
// en `services/api.js` se importaba como si fuera un objeto de configuración (API_CONFIG),
// provocando que baseURL quedara undefined y las peticiones fueran relativas a `http://localhost:3000`.
// Resultado: 404 Cannot POST /auth/login/.

const API_CONFIG = {
  // En desarrollo usamos el proxy del dev server (package.json -> proxy) para evitar CORS
  baseURL: '/api',
  timeout: 10000
};

export default API_CONFIG;
