// Archivo de configuración simple para la API.
// NOTA: Anteriormente este archivo exportaba directamente una instancia de axios y
// en `services/api.js` se importaba como si fuera un objeto de configuración (API_CONFIG),
// provocando que baseURL quedara undefined y las peticiones fueran relativas a `http://localhost:3000`.
// Resultado: 404 Cannot POST /auth/login/.

const API_CONFIG = {
  // Configuración para apuntar directamente al servidor Django
  baseURL: 'http://localhost:8000/api',
  timeout: 10000
};

// HCAPTCHA site key para el frontend. Reemplazar por la clave real en producción.
API_CONFIG.hcaptchaSiteKey = '10000000-ffff-ffff-ffff-000000000001';

export default API_CONFIG;
