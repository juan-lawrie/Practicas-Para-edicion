import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import './App.css';
import api, { backendLogin, backendLogout, setInMemoryToken, clearInMemoryToken, getInMemoryToken, getPendingPurchases, approvePurchase, rejectPurchase, getPurchaseHistory } from './services/api';
import userStorage from './services/userStorage';
import DataConsultation from './DataConsultation';
import MyUserData from './components/MyUserData';
import PurchaseManagement from './components/PurchaseManagement';
import PurchaseRequests from './components/PurchaseRequests';
import PurchaseHistory from './components/PurchaseHistory';



// Helpers para usar el backend storage seguro
const loadLS = async (key, fallback) => {
    try {
        const value = await userStorage.loadLS(key);
        return value !== null && value !== undefined ? value : fallback;
    } catch (error) {
        if (console.debug) console.debug(`Error al cargar ${key} desde backend:`, error && error.message);
        return fallback;
    }
};

const saveLS = async (key, value) => {
    try {
        return await userStorage.saveLS(key, value);
    } catch (error) {
        if (console.debug) console.debug(`Error al guardar ${key} en backend:`, error && error.message);
        return false;
    }
};

const removeLS = async (key) => {
    try {
        return await userStorage.removeLS(key);
    } catch (error) {
        if (console.debug) console.debug(`Error al eliminar ${key} en backend:`, error && error.message);
        return false;
    }
};

// Función helper para obtener token de forma segura desde backend storage
const getAccessToken = async () => {
    try {
        return await loadLS('accessToken', null);
    } catch (error) {
        if (console.debug) console.debug('Error obteniendo token:', error && error.message);
        return null;
    }
};

// Función helper para guardar token de forma segura en backend storage
const saveAccessToken = async (token) => {
    try {
        return await saveLS('accessToken', token);
    } catch (error) {
        if (console.debug) console.debug('Error guardando token:', error && error.message);
        return false;
    }
};

// Asegurar que haya un token en memoria antes de hacer peticiones protegidas.
// Esto resuelve el caso de "segunda pestaña" donde la cookie HttpOnly existe
// pero el token en memoria (JS) todavía no está inicializado; hacemos un
// refresh silencioso explícito que rellena el token en memoria antes de
// proceder con llamadas que dependen del header Authorization.
const ensureInMemoryToken = async () => {
    try {
        if (getInMemoryToken()) return true;
        // Intentar refresh directo usando fetch para que la cookie HttpOnly se envíe
        if (console.debug) console.debug('ensureInMemoryToken: no hay token en memoria, llamando /api/refresh-cookie/');
        const resp = await fetch('/api/refresh-cookie/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
        if (!resp) {
            console.debug('ensureInMemoryToken: fetch devolvió respuesta vacía');
            return false;
        }
        if (!resp.ok) {
            console.debug('ensureInMemoryToken: refresh devolvió status', resp.status);
            // Intentar leer cuerpo si está disponible para más detalle
            try {
                const txt = await resp.text();
                console.debug('ensureInMemoryToken: cuerpo de respuesta (no ok):', txt);
            } catch (e) { /* ignore */ }
            return false;
        }
        const data = await resp.json();
        if (console.debug) console.debug('ensureInMemoryToken: refresh-cookie devolvió JSON:', data);
        if (data && data.access) {
            try { setInMemoryToken(data.access); } catch (e) { /* silent */ }
            try { await saveAccessToken(data.access); } catch (e) { /* silent */ }
            // No tocar setters de React desde helpers fuera del componente.
            return true;
        }
        return false;
    } catch (e) {
        console.debug('ensureInMemoryToken error:', e && e.message);
        return false;
    }
};

// Exponer utilidades de debug en window para diagnóstico manual desde la consola
if (typeof window !== 'undefined') {
    try {
        // No exponer helpers de debug en window por seguridad / limpieza
    } catch (e) {
        // ignore
    }
}

// Función helper para eliminar token de forma segura en backend storage
const removeAccessToken = async () => {
    try {
        return await removeLS('accessToken');
    } catch (error) {
        if (console.debug) console.debug('Error eliminando token:', error && error.message);
        return true; // Devolver true para no bloquear el logout
    }
};

// Función helper para convertir valores a números de forma segura antes de usar toFixed
const safeToFixed = (value, decimals = 2) => {
  const num = parseFloat(value);
  return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

// NOTE: validatePassword and handleLogin are defined inside the App component
// because they need access to React state setters (setLoginError, setIsLoggedIn, ...).

const getProductIdByName = (inventory, name) => {
  const p = inventory.find(i => i.name === name);
  return p ? p.id : null;
};



// Simulación de la base de datos de usuarios con roles y credenciales
const mockUsers = [
  { email: 'gerente@example.com', password: 'Password123', role: 'Gerente' },
  { email: 'encargado@example.com', password: 'Password456', role: 'Encargado' },
  { email: 'panadero@example.com', password: 'Password789', role: 'Panadero' },
  { email: 'cajero@example.com', password: 'Password012', role: 'Cajero' },
];

const passwordPolicy = {
  minLength: 8,
  hasUpperCase: true,
  hasLowerCase: true,
  hasNumber: true,
};

const rolePermissions = {
    'Gerente': ['Dashboard', 'Inventario', 'Gestión de Usuarios', 'Ventas', 'Pedidos', 'Productos', 'Editar Productos', 'Proveedores', 'Compras', 'Consultas', 'Ver Reportes de Faltantes'],
    'Panadero': ['Dashboard', 'Inventario', 'Ventas', 'Datos de mi Usuario', 'Reportar Faltantes'],
    'Encargado': ['Dashboard', 'Inventario', 'Ventas', 'Compras', 'Datos de mi Usuario'],
    'Cajero': ['Dashboard', 'Ventas', 'Inventario', 'Datos de mi Usuario', 'Reportar Faltantes'],
  };

// Componente principal de la aplicación.
const App = () => {
    // Limpiar almacenamiento de productos y movimientos de caja: sólo si ya hay token en memoria
    // (evita llamadas backend en el montaje cuando el usuario no está autenticado)
    React.useEffect(() => {
        try {
            const token = getInMemoryToken();
            if (!token) return; // sin token -> no intentamos tocar userstorage

            (async () => {
                try {
                    const removedProducts = await removeLS('products');
                    const removedCash = await removeLS('cashMovements');
                    console.log('🧹 Almacenamiento limpiado al iniciar (usuario autenticado):');
                    console.log('- Productos:', removedProducts ? 'Éxito' : 'Con warnings');
                    console.log('- Movimientos de caja:', removedCash ? 'Éxito' : 'Con warnings');
                    console.log('✅ Datos se cargarán desde PostgreSQL');
                } catch (err) {
                    console.warn('Error asíncrono al limpiar almacenamiento:', err);
                }
            })();
        } catch (error) {
            console.warn('Error al comprobar token en memoria:', error);
        }
    }, []);

    

    // Estados para el sistema de autenticación
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    // Indica si ya intentamos restaurar sesión al montar (para evitar parpadeos)
    const [sessionChecked, setSessionChecked] = useState(false);
    // Intentar restaurar el token en memoria al montar la app y cada vez que la pestaña
    // reciba foco. Esto reduce la ventana donde una nueva pestaña tiene la cookie HttpOnly
    // pero no tiene aún el token en memoria, evitando el caso en que la primera consulta
    // devuelve vacío y la segunda sí funciona.
    useEffect(() => {
        let mounted = true;

        const tryRestore = async () => {
            try {
                const currentToken = getInMemoryToken();
                if (currentToken || sessionChecked) return;
                if (console.debug) console.debug('App: intentando restaurar token en memoria al montar');
                const restored = await ensureInMemoryToken();
                if (restored && mounted) {
                    setIsLoggedIn(true);
                }
            } catch (e) {
                // ignore
            } finally {
                if (mounted) setSessionChecked(true);
            }
        };

        // llamada inmediata
        tryRestore();

        const onFocus = async () => {
            try {
                if (console.debug) console.debug('App: pestaña recibió focus, intentando restaurar token en memoria');
                const currentToken = getInMemoryToken();
                if (!currentToken) {
                    const restored = await ensureInMemoryToken();
                    if (restored && mounted) setIsLoggedIn(true);
                }
            } catch (e) { /* ignore */ }
        };

        window.addEventListener('focus', onFocus);
        return () => { mounted = false; window.removeEventListener('focus', onFocus); };
    }, [sessionChecked]);
    const [loginError, setLoginError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const maxAttempts = 5;
     
    // Estado para el rol del usuario actualmente autenticado.
    const [userRole, setUserRole] = useState(null);
    // Estado para la página current a mostrar.
    const [currentPage, setCurrentPage] = useState('login');
    // Estado para la lista de roles
    const [roles, setRoles] = useState([]);
    const [confirmDeletePurchaseId, setConfirmDeletePurchaseId] = useState(null);

    // Función para cargar roles desde el backend
    const loadRoles = async () => {
        try {
            const response = await api.get('/roles/');
            if (response.data) {
                setRoles(response.data);
            }
        } catch (error) {
            console.error('Error cargando roles:', error);
        }
    };

    const handleApprovePurchase = async (purchaseId) => {
        try {
            await api.post(`/purchases/${purchaseId}/approve/`);
            fetchPurchases();
            fetchPurchaseHistory();
        } catch (error) {
            console.error("Error approving purchase", error);
        }
    };

    const handleRejectPurchase = async (purchaseId) => {
        try {
            await api.post(`/purchases/${purchaseId}/reject/`);
            fetchPurchases();
        } catch (error) {
            console.error("Error rejecting purchase", error);
        }
    };

    const handleDeletePurchase = async (purchaseId) => {
        if (confirmDeletePurchaseId === purchaseId) {
            try {
                await api.delete(`/purchases/${purchaseId}/`);
                fetchPurchaseHistory();
                setConfirmDeletePurchaseId(null);
            } catch (error) {
                console.error("Error deleting purchase", error);
            }
        } else {
            setConfirmDeletePurchaseId(purchaseId);
        }
    };

    const handleCancelDeletePurchase = () => {
        setConfirmDeletePurchaseId(null);
    };

        // Validación de contraseña mínima (se usa en creación de usuarios)
        const validatePassword = (pwd) => {
            if (!pwd || typeof pwd !== 'string') return 'La contraseña es obligatoria';
            if (pwd.length < (passwordPolicy?.minLength || 8)) return `La contraseña debe tener al menos ${(passwordPolicy?.minLength || 8)} caracteres`;
            if (passwordPolicy?.hasUpperCase && !/[A-Z]/.test(pwd)) return 'La contraseña debe contener al menos una mayúscula';
            if (passwordPolicy?.hasLowerCase && !/[a-z]/.test(pwd)) return 'La contraseña debe contener al menos una minúscula';
            if (passwordPolicy?.hasNumber && !/[0-9]/.test(pwd)) return 'La contraseña debe contener al menos un número';
            return null; // sin errores
        };

        // Manejo de login: realiza petición al backend, guarda token y actualiza estado
        const handleLogin = async (e, { email: userEmail, password: userPassword }) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        try {
            setLoginError('');
            // Validaciones mínimas
            if (!userEmail || !userPassword) {
                setLoginError('Debes ingresar email y contraseña');
                setFailedAttempts(prev => prev + 1);
                return;
            }
            let resp;
            const looksLikeEmail = userEmail && userEmail.includes('@');
            try {
                if (looksLikeEmail) {
                    resp = await api.post('/auth/login/', { email: userEmail, password: userPassword });
                } else {
                    resp = await api.post('/token/', { username: userEmail, password: userPassword });
                }
            } catch (innerErr) {
                const status = innerErr?.response?.status;
                if (status === 404 || status === 400 || status === 401) {
                    if (looksLikeEmail) {
                        console.warn(`/api/auth/login/ responded with ${status}, intentando /api/token/ como fallback`);
                        resp = await api.post('/token/', { username: userEmail, password: userPassword });
                    } else {
                        console.warn(`/api/token/ responded with ${status}, intentando /api/auth/login/ como fallback`);
                        resp = await api.post('/auth/login/', { email: userEmail, password: userPassword });
                    }
                } else {
                    throw innerErr;
                }
            }
            const access = resp?.data?.access
                || resp?.data?.accessToken
                || resp?.data?.token
                || resp?.data?.tokens?.access
                || resp?.data?.tokens?.access_token
                || resp?.data?.tokens?.token;

            if (!access) {
                console.error('Respuesta de login sin token esperado:', resp?.data);
                setLoginError('No se recibió token del servidor');
                return;
            }

            try { setInMemoryToken(access); } catch (err) { /* silent */ }
            try { await saveAccessToken(access); } catch (err) { console.warn('No se pudo guardar token:', err); }

            setIsLoggedIn(true);
            const roleFromResp = resp?.data?.user?.role || resp?.data?.role || (resp?.data?.user && resp.data.user.role) || 'Gerente';
            setUserRole(roleFromResp);
            setCurrentPage('dashboard');

            // Cargar datos iniciales
            await Promise.all([
                loadUsersFromBackend(),
                loadProducts(),
                loadSales(),
                loadRoles()
            ]);
            console.log('🔐 Login completo y datos iniciales cargados');
        } catch (error) {
            console.error('Error de login con backend:', error?.response?.data || error?.message || error);
            setFailedAttempts(prev => prev + 1);
            if (error.response && error.response.status === 401) setLoginError('Credenciales inválidas');
            else setLoginError('Error iniciando sesión. Revisa la consola.');
        }
    };
    
    // Estado para el inventario - SIEMPRE basado en products, PERO products SÍ usa localStorage
    const [inventory, setInventory] = useState(() => {
        console.log('📋 Inicializando inventario vacío (se generará desde products)');
        return []; // Empezar vacío - se generará desde products
    });
    
    // Usuarios - cargar desde backend, mantener persistencia
    const [users, setUsers] = useState([]);
    
    // Movimientos de caja - SIEMPRE cargar desde backend, NO usar localStorage
    const [cashMovements, setCashMovements] = useState(() => {
        console.log('💰 Inicializando movimientos de caja vacíos (se cargarán desde PostgreSQL)');
        return []; // Empezar vacío - se cargarán desde PostgreSQL
    });
    
    // Proveedores
    // Proveedores - cargar solo desde backend
    const [suppliers, setSuppliers] = useState([]);
    
    // Compras
    const [purchases, setPurchases] = useState([]);

    // Ventas (traídas desde backend)
    const [sales, setSales] = useState([]);

        // Normalize purchase object returned by server to frontend-friendly shape
        const normalizePurchaseFromServer = (p) => {
            if (!p) return p;
            const totalAmount = p.total_amount ?? p.totalAmount ?? 0;
            const supplierName = p.supplier_name ?? p.supplierName ?? p.supplier ?? '';
            const items = Array.isArray(p.items) ? p.items.map(item => ({
                ...item,
                total: item.total ?? item.totalAmount ?? (item.quantity && item.unitPrice ? item.quantity * item.unitPrice : 0)
            })) : [];
            return { ...p, totalAmount, supplierName, items };
        };
    
    // Pedidos de clientes
    const [orders, setOrders] = useState([]);

    // Estado para productos con información completa - COMPLETAMENTE basado en API del backend
    const [purchaseHistory, setPurchaseHistory] = useState([]);

    // Cargar historial de compras desde el backend al iniciar sesión
    const fetchPurchases = async () => {
        try {
            const response = await api.get('/purchases/pending-approval/');
            // Normalizar cada compra para asegurar campos frontend-friendly
            const normalized = Array.isArray(response.data) ? response.data.map(normalizePurchaseFromServer) : [];
            setPurchases(normalized);
        } catch (error) {
            console.error('Error al cargar compras desde el backend:', error);
        }
    };

    const fetchPurchaseHistory = async () => {
        try {
            const response = await api.get('/purchases/history/');
            const normalized = Array.isArray(response.data) ? response.data.map(normalizePurchaseFromServer) : [];
            setPurchaseHistory(normalized);
        } catch (error) {
            console.error('Error al cargar el historial de compras:', error);
        }
    };

    // Cargar historial de compras desde el backend al iniciar sesión
    useEffect(() => {
        if (isLoggedIn) {
            fetchPurchases();
            fetchPurchaseHistory();
        }
    }, [isLoggedIn]);
    // Cargar pedidos desde backend al iniciar sesión (persistencia cross-browser)
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const token = getInMemoryToken();
                if (!token) return;
                const res = await api.get('/orders/');
                if (res && res.data) {
                    // Normalizar items y campos si es necesario
                    const backendOrders = res.data.map(o => ({
                        id: o.id,
                        date: o.date,
                        customerName: o.customer_name || o.customerName || o.customer_name || '',
                        paymentMethod: o.payment_method || o.paymentMethod || '',
                        items: Array.isArray(o.items) ? o.items.map(it => ({
                            productName: it.product_name || it.productName || '',
                            quantity: it.quantity,
                            unitPrice: it.unit_price || it.unitPrice || 0,
                            total: it.total || 0
                        })) : [],
                        totalAmount: o.total_amount || o.totalAmount || 0,
                        status: o.status || 'Pendiente',
                        notes: o.notes || ''
                    }));
                    setOrders(backendOrders);
                }
            } catch (error) {
                console.warn('Error cargando pedidos desde backend:', error && error.message);
            }
        };

        if (isLoggedIn) fetchOrders();
    }, [isLoggedIn]);
    // Intento de refresh silencioso al montar para restablecer sesión si existe la cookie HttpOnly
    useEffect(() => {
        const trySilentRefresh = async () => {
            try {
                console.debug('🔁 Intentando refresh silencioso al montar');
                // Si existía un access token almacenado localmente, limpiarlo antes de intentar
                // restaurar sesión desde la cookie HttpOnly. Esto evita usar un token stale
                // que pueda provocar que la UI muestre pantalla de cajero aun cuando el
                // usuario fue borrado en el backend.
                try {
                    const prev = getInMemoryToken();
                    if (prev) {
                        console.debug('💾 Token previo detectado en storage — limpiando antes del refresh');
                        try { await removeAccessToken(); } catch (e) { console.debug('⚠️ No se pudo eliminar token previo:', e && e.message); }
                        try { clearInMemoryToken(); } catch (e) { /* silent */ }
                    }
                } catch (e) { /* silent */ }

                const resp = await fetch('/api/refresh-cookie/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                if (resp.ok) {
                    const data = await resp.json();
                    // Backend puede devolver { access: null } si el usuario fue borrado/inactivo
                    if (!data || !data.access) {
                        console.debug('🔐 Refresh silencioso: no hay access (usuario ausente o inactivo). Limpiando sesión.');
                        try { await removeAccessToken(); } catch (e) {}
                        try { clearInMemoryToken(); } catch (e) {}
                        try { setIsLoggedIn(false); setCurrentPage('login'); } catch (e) {}
                    } else if (data && data.access) {
                        try { setInMemoryToken(data.access); } catch (e) { /* silent */ }
                        try { await saveAccessToken(data.access); } catch (e) { console.debug('⚠️ No se pudo guardar access tras refresh silencioso:', e && e.message); }
                        setIsLoggedIn(true);
                        try { setCurrentPage('dashboard'); } catch (e) { console.debug('⚠️ No se pudo setear currentPage tras refresh silencioso:', e && e.message); }
                        // Asignar el rol devuelto por el backend si existe
                        if (data.role) {
                            setUserRole(data.role);
                        } else {
                            // Si no viene el rol, usar el anterior o el default
                            try { if (!userRole) setUserRole('Cajero'); } catch (e) { /* silent */ }
                        }
                        // Cargar roles inmediatamente tras restaurar sesión silenciosamente
                        try {
                            await loadRoles();
                            console.debug('✅ Roles cargados tras refresh silencioso');
                        } catch (e) {
                            console.debug('⚠️ No se pudieron cargar roles tras refresh silencioso:', e && e.message);
                        }
                        console.debug('✅ Refresh silencioso OK — sesión restablecida');
                    }
                    // Indicamos que ya fue chequeda la sesión
                    try { setSessionChecked(true); } catch (e) { /* silent */ }
                } else {
                    console.debug('ℹ️ Refresh silencioso no devolvió OK:', resp.status);
                    try { setSessionChecked(true); } catch (e) { /* silent */ }
                }
            } catch (e) {
                console.debug('⚠️ Error en refresh silencioso:', e && e.message);
                // Si el backend no está disponible (proxy error / ECONNRESET), asegurarnos de
                // limpiar token y mostrar la pantalla de login en vez de mantener UI de cajero.
                try {
                    console.warn('❌ Refresh silencioso falló — probablemente el backend no está accesible. Forzando logout temporalmente. Asegúrate de ejecutar `python manage.py runserver` en el backend.');
                } catch (ee) { /* ignore */ }
                try { await removeAccessToken(); } catch (err) { /* silent */ }
                try { clearInMemoryToken(); } catch (e) {}
                try { setIsLoggedIn(false); setCurrentPage('login'); } catch (err) { /* silent */ }
                try { setSessionChecked(true); } catch (e) { /* silent */ }
            }
        };
        trySilentRefresh();
    }, []);

    // Cuando el estado de autenticación cambia a logged in, cargar movimientos de caja y demás datos dependientes
    useEffect(() => {
        if (!isLoggedIn) return;
        (async () => {
            try {
                console.debug('🔔 isLoggedIn=true — cargando movimientos de caja desde backend');
                await loadCashMovements();
                // Cargar roles también cuando la sesión inicia en esta pestaña
                try {
                    await loadRoles();
                    console.debug('✅ Roles cargados tras isLoggedIn=true');
                } catch (e) {
                    console.debug('⚠️ Error cargando roles tras isLoggedIn:', e && e.message);
                }
            } catch (e) {
                console.warn('⚠️ No se pudo cargar movimientos al autenticar:', e && e.message);
                // Si la razón fue que el backend no está accesible, forzar logout para evitar mostrar UI inconsistente
                if (e && (e.message && (e.message.includes('NetworkError') || e.message.includes('Failed to fetch') || e.message.includes('ECONNRESET')))) {
                    try { console.warn('❌ Fallo de red al cargar movimientos — backend inaccesible. Forzando logout.'); } catch (ee) {}
                    try { await removeAccessToken(); } catch (err) {}
                    try { clearInMemoryToken(); } catch (e) {}
                    try { setIsLoggedIn(false); setCurrentPage('login'); } catch (err) {}
                }
            }
        })();
    }, [isLoggedIn]);

    const [products, setProducts] = useState(() => {
        console.log('🎯 Inicializando products - siempre vacío, se carga desde servidor');
        // NUNCA usar localStorage para productos - siempre empezar vacío
        return [];
    });

    // Estado para indicar cuando se están sincronizando productos
    const [isSyncing, setIsSyncing] = useState(false);

    // useEffect para guardar en localStorage (inventory NO se guarda, products SÍ se guarda)
    // useEffect(() => { saveLS(LS_KEYS.inventory, inventory); }, [inventory]); // DESHABILITADO - inventario se regenera desde products
    // useEffect(() => { saveLS(LS_KEYS.cashMovements, cashMovements); }, [cashMovements]); // DESHABILITADO - cashMovements se cargan desde PostgreSQL

    // Cargar proveedores desde el backend al iniciar sesión
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const token = getInMemoryToken();
                if (!token) return;
                const response = await fetch('/api/suppliers/', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Error al cargar proveedores');
                const data = await response.json();
                setSuppliers(data);
            } catch (error) {
                setSuppliers([]);
            }
        };
        if (isLoggedIn) fetchSuppliers();
    }, [isLoggedIn]);
    
    // Función para cargar usuarios desde el backend
    const loadUsersFromBackend = async () => {
        try {
            const response = await api.get('/users/');
            if (response.data) {
                // Transformar datos del backend para compatibilidad local
                const backendUsers = response.data.map(user => ({
                    id: user.id,
                    name: user.username,
                    email: user.email,
                    role: user.role ? user.role.name : 'Cajero', // Extraer nombre del rol
                    is_active: user.is_active,
                    hashedPassword: 'backend-managed' // Password manejado por backend
                }));
                setUsers(backendUsers);
                console.log('✅ Usuarios cargados desde backend:', backendUsers.length);
            }
        } catch (error) {
            console.error('Error cargando usuarios desde backend:', error);
            // Mantener usuarios existentes si hay error
        }
    };
    
    // Cargar usuarios al inicializar la aplicación (solo si hay token)
    useEffect(() => {
        const token = getInMemoryToken();
        if (token && isLoggedIn) {
            loadUsersFromBackend();
        }
    }, [isLoggedIn]);
    // NOTA: Ya no guardamos `orders` en localStorage para evitar inconsistencias
    // useEffect(() => { saveLS(LS_KEYS.orders, orders); }, [orders]);
    // useEffect(() => { saveLS(LS_KEYS.products, products); }, [products]); // DESHABILITADO - products YA NO se guardan automáticamente en localStorage

        // useEffect para sincronización productos -> inventario
        useEffect(() => {
                console.log('🔄 SYNC: Sincronizando inventario desde products');

                // Verificar que products sea un array válido antes de usar map
                if (!Array.isArray(products)) {
                        console.log('⚠️ products no es un array válido, usando array vacío');
                        setInventory([]);
                        return;
                }

                // Reconstruir inventario desde products (actual desde API)
                const newInventory = products.map(product => ({
                    id: product.id,
                    name: product.name,
                    stock: product.stock,
                    type: product.category || 'Producto',
                    price: product.price,      // Ahora sí se incluye el precio
                    estado: product.estado     // Y el estado si viene del backend
                }));

                console.log('🎯 Inventario sincronizado:', newInventory?.length ? `${newInventory.length} productos` : 'Array vacío');

                setInventory(newInventory);
        }, [products]);

    // Función para cerrar la sesión.
    const handleLogout = async () => {
        setIsLoggedIn(false);
        setUserRole(null);
        setCurrentPage('login');
        setEmail('');
        setPassword('');
        setLoginError('');
        setFailedAttempts(0);  // Resetear intentos fallidos
        setIsLocked(false);    // Desbloquear cuenta
        setShowModal(false);   // Cerrar modal
    try { await removeAccessToken(); } catch (e) {}
    try { clearInMemoryToken(); } catch (e) {}
    };

    // Función para manejar la navegación.
    const navigateTo = (page) => {
        setCurrentPage(page);
    };

    // Lógica para el modal de cuenta bloqueada
    const handleModalClose = () => {
        setShowModal(false);
    };
     
    const LockedAccountModal = () => (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>¡Cuenta Bloqueada!</h3>
                <p>Tu cuenta ha sido bloqueada debido a demasiados intentos fallidos.</p>
                <p>Intentos fallidos: {failedAttempts} de {maxAttempts}</p>
                <p>Por favor, contacta al administrador o espera 15 minutos.</p>
                <div className="modal-buttons">
                    <button className="modal-button" onClick={handleModalClose}>Cerrar</button>
                    <button className="modal-button retry-button" onClick={handleRetryLogin}>
                        Reintentar
                    </button>
                </div>
            </div>
        </div>
    );

    // Función para reintentar login
    const handleRetryLogin = () => {
        setFailedAttempts(0);
        setIsLocked(false);
        setShowModal(false);
        setLoginError('');
    };

    const loadInventory = async () => {
      try {
        const response = await api.get('/products/');
        setInventory(response.data);
        try {
            const token = getInMemoryToken();
            if (token) saveLS('inventory', response.data);
        } catch (e) { /* silent */ }
      } catch (error) {
        console.error('Error cargando inventario:', error);
      }
    };

        const loadUsers = async () => {
            try {
                const response = await api.get('/users/');
                if (response.data && Array.isArray(response.data)) {
                    const normalized = response.data.map(u => ({
                        id: u.id,
                        name: u.username ?? u.name ?? (typeof u === 'string' ? u : ''),
                        email: u.email ?? '',
                        role: (u.role && typeof u.role === 'object') ? (u.role.name ?? String(u.role)) : (u.role ?? 'Cajero'),
                        hashedPassword: 'backend-managed'
                    }));
                    setUsers(normalized);
                    try { if (getInMemoryToken()) saveLS('users', normalized); } catch (e) { /* silent */ }
                } else {
                    setUsers(response.data);
                    try { if (getInMemoryToken()) saveLS('users', response.data); } catch (e) { /* silent */ }
                }
            } catch (error) {
                console.error('Error cargando usuarios:', error);
            }
        };

    const loadProducts = async () => {
      try {
        setIsSyncing(true);
        console.log('🔄 Cargando productos del servidor...');
        const response = await api.get('/products/');
        const serverProducts = response.data;
        
        // Convertir productos del servidor al formato local
        const formattedProducts = serverProducts.map(product => ({
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category || 'Producto',
          stock: product.stock,
          description: product.description || '',
          status: 'Sincronizado',
          hasSales: false,
          lowStockThreshold: product.low_stock_threshold || 10
        }));
        
        // Solo actualizar si hay diferencias para evitar re-renders innecesarios
        setProducts(prevProducts => {
          if (JSON.stringify(prevProducts) !== JSON.stringify(formattedProducts)) {
            console.log('✅ Productos actualizados:', `${formattedProducts.length} productos del servidor`);
            return formattedProducts;
          } else {
            console.log('📋 Productos sin cambios - no se actualiza el estado');
            return prevProducts;
          }
        });
      } catch (error) {
        console.log('❌ Error cargando productos del servidor:', error.message);
        
        // Manejo específico para Safari y otros navegadores
        if (error.response) {
          if (error.response.status === 401) {
            console.log('🔒 Error de autenticación - reloguear necesario');
          } else {
            console.log(`🚫 Error del servidor: ${error.response.status}`);
          }
        } else if (error.request) {
          console.log('🌐 Error de conexión con el servidor');
        } else {
          console.log('⚠️ Error de configuración:', error.message);
        }
        
        // Solo actualizar a array vacío si no había productos antes
        setProducts(prevProducts => prevProducts.length > 0 ? prevProducts : []);
      } finally {
        setIsSyncing(false);
      }
    };

    // Función para cargar movimientos de caja desde el backend
        const loadCashMovements = async () => {
            try {
                console.debug('🔎 loadCashMovements invoked');
                if (!getInMemoryToken()) {
                    const restored = await ensureInMemoryToken();
                    if (!restored) {
                        console.warn('loadCashMovements: No se pudo obtener token para autenticación.');
                        return;
                    }
                }

                console.log('💰 Cargando movimientos de caja del servidor...');
                const response = await api.get('/cash-movements/');

                let serverMovements = [];
                if (response.data && Array.isArray(response.data.results)) {
                    serverMovements = response.data.results;
                } else if (Array.isArray(response.data)) {
                    serverMovements = response.data;
                }
        
                console.debug('🔍 Datos recibidos del servidor:', serverMovements.length, 'movimientos');
        
                const formattedMovements = serverMovements.map(movement => ({
                    id: movement.id,
                    type: movement.type,
                    amount: parseFloat(movement.amount), // Asegurar que sea número
                    description: movement.description || '',
                    date: movement.timestamp || movement.created_at || new Date().toISOString(),
                    user: movement.user || 'Sistema',
                    payment_method: movement.payment_method || ''
                }));
        
                console.debug('📋 Primeros 3 movimientos formateados:', formattedMovements.slice(0, 3));
        
                setCashMovements(formattedMovements);
                console.debug('✅ Movimientos de caja cargados:', `${formattedMovements.length} movimientos del servidor`);
            } catch (error) {
                console.error('❌ Error cargando movimientos de caja:', error && error.message ? error.message : error);
                setCashMovements(prevMovements => prevMovements.length > 0 ? prevMovements : []);
            }
        };

    // Función para cargar ventas desde el backend
    const loadSales = async () => {
      try {
                // Cargando ventas desde backend
                // Si no hay token en memoria, intentar restaurarlo desde la cookie HttpOnly
                if (!getInMemoryToken()) {
                        console.debug('loadSales: no hay token en memoria — intentando ensureInMemoryToken');
                        const restored = await ensureInMemoryToken();
                        if (restored) {
                            try { setIsLoggedIn(true); } catch (e) { /* silent */ }
                        }
                }
        const response = await api.get('/sales/');
                // Manejar respuesta paginada de DRF: { count, next, previous, results: [...] }
                let serverSales = [];
                if (Array.isArray(response.data)) {
                    serverSales = response.data;
                } else if (response.data && Array.isArray(response.data.results)) {
                    serverSales = response.data.results;
                } else if (response.data && typeof response.data === 'object' && response.data !== null) {
                    // A veces la API puede devolver un objeto con key 'data' o 'sales'
                    if (Array.isArray(response.data.data)) serverSales = response.data.data;
                    else if (Array.isArray(response.data.sales)) serverSales = response.data.sales;
                }

                // Guardar ventas completas en el estado para consultas y para marcar productos con ventas
                                                                setSales(serverSales);
                                                                return serverSales;
      } catch (error) {
                console.error('❌ Error cargando ventas:', error?.message || error);
                return Array.isArray(sales) ? sales : [];
      }
    };

    // Función para cargar cambios de inventario desde el backend
    const loadInventoryChanges = async () => {
      try {
        console.log('📦 Cargando cambios de inventario del servidor...');
        const response = await api.get('/inventory-changes/');
        const serverChanges = response.data;
        
        console.log('✅ Cambios de inventario cargados:', `${serverChanges.length} cambios del servidor`);
        console.log('📋 Cambios:', serverChanges);
      } catch (error) {
        console.log('❌ Error cargando cambios de inventario:', error.message);
      }
    };

    // Componente de la interfaz de inicio de sesión.
    const Login = () => {
      const [emailInput, setEmailInput] = useState('');
      const [passwordInput, setPasswordInput] = useState('');

      const onSubmit = (e) => {
        e.preventDefault();
        handleLogin(e, { email: emailInput, password: passwordInput });
      };

      return (
        <div className="login-container">
          <h1>Iniciar Sesión</h1>
          
          <form onSubmit={onSubmit}>
            <div className="input-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                type="email"
                id="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ejemplo@email.com"
                required
                autoComplete="email"
                disabled={isLocked}
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={isLocked}
              />
            </div>
            
            {/* Mostrar mensaje de error */}
            <p className={loginError ? 'error-message' : 'error-message hidden'}>
              {loginError}
            </p>
            
            {/* Mostrar contador de intentos */}
            {failedAttempts > 0 && !isLocked && (
              <p className="attempts-message">
                Intentos fallidos: {failedAttempts} de {maxAttempts}
              </p>
            )}
            
            {/* Mostrar mensaje de bloqueo */}
            {isLocked && (
              <p className="lock-message">
                Tu cuenta ha sido bloqueada. Contacta al administrador.
              </p>
            )}
            
            {/* Formulario de login - sin funciones de test en producción */}
            <button 
              type="submit" 
              className="login-button" 
              disabled={isLocked}
            >
              {isLocked ? 'Cuenta Bloqueada' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      );
    };

    // Componente de la interfaz de navegación superior.
    const Navbar = () => {
        const itemsToShow = rolePermissions[userRole] || [];

        return (
            <nav className="navbar">
                <div className="user-info">
                    <span>Rol: {userRole}</span>
                    <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
                </div>
                <ul className="nav-list">
                    {itemsToShow.map(item => (
                        <li key={item}>
                            <button onClick={() => navigateTo(item.toLowerCase())} className={`nav-button ${currentPage === item.toLowerCase() ? 'active' : ''}`}>
                                {item}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        );
    };

    const ClientOrders = () => (
        <div className="management-container">
            <h2>Pedidos de Clientes</h2>
            {orders.length === 0 ? (
                <p>No hay pedidos para mostrar.</p>
            ) : (
                <ul className="list-container">
                    {orders.map(order => (
                        <li key={order.id} className="list-item">
                            <div className="order-header">
                                <strong>ID: {order.id}</strong>
                                <span>Cliente: {order.customerName}</span>
                                <span>Fecha: {new Date(order.date).toLocaleDateString()}</span>
                            </div>
                            <div className="order-details">
                                <p><strong>Estado:</strong> {order.status}</p>
                                <p><strong>Total:</strong> ${safeToFixed(order.totalAmount)}</p>
                            </div>
                            <div className="order-items">
                                <strong>Items:</strong>
                                <ul>
                                    {order.items.map((item, index) => (
                                        <li key={index}>
                                            {item.productName} (x{item.quantity}) - ${safeToFixed(item.total)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {order.notes && <div className="order-notes"><strong>Notas:</strong> {order.notes}</div>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    // Componente del tablero (Dashboard).
    const Dashboard = () => {
        // Obtener productos e insumos con stock bajo según su umbral personalizado
        const lowStockItems = products.filter(product => 
            product.stock < (product.lowStockThreshold || 10)
        );

        // Separar productos e insumos para mejor organización
        const lowStockProducts = lowStockItems.filter(item => item.category === 'Producto');
        const lowStockSupplies = lowStockItems.filter(item => item.category === 'Insumo');

        return (
            <div className="dashboard-container">
                <h2>Dashboard de {userRole}</h2>
                {['Gerente', 'Encargado', 'Panadero', 'Cajero'].includes(userRole) && (
                    lowStockItems.length > 0 && (
                        <div className="dashboard-alerts">
                            <h3>⚠️ Alerta de Stock Bajo</h3>
                            
                            {lowStockProducts.length > 0 && (
                                <div className="alert-section">
                                    <h4>📦 Productos con Stock Bajo:</h4>
                                    <ul className="alert-list">
                                        {lowStockProducts.map(item => (
                                            <li key={item.id} className="alert-item">
                                                <strong>{item.name}</strong>: ¡Solo quedan {item.stock} unidades! (Umbral: {item.lowStockThreshold || 10})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            
                            {lowStockSupplies.length > 0 && (
                                <div className="alert-section">
                                    <h4>🧾 Insumos con Stock Bajo:</h4>
                                    <ul className="alert-list">
                                        {lowStockSupplies.map(item => (
                                            <li key={item.id} className="alert-item">
                                                <strong>{item.name}</strong>: ¡Solo quedan {item.stock} unidades! (Umbral: {item.lowStockThreshold || 10})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )
                )}
                
                <div className="info-section">
                    <h3>Información General</h3>
                    <p>Bienvenido al sistema de gestión de churrería. Utiliza el menú superior para navegar por las diferentes funcionalidades.</p>
                </div>
            </div>
        );
    };

    // Componente de la interfaz de gestión de usuarios (solo para Gerente).
    const UserManagement = () => {
        const [showAddUser, setShowAddUser] = useState(false);
        const [editingUser, setEditingUser] = useState(null); // Usuario en edición
        const [newPassword, setNewPassword] = useState(''); // Nuevo estado para la contraseña
        const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Cajero', password: '' });
        const [message, setMessage] = useState('');

        const handleAddUser = async (e) => {
            e.preventDefault();
            if (!newUser.name || !newUser.email || !newUser.password) {
                setMessage('Error: Todos los campos son obligatorios.');
                return;
            }
            const passwordError = validatePassword(newUser.password);
            if (passwordError) {
                setMessage(`Error de contraseña: ${passwordError}`);
                return;
            }
            const userExists = users.some(u => u.email === newUser.email);
            if (userExists) {
                setMessage('Error: El email ya está registrado.');
                return;
            }
            try {
                await api.post('/users/', { 
                    username: newUser.name,
                    email: newUser.email,
                    password: newUser.password,
                    role: newUser.role 
                });
                await loadUsersFromBackend();
                setNewUser({ name: '', email: '', role: 'Cajero', password: '' });
                setShowAddUser(false);
                setMessage('✅ Usuario creado exitosamente.');
            } catch (error) {
                setMessage(error.response?.data?.email?.[0] || 'Error: No se pudo crear el usuario.');
            }
        };

        const handleUpdateUser = async (e) => {
            e.preventDefault();
            if (!editingUser) return;

            // Validar contraseña si se ha ingresado una nueva
            if (newPassword && validatePassword(newPassword)) {
                setMessage(`Error de contraseña: ${validatePassword(newPassword)}`);
                return;
            }

            try {
                const payload = {
                    username: editingUser.name,
                    email: editingUser.email,
                    // Enviar role_id si es posible (el serializer espera role_id para update)
                    // Buscamos el id del rol seleccionado en `roles` (roles puede ser array de objetos o strings)
                    // Si no encontramos id, como fallback enviamos el nombre en `role_name` para compatibilidad.
                };

                // Añadir contraseña al payload solo si se ha ingresado una nueva
                if (newPassword) {
                    payload.password = newPassword;
                }

                // Resolver role -> role_id
                try {
                    const roleObj = (roles || []).find(r => (typeof r === 'string' ? r === editingUser.role : (r.name === editingUser.role)));
                    if (roleObj) {
                        // Si roleObj es string no tiene id; si es objeto, usar id
                        if (typeof roleObj === 'object' && roleObj.id) {
                            payload.role_id = roleObj.id;
                        } else if (typeof roleObj === 'string') {
                            // fallback: enviar role_name para que el backend lo maneje si lo soporta
                            payload.role_name = roleObj;
                        }
                    } else if (editingUser.role) {
                        // No encontramos el rol en la lista; enviar role_name como fallback
                        payload.role_name = editingUser.role;
                    }

                    await api.patch(`/users/${editingUser.id}/`, payload);
                } catch (err) {
                    console.error('Error resolviendo role_id antes de actualizar usuario:', err);
                    await api.patch(`/users/${editingUser.id}/`, payload);
                }
                await loadUsersFromBackend();
                setEditingUser(null);
                setNewPassword(''); // Limpiar el campo de contraseña
                setMessage('✅ Datos del usuario actualizados.');
            } catch (error) {
                setMessage('Error: No se pudo actualizar el usuario.');
                console.error("Update user error:", error.response?.data || error.message);
            }
        };

        const handleDeleteUser = async (userId) => {
            const userToDelete = users.find(u => u.id === userId);
            if (!userToDelete || (userToDelete.role === 'Gerente') || !window.confirm(`¿Seguro que quieres eliminar a ${userToDelete.name}?`)) return;
            try {
                await api.delete(`/users/${userId}/`);
                await loadUsersFromBackend();
                setMessage('✅ Usuario eliminado.');
            } catch (error) {
                setMessage('Error eliminando usuario.');
            }
        };

        const startEditing = (user) => {
            setEditingUser({ ...user });
            setNewPassword('');
            setShowAddUser(false);
        };

        const editUserForm = () => (
            <form className="form-container" onSubmit={handleUpdateUser}>
                <h3>Editando a {editingUser.name}</h3>
                <input type="text" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} placeholder="Nombre Completo" required />
                <input type="email" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} placeholder="Email" required />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva Contraseña (dejar en blanco para no cambiar)" />
                <select
                    value={editingUser.role || ''}
                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                    <option value="" disabled>Seleccionar rol...</option>
                    {(() => {
                        const parsed = (roles || []).map(r => (typeof r === 'string' ? r : (r.name || r)));
                        if (editingUser && editingUser.role && !parsed.includes(editingUser.role)) {
                            parsed.unshift(editingUser.role);
                        }
                        return parsed.map(name => <option key={name} value={name}>{name}</option>);
                    })()}
                </select>
                <div className="button-group">
                    <button type="submit" className="action-button primary">Actualizar Datos</button>
                    <button type="button" className="action-button secondary" onClick={() => { setEditingUser(null); setNewPassword(''); }}>Cancelar</button>
                </div>
            </form>
        );

        const addUserForm = () => (
            <form className="form-container" onSubmit={handleAddUser}>
                <h3>Registrar Usuario</h3>
                <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nombre Completo" required />
                <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" required />
                <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Contraseña" required />
                <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                    {(() => {
                        const parsed = (roles || []).map(r => (typeof r === 'string' ? r : (r.name || r)));
                        return parsed.filter(n => n !== 'Gerente').map(name => (
                            <option key={name} value={name}>{name}</option>
                        ));
                    })()}
                </select>
                <div className="button-group">
                    <button type="submit" className="action-button primary">Crear Usuario</button>
                    <button type="button" className="action-button secondary" onClick={() => setShowAddUser(false)}>Cancelar</button>
                </div>
            </form>
        );

        return (
            <div className="management-container">
                <h2>Gestión de Usuarios</h2>
                {message && <p className="message">{message}</p>}
                {editingUser ? editUserForm() : (showAddUser ? addUserForm() : <button className="main-button" onClick={() => setShowAddUser(true)}>Registrar Nuevo Usuario</button>)}
                <h3>Usuarios Existentes ({users.length})</h3>
                <ul className="list-container">
                    {users.map(user => (
                        <li key={user.id} className="list-item">
                            <div className="user-info-container">
                                <div><strong>{user.name}</strong> ({user.role})</div>
                                <div className="user-email">{user.email}</div>
                            </div>
                            <div className="button-group">
                                <button onClick={() => startEditing(user)} className="edit-button">Editar</button>
                                <button onClick={() => handleDeleteUser(user.id)} className="delete-button">Eliminar</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Componente de la interfaz de consulta y registro de inventario.
    // Usa react-select para búsqueda y un modal de confirmación para salidas excepcionales.
    const InventoryView = () => {
        const [showChangeForm, setShowChangeForm] = useState(false);
        // productId en vez de nombre, quantity como string hasta validar, reason texto
        const [change, setChange] = useState({ productId: '', quantity: '', reason: '' });
        const [confirmOpen, setConfirmOpen] = useState(false);

        const handleRegisterChange = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            // Validaciones previas: producto seleccionado y cantidad válida
            const qty = parseInt(change.quantity, 10);
            if (!change.productId) {
                alert('Debes seleccionar un producto.');
                return;
            }
            if (isNaN(qty) || qty <= 0) {
                alert('La cantidad debe ser un número positivo (ej: 3). El sistema lo tomará como una salida excepcional.');
                return;
            }

            // Abrir modal de confirmación en vez de enviar directamente
            setConfirmOpen(true);
        };

        const doRegisterChange = async () => {
            // Ejecutar la acción tras confirmación
            const product = inventory.find(p => p.id === change.productId || String(p.id) === String(change.productId));
            // Tomar cantidad como valor absoluto (si el usuario escribió -3 o 3)
            const quantity = Math.abs(parseInt(change.quantity, 10));
            const reason = change.reason;
            if (!product) {
                alert('Producto no encontrado.');
                setConfirmOpen(false);
                return;
            }

            if (isNaN(quantity) || quantity <= 0) {
                alert('La cantidad debe ser un número mayor a cero.');
                setConfirmOpen(false);
                return;
            }

            if (quantity > product.stock) {
                alert('No hay suficiente stock para esta salida.');
                setConfirmOpen(false);
                return;
            }

            const payload = {
                type: 'Salida',
                product: product.id,
                quantity: quantity,
                reason,
            };

            try {
                await api.post('/inventory-changes/', payload);
                // Recargar productos desde backend para mantener sincronización con PostgreSQL
                await loadProducts();

                setChange({ productId: '', quantity: '', reason: '' });
                setShowChangeForm(false);
                setConfirmOpen(false);
                console.log('✅ Cambio de inventario registrado y datos recargados desde PostgreSQL');
            } catch (err) {
                console.error('Error registrando cambio de inventario:', err);
                alert('No se pudo registrar el cambio de inventario.');
                setConfirmOpen(false);
            }
        };

        return (
            <div className="inventory-container">
                <h2>Inventario</h2>
                <h3>Consultar Inventario</h3>
                
                <div className="inventory-categories">
                    <h4>Productos</h4>
                    <ul className="list-container">
                        {inventory
                            .filter(item => item.type === 'Producto')
                            .map(item => {
                                return (
                                    <li key={item.id} className="list-item">
                                        <span className="inventory-name">{item.name}</span>
                                        <span className="inventory-stock">{item.stock} unidades</span>
                                    </li>
                                );
                            })}
                    </ul>
                    
                    <h4>Insumos</h4>
                    <ul className="list-container">
                        {inventory
                            .filter(item => item.type === 'Insumo')
                            .map(item => {
                                return (
                                    <li key={item.id} className="list-item">
                                        <span className="inventory-name">{item.name}</span>
                                        <span className="inventory-stock">{item.stock} kilogramos</span>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
                <hr />
                {userRole === 'Gerente' && (
                    <div className="inventory-change-section">
                        <h3>Registrar Cambios en el Inventario</h3>
                        {!showChangeForm ? (
                            <button className="main-button" onClick={() => setShowChangeForm(true)}>Registrar Salida (Excepcional)</button>
                        ) : (
                            <>
                            <form className="form-container" onSubmit={handleRegisterChange}>
                                {/* select buscable local (sustituye react-select) */}
                                {/* Selector con búsqueda usando react-select */}
                                <Select
                                    className="searchable-select"
                                    classNamePrefix="searchable"
                                    isClearable
                                    placeholder="Buscar producto/insumo..."
                                    // map inventory a opciones con value como string para consistencia
                                    options={inventory.map(it => ({ value: String(it.id), label: `${it.name} — Stock: ${it.stock}` }))}
                                    // value debe ser la opción completa o null
                                    value={(() => {
                                        const val = change.productId || '';
                                        if (!val) return null;
                                        return inventory
                                            .map(it => ({ value: String(it.id), label: `${it.name} — Stock: ${it.stock}` }))
                                            .find(opt => opt.value === String(val)) || null;
                                    })()}
                                    onChange={(selected) => setChange({ ...change, productId: selected ? selected.value : '' })}
                                />
                                <input type="number" value={change.quantity} onChange={e => setChange({ ...change, quantity: e.target.value })} placeholder="Cantidad (ej: 3) - será tomada como salida" required />
                                <input type="text" value={change.reason} onChange={e => setChange({ ...change, reason: e.target.value })} placeholder="Motivo (ej: Desperdicio, Contaminación)" required />
                                <div className="button-group">
                                    <button type="submit" className="action-button primary" disabled={!change.productId || isNaN(parseInt(change.quantity, 10)) || parseInt(change.quantity, 10) <= 0}>Guardar Salida</button>
                                    <button type="button" className="action-button secondary" onClick={() => { setShowChangeForm(false); setChange({ productId: '', quantity: '', reason: '' }); }}>Cancelar</button>
                                </div>
                            </form>
                            {/* Confirm modal */}
                            {confirmOpen && (
                                <div className="modal-overlay">
                                    <div className="modal-content">
                                        <h3>Confirmar salida excepcional</h3>
                                        <p>
                                            ¿Confirmás aplicar la salida de <strong>-{Math.abs(change.quantity || 0)}</strong> del producto <strong>{(inventory.find(it => String(it.id) === String(change.productId)) || {}).name || '---'}</strong>?
                                        </p>
                                        <div className="modal-actions">
                                            <button className="action-button primary" onClick={doRegisterChange}>Confirmar</button>
                                            <button className="action-button secondary" onClick={() => setConfirmOpen(false)}>Cancelar</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const SalesView = () => {
        const [cartItems, setCartItems] = useState([]);
        const [total, setTotal] = useState(0);
        const [showMovementForm, setShowMovementForm] = useState(false);
        const [newMovement, setNewMovement] = useState({ type: 'Entrada', amount: '', description: '' });
        const [message, setMessage] = useState('');
        const [activeTab, setActiveTab] = useState('ventas'); // 'ventas' o 'caja'
        const [selectedProduct, setSelectedProduct] = useState(null);
        const [quantity, setQuantity] = useState(1);
        const [paymentMethod, setPaymentMethod] = useState('');

        const availableProducts = products.filter(product => 
            product.category === 'Producto' && product.stock > 0
        );

        const productOptions = availableProducts.map(p => ({ value: p.id, label: `${p.name} (${p.price}) - Stock: ${p.stock}` }));

        const addToCart = () => {
            if (!selectedProduct) {
                setMessage('Por favor, selecciona un producto.');
                return;
            }

            const productToAdd = products.find(p => p.id === selectedProduct.value);
            if (!productToAdd) {
                setMessage('Producto no encontrado.');
                return;
            }

            if (quantity > productToAdd.stock) {
                setMessage('No hay suficiente stock para la cantidad solicitada.');
                return;
            }

            setCartItems(prevItems => {
                const existingItem = prevItems.find(item => item.product.id === productToAdd.id);
                if (existingItem) {
                    const newQuantity = existingItem.quantity + quantity;
                    if (newQuantity > productToAdd.stock) {
                        setMessage('La cantidad total en el carrito supera el stock disponible.');
                        return prevItems;
                    }
                    return prevItems.map(item =>
                        item.product.id === productToAdd.id
                            ? { ...item, quantity: newQuantity }
                            : item
                    );
                } else {
                    return [...prevItems, { product: productToAdd, quantity: quantity }];
                }
            });
            setSelectedProduct(null);
            setQuantity(1);
        };

        const updateQuantity = (productId, newQuantity) => {
            const product = products.find(p => p.id === productId);
            if (newQuantity > product.stock) {
                setMessage(`No puedes vender más de ${product.stock} unidades de ${product.name}.`);
                return;
            }

            setCartItems(prevItems =>
                prevItems.map(item =>
                    item.product.id === productId
                        ? { ...item, quantity: newQuantity }
                        : item
                )
            );
        };

        const removeFromCart = (productId) => {
            setCartItems(prevItems => prevItems.filter(item => item.product.id !== productId));
        };

        useEffect(() => {
            const newTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
            setTotal(newTotal);
        }, [cartItems]);

        const handleRegisterSale = async () => {
            if (cartItems.length === 0) {
                setMessage('El carrito está vacío.');
                return;
            }

            if (!paymentMethod) {
                setMessage('Por favor, selecciona un método de pago.');
                return;
            }

            const description = `Venta: ${cartItems.map(item => `${item.product.name} x${item.quantity}`).join(', ')}`;

            const saleItems = cartItems.map(item => ({
                product_id: item.product.id,
                product_name: item.product.name,
                quantity: item.quantity,
                price: item.product.price
            }));

            try {
                await api.post('/sales/', {
                    total_amount: total,
                    payment_method: paymentMethod,
                    items: saleItems
                });
                await api.post('/cash-movements/', {
                    type: 'Entrada',
                    amount: total,
                    description,
                    payment_method: paymentMethod
                });
                
                await loadProducts();
                await loadCashMovements();
                
                setCartItems([]);
                setMessage('✅ Venta registrada con éxito, stock actualizado y entrada de caja registrada.');
            } catch (err) {
                console.error('Error registrando venta:', err);
                setMessage('❌ No se pudo registrar la venta en el servidor.');
            }
        };

        const handleRegisterMovement = async (e) => {
            e.preventDefault();
            const amount = parseFloat(newMovement.amount);
            const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

            if (newMovement.type === 'Salida' && amount > currentBalance) {
                setMessage(' Saldo insuficiente para registrar esta salida.');
                return;
            }

            const payload = {
                type: newMovement.type,
                amount,
                description: newMovement.description,
            };

            try {
                await api.post('/cash-movements/', payload);
                
                await loadCashMovements();
                
                setNewMovement({ type: 'Entrada', amount: '', description: '' });
                setShowMovementForm(false);
                setMessage('✅ Movimiento registrado exitosamente.');
            } catch (err) {
                console.error('Error registrando movimiento de caja:', err);
                setMessage('❌ No se pudo registrar el movimiento de caja.');
            }
        };
        
        const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

        return (
            <div className="sales-container">
                <h2>Registrar Venta</h2>
                
                <div className="tab-navigation">
                    <button 
                        className={`tab-button ${activeTab === 'ventas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ventas')}
                    >
                        Registrar Venta
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'caja' ? 'active' : ''}`}
                        onClick={() => setActiveTab('caja')}
                    >
                        Movimientos de Caja
                    </button>
                </div>

                {message && <p className="message">{message}</p>}

                {activeTab === 'ventas' && (
                    <div className="tab-content">
                        <div className="product-selection">
                            <h3>Selecciona Productos</h3>
                            <Select
                                options={productOptions}
                                value={selectedProduct}
                                onChange={setSelectedProduct}
                                placeholder="Buscar producto..."
                                isClearable
                                className="searchable-select"
                            />
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                                min="1"
                            />
                            <button onClick={addToCart} className="action-button primary">Agregar al Carrito</button>
                        </div>
                        <div className="cart-summary">
                            <h3>Resumen de Venta</h3>
                            <ul className="list-container">
                                {cartItems.map(item => (
                                    <li key={item.product.id} className="list-item">
                                        <span>{item.product.name}</span>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value, 10))}
                                            min="1"
                                        />
                                        <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                                        <button onClick={() => removeFromCart(item.product.id)} className="delete-button">Quitar</button>
                                    </li>
                                ))}
                            </ul>
                            <div className="form-group">
                                <label>Método de Pago:</label>
                                <select 
                                    value={paymentMethod} 
                                    onChange={e => setPaymentMethod(e.target.value)} 
                                    required
                                >
                                    <option value="">Seleccionar método de pago</option>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="debito">Débito</option>
                                    <option value="credito">Crédito</option>
                                    <option value="transferencia">Transferencia</option>
                                </select>
                            </div>
                            <div className="total-display">
                                <strong>Total: ${total.toFixed(2)}</strong>
                            </div>
                            <button className="checkout-button" onClick={handleRegisterSale} disabled={cartItems.length === 0}>
                                Confirmar Venta
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'caja' && (
                    <div className="tab-content">
                        <div className="balance-display">
                            <h3>Saldo Actual de Caja</h3>
                            <div className={`balance-amount ${currentBalance >= 0 ? 'positive' : 'negative'}`}>
                                ${safeToFixed(currentBalance)}
                            </div>
                        </div>
                        
                        {!showMovementForm ? (
                            <button className="main-button" onClick={() => setShowMovementForm(true)}>
                                Registrar Nuevo Movimiento
                            </button>
                        ) : (
                            <form className="form-container" onSubmit={handleRegisterMovement}>
                                <h3>Nuevo Movimiento</h3>
                                <select value={newMovement.type} onChange={e => setNewMovement({ ...newMovement, type: e.target.value })} required>
                                    <option value="Entrada">Entrada</option>
                                    <option value="Salida">Salida</option>
                                </select>
                                <input type="number" value={newMovement.amount} onChange={e => setNewMovement({ ...newMovement, amount: e.target.value })} placeholder="Monto" required />
                                <textarea value={newMovement.description} onChange={e => setNewMovement({ ...newMovement, description: e.target.value })} placeholder="Descripción (ej: Gasto de limpieza)" required />
                                <div className="button-group">
                                    <button type="submit" className="action-button primary">Registrar</button>
                                    <button type="button" className="action-button secondary" onClick={() => setShowMovementForm(false)}>Cancelar</button>
                                </div>
                            </form>
                        )}
                        
                        <h3>Historial de Movimientos</h3>
                        <ul className="list-container">
                            {cashMovements.map(movement => (
                                <li key={movement.id} className="list-item">
                                    <span>{movement.date} - {movement.description} {movement.payment_method && `(${movement.payment_method})`}</span>
                                    <span className={movement.type === 'Entrada' ? 'positive' : 'negative'}>
                                        {movement.type === 'Entrada' ? '+' : '-'} ${movement.amount}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    // Componente de la interfaz de registro de movimientos de caja.
    const CashMovementView = () => {
        const [showMovementForm, setShowMovementForm] = useState(false);
        const [newMovement, setNewMovement] = useState({ type: 'Entrada', amount: '', description: '' });
        const [message, setMessage] = useState('');

        const handleRegisterMovement = async (e) => {
            e.preventDefault();
            const amount = parseFloat(newMovement.amount);
            // Simulación de saldo de caja.
            const currentBalance = cashMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : -m.amount), 0);

            // Regla de negocio: Si es una salida, validar saldo.
            if (newMovement.type === 'Salida' && amount > currentBalance) {
                setMessage(' Saldo insuficiente para registrar esta salida.');
                return;
            }

            const payload = {
                type: newMovement.type,
                amount,
                description: newMovement.description,
            };

            try {
                await api.post('/cash-movements/', payload);
                // Recargar movimientos desde el servidor para evitar inconsistencias/duplicados
                await loadCashMovements();
                setNewMovement({ type: 'Entrada', amount: '', description: '' });
                setShowMovementForm(false);
                setMessage('✅ Movimiento registrado exitosamente.');
            } catch (err) {
                console.error('Error registrando movimiento de caja:', err);
                setMessage('No se pudo registrar el movimiento.');
            }
        };

        return (
            <div className="cash-container">
                <h2>Registro de Caja</h2>
                {message && <p className="message">{message}</p>}
                {!showMovementForm ? (
                    <button className="main-button" onClick={() => setShowMovementForm(true)}>Registrar Nuevo Movimiento</button>
                ) : (
                    <form className="form-container" onSubmit={handleRegisterMovement}>
                        <h3>Nuevo Movimiento</h3>
                        <select value={newMovement.type} onChange={e => setNewMovement({ ...newMovement, type: e.target.value })} required>
                            <option value="Entrada">Entrada</option>
                            <option value="Salida">Salida</option>
                        </select>
                        <input type="number" value={newMovement.amount} onChange={e => setNewMovement({ ...newMovement, amount: e.target.value })} placeholder="Monto" required />
                        <textarea value={newMovement.description} onChange={e => setNewMovement({ ...newMovement, description: e.target.value })} placeholder="Descripción (ej: Gasto de limpieza)" required />
                        <div className="button-group">
                            <button type="submit" className="action-button primary">Registrar</button>
                            <button type="button" className="action-button secondary" onClick={() => setShowMovementForm(false)}>Cancelar</button>
                        </div>
                    </form>
                )}
                <h3>Historial de Movimientos</h3>
                <ul className="list-container">
                    {cashMovements.map(movement => (
                        <li key={movement.id} className="list-item">
                            <span>{movement.date} - {movement.description}</span>
                            <span className={movement.type === 'Entrada' ? 'positive' : 'negative'}>
                                {movement.type === 'Entrada' ? '+' : '-'} ${movement.amount}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    // Componente de la interfaz de creación de nuevos productos.
        // Componente de la interfaz de creación de nuevos productos.
        const ProductCreationView = () => {
            const [newProduct, setNewProduct] = useState({ 
                name: '', 
                description: '', 
                price: 0, 
                stock: 0, 
                low_stock_threshold: 10,
                category: 'Producto' // Añadimos la categoría por defecto
            });
            const [message, setMessage] = useState('');
    
            const handleCreateProduct = async (e) => {
                e.preventDefault();
                
                // Validaciones
                if (!newProduct.name.trim()) {
                    setMessage('🚫 Error: El nombre del producto es obligatorio.');
                    return;
                }
                
                if (newProduct.price <= 0) {
                    setMessage('🚫 Error: El precio debe ser mayor a 0.');
                    return;
                }
                
                if (newProduct.stock < 0) {
                    setMessage(' Error: El stock no puede ser negativo.');
                    return;
                }
                
                if (newProduct.low_stock_threshold < 0) {
                    setMessage('🚫 Error: El umbral de stock bajo no puede ser negativo.');
                    return;
                }
    
                // Validar si el producto ya existe completamente (en inventario Y productos)
                const productExistsInInventory = inventory.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase());
                const productExistsInProducts = products.some(p => p.name.toLowerCase() === newProduct.name.trim().toLowerCase());
                
                if (productExistsInInventory && productExistsInProducts) {
                    setMessage('⚠️ Error: El producto ya existe completamente en el sistema.');
                    return;
                }
    
                try {
                    // Verificación específica para Safari antes de crear el producto
                    const token = getInMemoryToken();
                    if (!token) {
                        setMessage('🚫 Error: No hay token de autenticación. Por favor, vuelve a iniciar sesión.');
                        return;
                    }
                    
                    // Verificar formato del token JWT
                    try {
                        const parts = token.split('.');
                        if (parts.length !== 3) {
                            setMessage('🚫 Error: Token de autenticación inválido. Por favor, vuelve a iniciar sesión.');
                            return;
                        }
                    } catch (tokenError) {
                        setMessage('🚫 Error: Token de autenticación malformado. Por favor, vuelve a iniciar sesión.');
                        return;
                    }
                    
                    
                    // Crear producto en el backend
                    const response = await api.post('/products/', {
                        name: newProduct.name.trim(),
                        description: newProduct.description.trim(),
                        price: parseFloat(newProduct.price),
                        stock: parseInt(newProduct.stock),
                        low_stock_threshold: parseInt(newProduct.low_stock_threshold),
                        category: newProduct.category
                    });

                    // Recargar productos desde PostgreSQL para mantener sincronización
                    await loadProducts();

                    // Limpiar formulario
                    setNewProduct({ 
                        name: '', 
                        description: '', 
                        price: 0, 
                        stock: 0, 
                        low_stock_threshold: 10,
                        category: 'Producto'
                    });
                    setMessage('✅ Producto creado exitosamente y datos recargados desde PostgreSQL.');
                    console.log('🔄 Productos recargados desde PostgreSQL después de crear producto');
                } catch (error) {
                    console.log('❌ Error creando producto:', error);
                    
                    // Manejo específico de errores para Safari
                    if (error.response) {
                        // Error con respuesta del servidor
                        if (error.response.status === 400) {
                            setMessage('🚫 Error: ' + (error.response.data.detail || 'Datos inválidos.'));
                        } else if (error.response.status === 401) {
                            setMessage('🚫 Error: No tienes autorización. Inicia sesión nuevamente.');
                        } else if (error.response.status === 403) {
                            setMessage('🚫 Error: No tienes permisos para realizar esta acción.');
                        } else {
                            setMessage(`🚫 Error del servidor: ${error.response.status}`);
                        }
                    } else if (error.request) {
                        // Error de red o CORS
                        setMessage('🚫 Error: No se pudo conectar con el servidor. Verifica tu conexión.');
                    } else {
                        // Error de configuración
                        setMessage('🚫 Error: ' + (error.message || 'Error desconocido al crear el producto.'));
                    }
                }
            };
    
            return (
                <div className="creation-container">
                    <div style={{marginBottom: '10px'}}>
                        <h2>Crear Productos Nuevos</h2>
                    </div>
                    {message && <p className="message">{message}</p>}
                    <p>Crea nuevos productos e insumos. Los productos creados aparecerán automáticamente en la sección "Inventario" y "Editar Productos".</p>
                    
                    <h3>Agregar nuevo producto</h3>
                    <form className="form-container" onSubmit={handleCreateProduct}>
                        <input 
                            type="text" 
                            value={newProduct.name} 
                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
                            placeholder="Nombre del Producto *" 
                            required 
                        />
                        <textarea 
                            value={newProduct.description} 
                            onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} 
                            placeholder="Descripción del producto (opcional)"
                            rows="3"
                        />
                        <p>Categoría</p>
                        <select
                            value={newProduct.category}
                            onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                            required
                        >
                            <option value="Producto">Producto</option>
                            <option value="Insumo">Insumo</option>
                        </select>
                        <p>Precio</p>
                        <input 
                            type="number" 
                            value={newProduct.price} 
                            onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })} 
                            placeholder="Precio *" 
                           min="0"
                            //step="0.01"
                            required 
                        />
                        <p>Stock Inicial</p>
                        <input 
                            type="number" 
                            value={newProduct.stock} 
                            onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })} 
                            placeholder="Stock Inicial *" 
                            min="0"
                            required 
                        />
                        <p>Umbral de stock</p>
                        <input 
                            type="number" 
                            value={newProduct.low_stock_threshold} 
                            onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: parseInt(e.target.value) || 10 })} 
                            placeholder="Umbral de Stock Bajo (por defecto: 10)" 
                            min="0"
                        />
                        <button type="submit" className="main-button">Crear Producto</button>
                    </form>
                </div>
            );
        };

        

        // Componente de la interfaz de gestión de proveedores (solo para Gerente).
        const SupplierManagement = () => {
            const [showAddSupplier, setShowAddSupplier] = useState(false);
            const [editingSupplier, setEditingSupplier] = useState(null); // Nuevo estado para edición
            const [newSupplier, setNewSupplier] = useState({ 
                name: '', 
                cuit: '', 
                address: '', 
                phone: '', 
                products: '' 
            });
            const [message, setMessage] = useState('');
    
            const validateCUIT = (cuit) => /^\d{11}$/.test(cuit);
            const validatePhone = (phone) => /^\d{8,}$/.test(phone);

            const fetchSuppliers = async () => {
                try {
                    const response = await api.get('/suppliers/');
                    setSuppliers(response.data);
                } catch (error) {
                    console.error('Error cargando proveedores:', error);
                    setMessage('Error al cargar la lista de proveedores.');
                }
            };

            const handleAddSupplier = async (e) => {
                e.preventDefault();
                if (!newSupplier.name.trim()) {
                    setMessage('🚫 Error: El nombre es obligatorio.');
                    return;
                }
                if (!validateCUIT(newSupplier.cuit)) {
                    setMessage('🚫 Error: El CUIT debe ser un número de 11 dígitos.');
                    return;
                }
                if (!validatePhone(newSupplier.phone)) {
                    setMessage('🚫 Error: El teléfono debe contener solo números, con un mínimo de 8 dígitos.');
                    return;
                }
                try {
                    await api.post('/suppliers/', newSupplier);
                    await fetchSuppliers(); // Recargar lista
                    setMessage('Proveedor agregado correctamente.');
                    setShowAddSupplier(false);
                    setNewSupplier({ name: '', cuit: '', address: '', phone: '', products: '' });
                } catch (error) {
                    setMessage('Error al agregar proveedor.');
                }
            };

            const handleUpdateSupplier = async (e) => {
                e.preventDefault();
                if (!editingSupplier) return;

                if (!validateCUIT(editingSupplier.cuit)) {
                    setMessage('🚫 Error: El CUIT debe ser un número de 11 dígitos.');
                    return;
                }
                if (!validatePhone(editingSupplier.phone)) {
                    setMessage('🚫 Error: El teléfono debe contener solo números, con un mínimo de 8 dígitos.');
                    return;
                }

                try {
                    await api.put(`/suppliers/${editingSupplier.id}/`, editingSupplier);
                    await fetchSuppliers(); // Recargar lista
                    setEditingSupplier(null);
                    setMessage('✅ Proveedor actualizado exitosamente.');
                } catch (error) {
                    console.error('Error actualizando proveedor:', error.response?.data || error.message);
                    setMessage('Error al actualizar el proveedor.');
                }
            };

            const handleDeleteSupplier = async (supplierId) => {
                if (!window.confirm('¿Estás seguro de que quieres eliminar este proveedor?')) return;
                try {
                    await api.delete(`/suppliers/${supplierId}/`);
                    await fetchSuppliers(); // Recargar lista
                    setMessage('Proveedor eliminado correctamente.');
                } catch (error) {
                    setMessage('Error al eliminar proveedor.');
                }
            };

            const startEditing = (supplier) => {
                setEditingSupplier({ ...supplier });
                setShowAddSupplier(false);
            };

            const renderContent = () => {
                if (editingSupplier) {
                    return (
                        <form className="form-container" onSubmit={handleUpdateSupplier}>
                            <h3>Editando a {editingSupplier.name}</h3>
                            <input type="text" value={editingSupplier.name} onChange={e => setEditingSupplier({ ...editingSupplier, name: e.target.value })} placeholder="Nombre del Proveedor" required />
                            <input type="text" value={editingSupplier.cuit} onChange={e => setEditingSupplier({ ...editingSupplier, cuit: e.target.value })} placeholder="CUIT (11 dígitos)" required />
                            <input type="text" value={editingSupplier.address} onChange={e => setEditingSupplier({ ...editingSupplier, address: e.target.value })} placeholder="Dirección" required />
                            <input type="text" value={editingSupplier.phone} onChange={e => setEditingSupplier({ ...editingSupplier, phone: e.target.value })} placeholder="Teléfono" required />
                            <input type="text" value={editingSupplier.products} onChange={e => setEditingSupplier({ ...editingSupplier, products: e.target.value })} placeholder="Productos que provee" />
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Guardar Cambios</button>
                                <button type="button" className="action-button secondary" onClick={() => setEditingSupplier(null)}>Cancelar</button>
                            </div>
                        </form>
                    );
                }

                if (showAddSupplier) {
                    return (
                        <form className="form-container" onSubmit={handleAddSupplier}>
                            <h3>Registrar Proveedor</h3>
                            <input type="text" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="Nombre del Proveedor" required />
                            <input type="text" value={newSupplier.cuit} onChange={e => setNewSupplier({ ...newSupplier, cuit: e.target.value })} placeholder="CUIT (11 dígitos)" required />
                            <input type="text" value={newSupplier.address} onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })} placeholder="Dirección" required />
                            <input type="text" value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder="Teléfono" required />
                            <input type="text" value={newSupplier.products} onChange={e => setNewSupplier({ ...newSupplier, products: e.target.value })} placeholder="Productos que provee" />
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddSupplier(false)}>Cancelar</button>
                            </div>
                        </form>
                    );
                }

                return <button className="main-button" onClick={() => setShowAddSupplier(true)}>Registrar Nuevo Proveedor</button>;
            };

            return (
                <div className="management-container">
                    <h2>Gestión de Proveedores</h2>
                    {message && <p className="message">{message}</p>}
                    {renderContent()}
                    <h3>Proveedores Registrados</h3>
                    <ul className="list-container">
                        {suppliers.map(supplier => (
                            <li key={supplier.id} className="list-item">
                                <div className="supplier-info-container">
                                    <div><strong>{supplier.name}</strong> (CUIT: {supplier.cuit})</div>
                                    <div>{supplier.address} | Tel: {supplier.phone}</div>
                                    <div>Productos: {supplier.products}</div>
                                </div>
                                <div className="button-group">
                                    <button onClick={() => startEditing(supplier)} className="edit-button">Editar</button>
                                    <button onClick={() => handleDeleteSupplier(supplier.id)} className="delete-button">Eliminar</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
    
        // Componente de la interfaz de gestión de compras (para Gerente, Encargado, Cajero, Panadero).
        const PurchaseManagementInternal = () => {
            const [activeTab, setActiveTab] = useState('compras'); // 'compras' o 'solicitudes'
            const [showAddPurchase, setShowAddPurchase] = useState(false);
            const [newPurchase, setNewPurchase] = useState({
                date: '',
                supplierId: '',
                items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
            });
            const [message, setMessage] = useState('');
            const [confirmDelete, setConfirmDelete] = useState(null); // ID de la compra a eliminar
    
            // Función para validar fecha en formato dd/mm/aaaa
            const validateDate = (date) => {
                const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
                return dateRegex.test(date);
            };
    
            // Función para calcular el total de un item
            const calculateItemTotal = (quantity, unitPrice) => {
                const safeQuantity = isNaN(quantity) ? 0 : (quantity || 0);
                const safeUnitPrice = isNaN(unitPrice) ? 0 : (unitPrice || 0);
                return safeQuantity * safeUnitPrice;
            };
    
            // Función para agregar un nuevo item a la compra
            const addItem = () => {
                setNewPurchase({
                    ...newPurchase,
                    items: [...newPurchase.items, { productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                });
            };
    
            // Función para eliminar un item de la compra
            const removeItem = (index) => {
                if (newPurchase.items.length > 1) {
                    const updatedItems = newPurchase.items.filter((_, i) => i !== index);
                    setNewPurchase({ ...newPurchase, items: updatedItems });
                }
            };
    
            // Función para actualizar un item
            const updateItem = (index, field, value) => {
                const updatedItems = [...newPurchase.items];
                updatedItems[index] = { ...updatedItems[index], [field]: value };
                
                // Recalcular el total del item
                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = field === 'quantity' ? (value || 0) : (updatedItems[index].quantity || 0);
                    const unitPrice = field === 'unitPrice' ? (value || 0) : (updatedItems[index].unitPrice || 0);
                    updatedItems[index].total = calculateItemTotal(quantity, unitPrice);
                }
                
                setNewPurchase({ ...newPurchase, items: updatedItems });
            };
    
            // Función para calcular el total de la compra
            const calculatePurchaseTotal = () => {
                return newPurchase.items.reduce((sum, item) => sum + item.total, 0);
            };
    
            const handleAddPurchase = async (e) => {
                e.preventDefault();
                
                if (!newPurchase.supplierId) {
                    setMessage('Debe seleccionar un proveedor.');
                    return;
                }
                
                const invalidItems = newPurchase.items.some(item => 
                    (!(item.productId || (item.productName && item.productName.trim()))) || item.quantity <= 0 || item.unitPrice <= 0
                );
                
                if (invalidItems) {
                    setMessage('🚫 Error: Todos los productos deben tener nombre, cantidad y precio válidos.');
                    return;
                }
                
                const selectedSupplier = suppliers.find(s => s.id === parseInt(newPurchase.supplierId));
                if (!selectedSupplier) {
                    setMessage('🚫 Error: El proveedor seleccionado no existe.');
                    return;
                }
                
                const itemsForPayload = newPurchase.items.map(item => {
                    const quantity = Number(item.quantity) || 0;
                    const unitPrice = Number(item.unitPrice) || 0;
                    return {
                        product_id: item.productId ?? getProductIdByName(inventory, item.productName),
                        productName: item.productName,
                        quantity,
                        unitPrice,
                        total: quantity * unitPrice
                    };
                });

                const totalAmount = itemsForPayload.reduce((sum, it) => sum + it.total, 0);

                const status = userRole === 'Encargado' ? 'Pendiente' : 'Completada';

                const purchasePayload = {
                    date: newPurchase.date,
                    supplier: selectedSupplier.name,
                    supplier_id: parseInt(newPurchase.supplierId),
                    items: itemsForPayload,
                    total_amount: totalAmount,
                    status: status
                };

                try {
                    if (userRole === 'Gerente') {
                        for (const item of newPurchase.items) {
                            const existingProduct = products.find(p => p.name === item.productName);
                            
                            if (existingProduct) {
                                const updatedProduct = {
                                    ...existingProduct,
                                    stock: existingProduct.stock + item.quantity
                                };
                                await api.put(`/products/${existingProduct.id}/`, updatedProduct);
                            } else {
                                const newProduct = {
                                    name: item.productName,
                                    price: item.unitPrice,
                                    category: 'Insumo',
                                    stock: item.quantity,
                                    description: `Agregado automáticamente desde una compra (${new Date().toLocaleString()})`,
                                    low_stock_threshold: 10
                                };
                                await api.post('/products/', newProduct);
                            }
                        }
                    }
                    
                    const resp = await api.post('/purchases/', purchasePayload);
                    await loadProducts();

                    const savedPurchaseRaw = resp.data;
                    const savedPurchase = normalizePurchaseFromServer(savedPurchaseRaw);
                    setPurchases(prev => [...prev, savedPurchase]);

                    setNewPurchase({
                        date: '',
                        supplierId: '',
                        items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                    });
                    setShowAddPurchase(false);
                    setMessage(userRole === 'Encargado' ? '✅ Solicitud de compra enviada para aprobación.' : '✅ Compra registrada exitosamente y guardada en el servidor.');
                } catch (error) {
                    console.error('❌ Error procesando compra/solicitud:', error);
                    setMessage('❌ Error: No se pudo procesar la solicitud. Inténtalo nuevamente.');
                }
            };

            // Función para eliminar una compra del historial
            const handleDeletePurchase = async (purchaseId) => {
                if (confirmDelete === purchaseId) {
                    try {
                        await api.delete(`/purchases/${purchaseId}/`);
                        const updatedPurchases = purchases.filter(purchase => purchase.id !== purchaseId);
                        setPurchases(updatedPurchases);
                        setConfirmDelete(null);
                        setMessage('✅ Compra eliminada del historial exitosamente.');
                    } catch (error) {
                        console.warn('⚠️ No se pudo eliminar compra en backend:', error);
                        setMessage('Error al eliminar la compra.');
                    }
                } else {
                    setConfirmDelete(purchaseId);
                    setMessage('⚠️ ¿Estás seguro de que deseas eliminar esta compra del historial? Haz clic nuevamente en "Eliminar" para confirmar.');
                }
            };

            // Función para cancelar la eliminación
            const handleCancelDelete = () => {
                setConfirmDelete(null);
                setMessage('');
            };
    
            return (
                <div className="management-container">
                    <h2>Gestión de Compras</h2>
                    {message && <p className="message">{message}</p>}

                    <div className="tab-navigation">
                        <button 
                            className={`tab-button ${activeTab === 'compras' ? 'active' : ''}`}
                            onClick={() => setActiveTab('compras')}
                        >
                            Registrar Compra
                        </button>
                        {userRole === 'Gerente' && (
                            <button 
                                className={`tab-button ${activeTab === 'solicitudes' ? 'active' : ''}`}
                                onClick={() => setActiveTab('solicitudes')}
                            >
                                Solicitudes de Compra
                            </button>
                        )}
                    </div>

                    {activeTab === 'compras' && (
                        <>
                            {!showAddPurchase ? (
                                <button className="main-button" onClick={() => setShowAddPurchase(true)}>
                                    {userRole === 'Encargado' ? 'Solicitar Nueva Compra' : 'Registrar Nueva Compra'}
                                </button>
                            ) : (
                                <form className="form-container" onSubmit={handleAddPurchase}>
                                    <h3>{userRole === 'Encargado' ? 'Solicitar Compra' : 'Registrar Compra'}</h3>
                                    
                                    <input 
                                        type="date" 
                                        value={newPurchase.date} 
                                        onChange={e => setNewPurchase({ ...newPurchase, date: e.target.value })} 
                                        placeholder="Fecha (dd/mm/aaaa)" 
                                        required 
                                    />
                                    
                                    <select 
                                        value={newPurchase.supplierId} 
                                        onChange={e => setNewPurchase({ ...newPurchase, supplierId: e.target.value })} 
                                        required
                                    >
                                        <option value="">Seleccionar Proveedor</option>
                                        {suppliers.map(supplier => (
                                            <option key={supplier.id} value={supplier.id}>
                                                {supplier.name} - {supplier.cuit}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    <h4>Productos de la Compra</h4>
                                    {newPurchase.items.map((item, index) => (
                                        <div key={index} className="purchase-item">
                                            <div className="item-row">
                                                <Select
                                                    options={inventory.map(p => ({ value: p.id, label: p.name }))}
                                                    value={inventory.map(p => ({ value: p.id, label: p.name })).find(opt => opt.value === item.productId) || null}
                                                    onChange={(opt) => {
                                                        const updatedItems = [...newPurchase.items];
                                                        const current = { ...updatedItems[index] };
                                                        if (!opt) {
                                                            current.productId = '';
                                                            current.productName = '';
                                                        } else {
                                                            current.productId = opt.value;
                                                            current.productName = opt.label;
                                                            const p = (products || []).find(pr => String(pr.id) === String(opt.value)) || (inventory || []).find(pr => String(pr.id) === String(opt.value));
                                                            if (p && p.price !== undefined) current.unitPrice = p.price;
                                                        }
                                                        const qty = Number(current.quantity) || 0;
                                                        const up = Number(current.unitPrice) || 0;
                                                        current.total = qty * up;
                                                        updatedItems[index] = current;
                                                        setNewPurchase({ ...newPurchase, items: updatedItems });
                                                    }}
                                                    placeholder="Seleccionar producto..."
                                                    isClearable={true}
                                                />
                                                <input 
                                                    type="number" 
                                                    value={item.quantity || ''} 
                                                    onChange={e => {
                                                        const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                        updateItem(index, 'quantity', isNaN(value) ? 0 : value);
                                                    }}
                                                    placeholder="Cantidad" 
                                                    min="1"
                                                    required 
                                                />
                                                <input 
                                                    type="number" 
                                                    value={item.unitPrice || ''} 
                                                    onChange={e => {
                                                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                        updateItem(index, 'unitPrice', isNaN(value) ? 0 : value);
                                                    }}
                                                    placeholder="Precio Unitario" 
                                                    min="0.01"
                                                    step="0.01"
                                                    required 
                                                />
                                                <span className="item-total">${safeToFixed(item.total)}</span>
                                                {newPurchase.items.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeItem(index)}
                                                        className="remove-item-button"
                                                    >
                                                        ❌
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            
                            <button type="button" onClick={addItem} className="add-item-button">
                                ➕ Agregar Producto
                            </button>
                            
                            <div className="purchase-total">
                                <strong>Total de la Compra: ${safeToFixed(calculatePurchaseTotal())}</strong>
                            </div>
                            
                            <div className="button-group">
                                <button type="submit" className="action-button primary">{userRole === 'Encargado' ? 'Enviar Solicitud' : 'Registrar Compra'}</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddPurchase(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Historial de Compras</h3>
                    <ul className="list-container">
                        {purchases.filter(p => ['Aprobada', 'Completada'].includes(p.status)).map(purchase => (
                            <li key={purchase.id} className="purchase-list-item">
                                <div className="purchase-header">
                                    <strong>Compra #{purchase.id} - {purchase.date}</strong>
                                    <div className="purchase-actions">
                                        <span className="purchase-status">{purchase.status}</span>
                                        {userRole === 'Gerente' && (
                                            <div className="delete-controls">
                                                {confirmDelete === purchase.id ? (
                                                    <div className="confirm-delete">
                                                        <button 
                                                            className="action-button danger small"
                                                            onClick={() => handleDeletePurchase(purchase.id)}
                                                        >
                                                            ✓ Confirmar
                                                        </button>
                                                        <button 
                                                            className="action-button secondary small"
                                                            onClick={handleCancelDelete}
                                                        >
                                                            ✕ Cancelar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        className="action-button danger small"
                                                        onClick={() => handleDeletePurchase(purchase.id)}
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="purchase-supplier">
                                    <strong>Proveedor:</strong> {purchase.supplierName}
                                </div>
                                <div className="purchase-items">
                                    <strong>Productos:</strong>
                                    <ul>
                                        {purchase.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity} x ${item.unitPrice} = ${safeToFixed(item.total)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="purchase-total-display">
                                    <strong>Total: ${safeToFixed(purchase.totalAmount)}</strong>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {activeTab === 'solicitudes' && userRole === 'Gerente' && (
                <PurchaseRequests />
            )}
        </div>
    );
};

// Componente para mostrar y gestionar solicitudes de compra
const PurchaseRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const response = await api.get('/purchases/pending-approval/');
                setRequests(response.data);
            } catch (err) {
                setError('No se pudieron cargar las solicitudes de compra.');
                console.error('Error fetching purchase requests:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, []);

    const handleApprove = async (requestId) => {
        try {
            await api.patch(`/purchases/${requestId}/`, { status: 'Completada' });
            setRequests(requests.filter(r => r.id !== requestId));
        } catch (err) {
            setError('Error al aprobar la solicitud.');
            console.error('Error approving request:', err);
        }
    };

    const handleReject = async (requestId) => {
        try {
            await api.patch(`/purchases/${requestId}/`, { status: 'Rechazada' });
            setRequests(requests.filter(r => r.id !== requestId));
        } catch (err) {
            setError('Error al rechazar la solicitud.');
            console.error('Error rejecting request:', err);
        }
    };

    if (loading) return <div>Cargando solicitudes...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="management-container">
            <h3>Solicitudes de Compra Pendientes</h3>
            <ul className="list-container">
                {requests.map(request => (
                    <li key={request.id} className="purchase-list-item">
                        <div className="purchase-header">
                            <strong>Solicitud #{request.id} - {request.date}</strong>
                        </div>
                        <div className="purchase-supplier">
                            <strong>Proveedor:</strong> {request.supplierName}
                        </div>
                        <div className="purchase-items">
                            <strong>Productos:</strong>
                            <ul>
                                {request.items.map((item, index) => (
                                    <li key={index}>
                                        {item.productName} - {item.quantity} x ${item.unitPrice} = ${safeToFixed(item.total)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="purchase-total-display">
                            <strong>Total: ${safeToFixed(request.totalAmount)}</strong>
                        </div>
                        <div className="button-group">
                            <button onClick={() => handleApprove(request.id)} className="action-button primary">Aprobar</button>
                            <button onClick={() => handleReject(request.id)} className="action-button delete">Rechazar</button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
    
        // Componente de la interfaz de gestión de pedidos de clientes.
        const OrderManagementComponent = () => {
            const [showAddOrder, setShowAddOrder] = useState(false);
            const [newOrder, setNewOrder] = useState({
                customerName: '',
                date: new Date().toISOString().split('T')[0], // Fecha actual por defecto
                paymentMethod: '',
                items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }],
                notes: ''
            });
            const [message, setMessage] = useState('');
            const [showAddPurchase, setShowAddPurchase] = useState(false);
            const [confirmDelete, setConfirmDelete] = useState(null);

            const calculatePurchaseTotal = () => {
                return newOrder.items.reduce((sum, item) => sum + (item.total || 0), 0);
            };

            const handleDeletePurchase = async (purchaseId) => {
                console.warn('Attempted to delete purchase from a deprecated component.');
            };

            const handleCancelDelete = () => {
                setConfirmDelete(null);
            };
    
            // Función para agregar un nuevo item al pedido
            const addItem = () => {
                setNewOrder({
                    ...newOrder,
                    items: [...newOrder.items, { productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                });
            };
    
            // Función para eliminar un item del pedido
            const removeItem = (index) => {
                if (newOrder.items.length > 1) {
                    const updatedItems = newOrder.items.filter((_, i) => i !== index);
                    setNewOrder({ ...newOrder, items: updatedItems });
                }
            };
    
            // Función para actualizar un item
            const updateItem = (index, field, value) => {
                const updatedItems = [...newOrder.items];
                updatedItems[index] = { ...updatedItems[index], [field]: value };
                
                // Si se cambia el nombre del producto, buscar su precio en la lista de productos
                if (field === 'productName') {
                    const selectedProduct = products.find(p => p.name === value);
                    if (selectedProduct) {
                        updatedItems[index].unitPrice = selectedProduct.price;
                        updatedItems[index].total = (updatedItems[index].quantity || 0) * selectedProduct.price;
                    }
                }
                
                // Recalcular el total del item si se cambia cantidad o precio
                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = field === 'quantity' ? (value || 0) : (updatedItems[index].quantity || 0);
                    const unitPrice = field === 'unitPrice' ? (value || 0) : (updatedItems[index].unitPrice || 0);
                    updatedItems[index].total = quantity * unitPrice;
                }
                
                setNewOrder({ ...newOrder, items: updatedItems });
            };

            // Función para calcular el total del pedido
            const calculateOrderTotal = () => {
                return newOrder.items.reduce((sum, item) => sum + (item.total || 0), 0);
            };
    
            const handleAddOrder = async (e) => {
                e.preventDefault();
                
                // Validaciones
                if (!newOrder.customerName.trim()) {
                    setMessage('🚫 Error: Debe ingresar el nombre del cliente.');
                    return;
                }
                
                if (!newOrder.paymentMethod) {
                    setMessage('🚫 Error: Debe seleccionar un método de pago.');
                    return;
                }
                
                // Validar que al menos un producto tenga cantidad mayor a 0 y precio válido
                const validItems = newOrder.items.filter(item => 
                    item.productName.trim() && item.quantity > 0 && item.unitPrice > 0
                );
                
                if (validItems.length === 0) {
                    setMessage('🚫 Error: Debe seleccionar al menos un producto con cantidad y precio válidos.');
                    return;
                }
                
                // Enviar pedido al backend para persistencia cross-browser
                try {
                    const payload = {
                        customer_name: newOrder.customerName,
                        date: newOrder.date,
                        payment_method: newOrder.paymentMethod,
                        items: validItems.map(i => ({ product_name: i.productName, quantity: Number(i.quantity), unit_price: Number(i.unitPrice), total: Number(i.total) })),
                        notes: newOrder.notes
                    };

                    const res = await api.post('/orders/', payload);
                    if (res && res.data) {
                        // Insertar el pedido devuelto por el servidor
                        const created = res.data;
                        const createdNormalized = {
                            id: created.id,
                            date: created.date,
                            customerName: created.customer_name || created.customerName || '',
                            paymentMethod: created.payment_method || created.paymentMethod || '',
                            items: Array.isArray(created.items) ? created.items.map(it => ({ productName: it.product_name || it.productName || '', quantity: it.quantity, unitPrice: it.unit_price || it.unitPrice || 0, total: it.total || 0 })) : [],
                            totalAmount: created.total_amount || created.totalAmount || 0,
                            status: created.status || 'Pendiente',
                            notes: created.notes || ''
                        };

                        setOrders(prev => [...prev, createdNormalized]);
                        setNewOrder({ customerName: '', date: new Date().toISOString().split('T')[0], paymentMethod: '', items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }], notes: '' });
                        setShowAddOrder(false);
                        setMessage('✅ Pedido de cliente registrado exitosamente.');
                    } else {
                        setMessage('⚠️ Pedido creado localmente, pero no se obtuvo confirmación del servidor.');
                    }
                } catch (err) {
                    console.error('Error enviando pedido al backend:', err, err.response && err.response.data);
                    setMessage('❌ Error guardando el pedido en el servidor. Revisar consola.');
                }
            };
    
            const handleUpdateOrderStatus = (orderId, newStatus) => {
                setOrders(orders.map(order => 
                    order.id === orderId 
                        ? { ...order, status: newStatus }
                        : order
                ));
            };
    
            return (
                <div className="management-container">
                    <h2>Gestión de Pedidos de Clientes</h2>
                    {message && <p className="message">{message}</p>}
                    {!showAddOrder ? (
                        <button className="main-button" onClick={() => setShowAddOrder(true)}>Registrar Nuevo Pedido de Cliente</button>
                    ) : (
                        <form className="form-container" onSubmit={handleAddOrder}>
                            <h3>Registrar Pedido de Cliente</h3>
                            
                            <input 
                                type="text" 
                                value={newOrder.customerName} 
                                onChange={e => setNewOrder({ ...newOrder, customerName: e.target.value })} 
                                placeholder="Nombre del cliente" 
                                required
                            />
                            
                            <input 
                                type="date" 
                                value={newOrder.date} 
                                onChange={e => setNewOrder({ ...newOrder, date: e.target.value })} 
                                required
                            />
                            
                            <select 
                                value={newOrder.paymentMethod} 
                                onChange={e => setNewOrder({ ...newOrder, paymentMethod: e.target.value })} 
                                required
                            >
                                <option value="">Seleccionar método de pago</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="debito">Débito</option>
                                <option value="credito">Crédito</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                            
                            <h4>Productos del Pedido</h4>
                            
                            {newOrder.items.map((item, index) => (
                                <div key={index} className="order-item">
                                    <div className="item-row">
                                        <input 
                                            type="text" 
                                            value={item.productName} 
                                            onChange={e => updateItem(index, 'productName', e.target.value)} 
                                            placeholder="Nombre del producto" 
                                            list="products-list"
                                            required
                                        />
                                        <datalist id="products-list">
                                            {products.map((product, idx) => (
                                                <option key={idx} value={product.name} />
                                            ))}
                                        </datalist>
                                        <input 
                                            type="number" 
                                            value={item.quantity || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                updateItem(index, 'quantity', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Cantidad" 
                                            min="1"
                                            required 
                                        />
                                        <input 
                                            type="number" 
                                            value={item.unitPrice || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                updateItem(index, 'unitPrice', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Precio Unitario" 
                                            min="0.01"
                                            step="0.01"
                                            required 
                                        />
                                        <span className="item-total">${safeToFixed(item.total)}</span>
                                        {newOrder.items.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)}
                                                className="remove-item-button"
                                            >
                                                ❌
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button type="button" onClick={addItem} className="add-item-button">
                                ➕ Agregar Producto
                            </button>
                            
                            <div className="purchase-total">
                                <strong>Total de la Compra: ${safeToFixed(calculatePurchaseTotal())}</strong>
                            </div>
                            
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar Compra</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddPurchase(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Historial de Compras</h3>
                    <ul className="list-container">
                        {purchases.map(purchase => (
                            <li key={purchase.id} className="purchase-list-item">
                                <div className="purchase-header">
                                    <strong>Compra #{purchase.id} - {purchase.date}</strong>
                                    <div className="purchase-actions">
                                        <span className="purchase-status">{purchase.status}</span>
                                        {userRole === 'Gerente' && (
                                            <div className="delete-controls">
                                                {confirmDelete === purchase.id ? (
                                                    <div className="confirm-delete">
                                                        <button 
                                                            className="action-button danger small"
                                                            onClick={() => handleDeletePurchase(purchase.id)}
                                                        >
                                                            ✓ Confirmar
                                                        </button>
                                                        <button 
                                                            className="action-button secondary small"
                                                            onClick={handleCancelDelete}
                                                        >
                                                            ✕ Cancelar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        className="action-button danger small"
                                                        onClick={() => handleDeletePurchase(purchase.id)}
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="purchase-supplier">
                                    <strong>Proveedor:</strong> {purchase.supplierName}
                                </div>
                                <div className="purchase-items">
                                    <strong>Productos:</strong>
                                    <ul>
                                        {purchase.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity} x ${item.unitPrice} = ${safeToFixed(item.total)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="purchase-total-display">
                                    <strong>Total: ${safeToFixed(purchase.totalAmount)}</strong>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };
    
        // Componente de la interfaz de gestión de pedidos de clientes (solo para Gerente).
        const OrderManagement = () => {
            const [showAddOrder, setShowAddOrder] = useState(false);
            const [newOrder, setNewOrder] = useState({
                customerName: '',
                date: new Date().toISOString().split('T')[0], // Fecha actual por defecto
                paymentMethod: '',
                items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }],
                notes: ''
            });
            const [message, setMessage] = useState('');
    
            // Función para agregar un nuevo item al pedido
            const addItem = () => {
                setNewOrder({
                    ...newOrder,
                    items: [...newOrder.items, { productName: '', quantity: 1, unitPrice: 0, total: 0 }]
                });
            };
    
            // Función para eliminar un item del pedido
            const removeItem = (index) => {
                if (newOrder.items.length > 1) {
                    const updatedItems = newOrder.items.filter((_, i) => i !== index);
                    setNewOrder({ ...newOrder, items: updatedItems });
                }
            };
    
            // Función para actualizar un item
            const updateItem = (index, field, value) => {
                const updatedItems = [...newOrder.items];
                updatedItems[index] = { ...updatedItems[index], [field]: value };
                
                // Si se cambia el nombre del producto, buscar su precio en la lista de productos
                if (field === 'productName') {
                    const selectedProduct = products.find(p => p.name === value);
                    if (selectedProduct) {
                        updatedItems[index].unitPrice = selectedProduct.price;
                        updatedItems[index].total = (updatedItems[index].quantity || 0) * selectedProduct.price;
                    }
                }
                
                // Recalcular el total del item si se cambia cantidad o precio
                if (field === 'quantity' || field === 'unitPrice') {
                    const quantity = field === 'quantity' ? (value || 0) : (updatedItems[index].quantity || 0);
                    const unitPrice = field === 'unitPrice' ? (value || 0) : (updatedItems[index].unitPrice || 0);
                    updatedItems[index].total = quantity * unitPrice;
                }
                
                setNewOrder({ ...newOrder, items: updatedItems });
            };

            // Función para calcular el total del pedido
            const calculateOrderTotal = () => {
                return newOrder.items.reduce((sum, item) => sum + (item.total || 0), 0);
            };
    
            const handleAddOrder = async (e) => {
                e.preventDefault();
                
                // Validaciones
                if (!newOrder.customerName.trim()) {
                    setMessage('🚫 Error: Debe ingresar el nombre del cliente.');
                    return;
                }
                
                if (!newOrder.paymentMethod) {
                    setMessage('🚫 Error: Debe seleccionar un método de pago.');
                    return;
                }
                
                // Validar que al menos un producto tenga cantidad mayor a 0 y precio válido
                const validItems = newOrder.items.filter(item => 
                    item.productName.trim() && item.quantity > 0 && item.unitPrice > 0
                );
                
                if (validItems.length === 0) {
                    setMessage('🚫 Error: Debe seleccionar al menos un producto con cantidad y precio válidos.');
                    return;
                }
                
                // Enviar pedido al backend para persistencia cross-browser
                try {
                    const payload = {
                        customer_name: newOrder.customerName,
                        date: newOrder.date,
                        payment_method: newOrder.paymentMethod,
                        items: validItems.map(i => ({ product_name: i.productName, quantity: Number(i.quantity), unit_price: Number(i.unitPrice), total: Number(i.total) })),
                        notes: newOrder.notes
                    };

                    const res = await api.post('/orders/', payload);
                    if (res && res.data) {
                        // Insertar el pedido devuelto por el servidor
                        const created = res.data;
                        const createdNormalized = {
                            id: created.id,
                            date: created.date,
                            customerName: created.customer_name || created.customerName || '',
                            paymentMethod: created.payment_method || created.paymentMethod || '',
                            items: Array.isArray(created.items) ? created.items.map(it => ({ productName: it.product_name || it.productName || '', quantity: it.quantity, unitPrice: it.unit_price || it.unitPrice || 0, total: it.total || 0 })) : [],
                            totalAmount: created.total_amount || created.totalAmount || 0,
                            status: created.status || 'Pendiente',
                            notes: created.notes || ''
                        };

                        setOrders(prev => [...prev, createdNormalized]);
                        setNewOrder({ customerName: '', date: new Date().toISOString().split('T')[0], paymentMethod: '', items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }], notes: '' });
                        setShowAddOrder(false);
                        setMessage('✅ Pedido de cliente registrado exitosamente.');
                    } else {
                        setMessage('⚠️ Pedido creado localmente, pero no se obtuvo confirmación del servidor.');
                    }
                } catch (err) {
                    console.error('Error enviando pedido al backend:', err, err.response && err.response.data);
                    setMessage('❌ Error guardando el pedido en el servidor. Revisar consola.');
                }
            };
    
            const handleUpdateOrderStatus = (orderId, newStatus) => {
                setOrders(orders.map(order => 
                    order.id === orderId 
                        ? { ...order, status: newStatus }
                        : order
                ));
            };
    
            return (
                <div className="management-container">
                    <h2>Gestión de Pedidos de Clientes</h2>
                    {message && <p className="message">{message}</p>}
                    {!showAddOrder ? (
                        <button className="main-button" onClick={() => setShowAddOrder(true)}>Registrar Nuevo Pedido de Cliente</button>
                    ) : (
                        <form className="form-container" onSubmit={handleAddOrder}>
                            <h3>Registrar Pedido de Cliente</h3>
                            
                            <input 
                                type="text" 
                                value={newOrder.customerName} 
                                onChange={e => setNewOrder({ ...newOrder, customerName: e.target.value })} 
                                placeholder="Nombre del cliente" 
                                required
                            />
                            
                            <input 
                                type="date" 
                                value={newOrder.date} 
                                onChange={e => setNewOrder({ ...newOrder, date: e.target.value })} 
                                required
                            />
                            
                            <select 
                                value={newOrder.paymentMethod} 
                                onChange={e => setNewOrder({ ...newOrder, paymentMethod: e.target.value })} 
                                required
                            >
                                <option value="">Seleccionar método de pago</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="debito">Débito</option>
                                <option value="credito">Crédito</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                            
                            <h4>Productos del Pedido</h4>
                            
                            {newOrder.items.map((item, index) => (
                                <div key={index} className="order-item">
                                    <div className="item-row">
                                        <Select
                                            options={products.map(p => ({ value: p.name, label: p.name }))}
                                            value={products.map(p => ({ value: p.name, label: p.name })).find(opt => opt.value === item.productName) || null}
                                            onChange={selectedOption => updateItem(index, 'productName', selectedOption ? selectedOption.value : '')}
                                            placeholder="Buscar y seleccionar producto..."
                                            isClearable
                                        />
                                        <input 
                                            type="number" 
                                            value={item.quantity || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                updateItem(index, 'quantity', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Cantidad" 
                                            min="1"
                                            required 
                                        />
                                        <input 
                                            type="number" 
                                            value={item.unitPrice || ''} 
                                            onChange={e => {
                                                const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                updateItem(index, 'unitPrice', isNaN(value) ? 0 : value);
                                            }}
                                            placeholder="Precio Unitario" 
                                            min="0.01"
                                            step="0.01"
                                            required 
                                        />
                                        <span className="item-total">${safeToFixed(item.total)}</span>
                                        {newOrder.items.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)}
                                                className="remove-item-button"
                                            >
                                                ❌
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button type="button" onClick={addItem} className="add-item-button">
                                ➕ Agregar Producto
                            </button>
                            
                            <textarea 
                                value={newOrder.notes} 
                                onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} 
                                placeholder="Notas adicionales del pedido" 
                            />
                            
                            <div className="purchase-total">
                                <strong>Total del Pedido: ${safeToFixed(calculateOrderTotal())}</strong>
                            </div>
                            
                            <div className="button-group">
                                <button type="submit" className="action-button primary">Registrar Pedido</button>
                                <button type="button" className="action-button secondary" onClick={() => setShowAddOrder(false)}>Cancelar</button>
                            </div>
                        </form>
                    )}
    
                    <h3>Historial de Pedidos de Clientes</h3>
                    <ul className="list-container">
                        {orders.map(order => (
                            <li key={order.id} className="order-list-item">
                                <div className="order-header">
                                    <strong>Pedido #{order.id} - {order.date}</strong>
                                    <div className="order-status-controls">
                                        <span className={`order-status ${order.status.toLowerCase()}`}>
                                            {order.status}
                                        </span>
                                        <select 
                                            value={order.status} 
                                            onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}
                                            className="status-select"
                                        >
                                            <option value="Pendiente">Pendiente</option>
                                            <option value="En Preparación">En Preparación</option>
                                            <option value="Listo">Listo</option>
                                            <option value="Entregado">Entregado</option>
                                            <option value="Cancelado">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="order-customer">
                                    <strong>Cliente:</strong> {order.customerName}
                                </div>
                                <div className="order-payment">
                                    <strong>Método de Pago:</strong> {order.paymentMethod}
                                </div>
                                <div className="order-items">
                                    <strong>Productos solicitados:</strong>
                                    <ul>
                                        {order.items.map((item, index) => (
                                            <li key={index}>
                                                {item.productName} - {item.quantity || 0} unidades 
                                                x ${safeToFixed(item.unitPrice)} = ${safeToFixed(item.total)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="order-total-display">
                                    <strong>Total: ${safeToFixed(order.totalAmount)}</strong>
                                </div>
                                {order.notes && (
                                    <div className="order-notes">
                                        <strong>Notas:</strong> {order.notes}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };
    
        // Mapeo de traducción para encabezados de tablas
        const headerTranslationMap = {
            'name': 'Producto/Insumo',
            'cuit': 'CUIT',
            'phone': 'Teléfono',
            'address': 'Dirección',
            'products': 'Productos',
            'items': 'Insumo/Producto',
            'id': 'ID',
            'date': 'Fecha',
            'email': 'Email',
            'role': 'Rol',
            'username': 'Usuario',
            'user': 'Usuario',
            'type': 'Tipo',
            'amount': 'Monto',
            'description': 'Descripción',
            'price': 'Precio',
            'stock': 'Stock',
            'category': 'Categoría',
            'status': 'Estado',
            'supplier': 'Proveedor',
            'total': 'Total',
            'quantity': 'Cantidad',
            'product': 'Producto',
            // Traducciones para el resumen
            'totalSuppliers': 'Total de Proveedores',
            'activeSuppliers': 'Proveedores Activos',
            'totalSales': 'Total de Ventas',
            'totalRevenue': 'Ingresos Totales',
            'totalPurchases': 'Total de Compras',
            'totalAmount': 'Monto Total',
            'totalOrders': 'Total de Pedidos',
            'pendingOrders': 'Pedidos Pendientes',
            'sentOrders': 'Pedidos Enviados',
            'customerName': 'Cliente',
            'customer_name': 'Cliente',
            'paymentMethod': 'Método de Pago',
            'payment_method': 'Método de Pago',
            'payment_method': 'Método de Pago',
            'products': 'Productos',
            'units': 'Unidades',
            'totalMovements': 'Total de Movimientos',
            'totalIncome': 'Ingresos Totales',
            'totalExpenses': 'Gastos Totales',
            'period': 'Período'
        };

        // DataConsultation moved to `src/DataConsultation.js` to provide a stable identity
        // and avoid remounts caused by defining the component inline within App.
    
        // Componente de la interfaz de edición de productos nuevos (solo para Gerente).
        const EditNewProducts = () => {
            const [selectedProduct, setSelectedProduct] = useState(null);
            const [editingProduct, setEditingProduct] = useState({
                name: '',
                price: 0,
                category: 'Producto',
                stock: 0,
                description: '',
                lowStockThreshold: 10
            });
            const [message, setMessage] = useState('');
            const [confirmDelete, setConfirmDelete] = useState(false);
            const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    
            // Función para validar el nombre del producto
            const validateProductName = (name) => {
                return name.trim().length > 0 && name.trim().length <= 100;
            };
    
            // Función para validar el precio
            const validatePrice = (price) => {
                return price > 0;
            };
    
            // Función para validar la categoría
            const validateCategory = (category) => {
                return ['Producto', 'Insumo'].includes(category);
            };
    
            // Función para validar el stock
            const validateStock = (stock) => {
                return stock >= 0 && Number.isInteger(stock);
            };
            
            // Función para validar el umbral de stock bajo
            const validateLowStockThreshold = (threshold) => {
                return threshold >= 0 && Number.isInteger(threshold);
            };
    
            // Función para seleccionar un producto para editar
            const selectProductForEdit = (product) => {
                if (!product) {
                    setMessage('⚠️ Producto no encontrado.');
                    return;
                }
                setSelectedProduct(product);
                setEditingProduct({
                    name: product.name || '',
                    price: product.price || 0,
                    category: product.category || 'Producto',
                    stock: product.stock || 0,
                    description: product.description || '',
                    lowStockThreshold: product.lowStockThreshold ?? product.low_stock_threshold ?? 10
                });
                setMessage('');
            };

            // Función para guardar cambios del producto seleccionado
            const handleSaveChanges = async (e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (!selectedProduct) return;

                if (!validatePrice(editingProduct.price)) {
                    setMessage('🚫 Error: El precio debe ser un número decimal positivo mayor a cero.');
                    return;
                }

                if (!validateCategory(editingProduct.category)) {
                    setMessage('🚫 Error: La categoría debe existir en la lista de categorías registradas.');
                    return;
                }

                if (!validateStock(editingProduct.stock)) {
                    setMessage('🚫 Error: El stock inicial debe ser un número entero positivo o cero.');
                    return;
                }

                if (!validateLowStockThreshold(editingProduct.lowStockThreshold)) {
                    setMessage('🚫 Error: El umbral de stock bajo debe ser un número entero positivo o cero.');
                    return;
                }

                if (!editingProduct.name.trim() || editingProduct.price <= 0 || !editingProduct.category) {
                    setMessage('🚫 Error: No se pueden eliminar datos obligatorios (nombre, precio, categoría).');
                    return;
                }

                try {
                    const updatedProduct = {
                        name: editingProduct.name,
                        price: editingProduct.price,
                        category: editingProduct.category,
                        stock: editingProduct.stock,
                        description: editingProduct.description,
                        lowStockThreshold: editingProduct.lowStockThreshold
                    };

                    await api.put(`/products/${selectedProduct.id}/`, updatedProduct);
                    await loadProducts();

                    setSelectedProduct(null);
                    setEditingProduct({
                        name: '',
                        price: 0,
                        category: 'Producto',
                        stock: 0,
                        description: '',
                        lowStockThreshold: 10
                    });
                    setMessage('✅ Producto actualizado correctamente en el servidor. Los cambios se reflejan en todas las secciones.');
                } catch (error) {
                    console.error('Error actualizando producto en el servidor:', error);
                    setMessage('❌ Error: No se pudo actualizar el producto en el servidor. Los cambios no fueron guardados.');
                }
            };
    
            // Función para cancelar la edición
            const handleCancelEdit = () => {
                setSelectedProduct(null);
                setEditingProduct({
                    name: '',
                    price: 0,
                    category: 'Producto',
                    stock: 0,
                    description: '',
                    lowStockThreshold: 10
                });
                setMessage('');
                setConfirmDelete(false);
            };
            
            // Función para eliminar un producto
            const handleDeleteProduct = async () => {
                if (!selectedProduct) return;
                
                // Si el producto tiene ventas, no se puede eliminar
                if (selectedProduct.hasSales) {
                    setMessage('⚠️ Error: No se puede eliminar un producto que ya tiene ventas registradas.');
                    setConfirmDelete(false);
                    return;
                }
                
                if (!confirmDelete) {
                    setConfirmDelete(true);
                    setMessage('⚠️ ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.');
                    return;
                }
                
                try {
                    // Eliminar del backend primero
                    await api.delete(`/products/${selectedProduct.id}/`);
                    
                    // Si se elimina correctamente del backend, eliminar del estado local
                    const updatedProducts = products.filter(product => product.id !== selectedProduct.id);
                    
                    setProducts(updatedProducts);
                    setSelectedProduct(null);
                    setEditingProduct({
                        name: '',
                        price: 0,
                        category: 'Producto',
                        stock: 0,
                        description: '',
                        lowStockThreshold: 10
                    });
                    setConfirmDelete(false);
                    setMessage('✅ Producto eliminado correctamente del servidor y todas las secciones.');
                } catch (error) {
                    console.error('Error eliminando producto del servidor:', error);
                    setMessage('❌ Error: No se pudo eliminar el producto del servidor. El producto permanece en el sistema.');
                    setConfirmDelete(false);
                }
            };
            
            // Función para eliminar todos los productos
            const handleDeleteAllProducts = async () => {
                if (!deleteAllConfirm) {
                    setDeleteAllConfirm(true);
                    setMessage('⚠️ ¿Estás seguro de que deseas eliminar TODOS los productos sin ventas? Esta acción no se puede deshacer.');
                    return;
                }
                
                try {
                    // Obtener productos sin ventas que se pueden eliminar
                    const productsToDelete = products.filter(product => !product.hasSales);
                    
                    // Eliminar cada producto del backend
                    const deletePromises = productsToDelete.map(product => 
                        api.delete(`/products/${product.id}/`)
                    );
                    
                    await Promise.all(deletePromises);
                    
                    // Si se eliminan correctamente del backend, actualizar estado local
                    const productsWithSales = products.filter(product => product.hasSales);
                    
                    setProducts(productsWithSales);
                    setDeleteAllConfirm(false);
                    setMessage(`✅ ${productsToDelete.length} productos eliminados correctamente del servidor y todas las secciones.`);
                } catch (error) {
                    console.error('Error eliminando productos del servidor:', error);
                    setMessage('❌ Error: No se pudieron eliminar todos los productos del servidor.');
                    setDeleteAllConfirm(false);
                }
            };
    
            // Obtener solo productos nuevos (sin ventas registradas)
            const newProducts = products.filter(product => !product.hasSales);
    
            return (
                <div className="management-container">
                    <div style={{marginBottom: '10px'}}>
                        <h2>Editar Productos Nuevos</h2>
                    </div>
                    {message && <p className="message">{message}</p>}
                    
                    <div className="products-list">
                        <h3>Productos Disponibles para Edición</h3>
                        <p className="info-text">
                            Solo se muestran productos marcados como "nuevos" o sin ventas registradas.
                        </p>
                        
                        {newProducts.length === 0 ? (
                            <p className="no-products">No hay productos nuevos disponibles para editar.</p>
                        ) : (
                            <ul className="list-container">
                                {newProducts.map(product => (
                                    <li key={product.id} className="product-list-item">
                                        <div className="product-info">
                                            <strong>{product.name}</strong>
                                            <span className="product-price">${product.price}</span>
                                            <span className="product-category">{product.category}</span>
                                            <span className="product-stock">Stock: {product.stock}</span>
                                            <span className="product-threshold">Umbral Stock Bajo: {product.lowStockThreshold || 10}</span>
                                            {product.description && (
                                                <span className="product-description">{product.description}</span>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => selectProductForEdit(product)}
                                            className="edit-button"
                                            disabled={selectedProduct?.id === product.id}
                                        >
                                            {selectedProduct?.id === product.id ? 'Editando...' : 'Editar'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
    
                    {selectedProduct && (
                        <div className="edit-form">
                            <h3>Editar Producto: {selectedProduct.name}</h3>
                            
                            <form onSubmit={handleSaveChanges} className="form-container">
                                <div className="form-group">
                                    <label>Nombre del Producto *</label>
                                    <input 
                                        type="text" 
                                        value={editingProduct.name} 
                                        onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} 
                                        placeholder="Nombre del producto (máximo 100 caracteres)"
                                        maxLength="100"
                                        required 
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Precio *</label>
                                    <input 
                                        type="number" 
                                        value={editingProduct.price} 
                                        onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} 
                                        placeholder="Precio (mayor a 0)"
                                        min="0.01"
                                        step="0.01"
                                        required 
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Categoría *</label>
                                    <select 
                                        value={editingProduct.category} 
                                        onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                                        required
                                    >
                                        <option value="Producto">Producto</option>
                                        <option value="Insumo">Insumo</option>
                                    </select>
                                </div>
                                
                                <div className="form-group">
                                    <label>Stock Inicial</label>
                                    <input 
                                        type="number" 
                                        value={editingProduct.stock} 
                                        onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} 
                                        placeholder="Stock inicial (0 o mayor)"
                                        min="0"
                                        required 
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Descripción</label>
                                    <textarea 
                                        value={editingProduct.description} 
                                        onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                                        placeholder="Descripción del producto (opcional)"
                                        rows="3"
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label>Umbral de Stock Bajo *</label>
                                    <input 
                                        type="number" 
                                        value={editingProduct.lowStockThreshold} 
                                        onChange={e => setEditingProduct({...editingProduct, lowStockThreshold: parseInt(e.target.value)})} 
                                        placeholder="Nivel de stock para mostrar alertas (0 o mayor)"
                                        min="0"
                                        required 
                                    />
                                    <small className="form-helper-text">
                                        Cantidad mínima de stock antes de mostrar alertas en el Dashboard
                                    </small>
                                </div>
                                
                                <div className="button-group">
                                    <button type="submit" className="action-button primary">
                                        Guardar Cambios
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="action-button secondary"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteProduct}
                                        className="action-button delete"
                                    >
                                        {confirmDelete ? "Confirmar Eliminación" : "Eliminar Producto"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    
                    <div className="manage-all-products">
                        <button 
                            onClick={handleDeleteAllProducts}
                            className="action-button delete-all"
                            disabled={newProducts.length === 0}
                        >
                            {deleteAllConfirm ? "Confirmar Eliminación de Todos" : "Eliminar Todos los Productos Sin Ventas"}
                        </button>
                    </div>
            </div>
        )};

        const LowStockReport = () => {
            const [productId, setProductId] = useState('');
            const [message, setMessage] = useState('');
            const [notification, setNotification] = useState('');
        
            const handleSubmit = async (e) => {
                e.preventDefault();
                if (!productId || !message) {
                    setNotification('Por favor, selecciona un producto y escribe un mensaje.');
                    return;
                }
                try {
                    await api.post('/low-stock-reports/create/', {
                        product: productId,
                        message: message,
                    });
                    setNotification('Reporte enviado con éxito.');
                    setProductId('');
                    setMessage('');
                } catch (error) {
                    setNotification('Error al enviar el reporte.');
                    console.error('Error submitting low stock report:', error);
                }
            };
        
            return (
                <div className="management-container">
                    <h2>Reportar Faltantes o Bajo Stock</h2>
                    {notification && <p className="message">{notification}</p>}
                    <form onSubmit={handleSubmit} className="form-container">
                        <Select
                            options={products.map(p => ({ value: p.id, label: `${p.name} (Stock: ${p.stock})` }))}
                            onChange={(option) => setProductId(option ? option.value : '')}
                            placeholder="Selecciona un producto"
                            isClearable
                        />
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mensaje para el gerente (ej: se necesita con urgencia, se acabó, etc.)"
                            rows="4"
                            required
                        />
                        <button type="submit" className="action-button primary">Enviar Reporte</button>
                    </form>
                </div>
            );
        };
        
        const ViewLowStockReports = () => {
            const [reports, setReports] = useState([]);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');
        
            useEffect(() => {
                const fetchReports = async () => {
                    try {
                        const response = await api.get('/low-stock-reports/');
                        setReports(response.data);
                    } catch (err) {
                        setError('No se pudieron cargar los reportes.');
                        console.error('Error fetching low stock reports:', err);
                    } finally {
                        setLoading(false);
                    }
                };
                fetchReports();
            }, []);
        
            const handleResolve = async (reportId) => {
                try {
                    await api.patch(`/low-stock-reports/${reportId}/update/`, { is_resolved: true });
                    setReports(reports.map(r => r.id === reportId ? { ...r, is_resolved: true } : r));
                } catch (err) {
                    setError('Error al marcar como resuelto.');
                    console.error('Error resolving report:', err);
                }
            };
        
            if (loading) return <div>Cargando reportes...</div>;
            if (error) return <div className="error-message">{error}</div>;

            return (
                <div className="management-container">
                    <h2>Reportes de Faltantes y Bajo Stock</h2>
                    <ul className="list-container">
                        {reports.map(report => (
                            <li key={report.id} className={`list-item ${report.is_resolved ? 'resolved' : ''}`}>
                                <div className="report-info">
                                    <strong>Producto:</strong> {report.product_name} <br />
                                    <strong>Reportado por:</strong> {report.reported_by} el {new Date(report.created_at).toLocaleString()} <br />
                                    <strong>Mensaje:</strong> {report.message}
                                </div>
                                <div className="report-actions">
                                    {report.is_resolved ? (
                                        <span>Resuelto</span>
                                    ) : (
                                        <button onClick={() => handleResolve(report.id)} className="action-button primary">Marcar como Resuelto</button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        };

    // Renderiza el componente de la página actual según el estado.
    const renderPage = () => {
        if (!isLoggedIn) {
            return <Login />;
        }

        // Defensive: ensure currentPage is a known page when logged in to avoid falling
        // into the default case which renders the "Página no encontrada." message
        const validPages = new Set(['dashboard','inventario','ventas','productos','gestión de usuarios','proveedores','compras','pedidos','consultas', 'datos de mi usuario', 'editar productos','login', 'reportar faltantes', 'ver reportes de faltantes']);
        let pageToRender = currentPage;
        if (!validPages.has(String(currentPage))) {
            console.warn('⚠️ currentPage inválido detectado, forzando a dashboard:', currentPage);
            pageToRender = 'dashboard';
        }

        switch (pageToRender) {
            case 'dashboard':
                return <Dashboard />;
            case 'inventario':
                return <InventoryView />;
            case 'ventas':
                return <SalesView />;
          
            case 'productos':
                return userRole === 'Gerente' ? <ProductCreationView /> : <div>Acceso Denegado</div>;
            case 'gestión de usuarios':
                return userRole === 'Gerente' ? <UserManagement /> : <div>Acceso Denegado</div>;
            case 'proveedores':
                return userRole === 'Gerente' ? <SupplierManagement /> : <div>Acceso Denegado</div>;
            case 'compras':
                return ['Gerente', 'Encargado'].includes(userRole) ? 
                    <PurchaseManagement 
                        userRole={userRole} 
                        inventory={inventory}
                        suppliers={suppliers}
                        products={products}
                        purchases={purchases}
                        reloadPurchases={fetchPurchases}
                    /> : <div>Acceso Denegado</div>;
            case 'pedidos':
                return userRole === 'Gerente' ? <OrderManagement /> : <div>Acceso Denegado</div>;
            case 'consultas':
                return <DataConsultation 
                    api={api}
                    getInMemoryToken={getInMemoryToken}
                    loadSales={loadSales}
                    loadCashMovements={loadCashMovements}
                    inventory={inventory}
                    suppliers={suppliers}
                    purchases={purchases}
                    orders={orders}
                    cashMovements={cashMovements}
                    sales={sales}
                    headerTranslationMap={headerTranslationMap}
                    safeToFixed={safeToFixed}
                />;
            case 'datos de mi usuario':
                return <MyUserData />;
            case 'editar productos':
                return userRole === 'Gerente' ? <EditNewProducts /> : <div>Acceso Denegado</div>;
            case 'reportar faltantes':
                return <LowStockReport />;
            case 'ver reportes de faltantes':
                return userRole === 'Gerente' ? <ViewLowStockReports /> : <div>Acceso Denegado</div>;
            default:
                return <div>Página no encontrada.</div>;
        }
    };

    useEffect(() => {
      if (isLoggedIn) {
        // Verificación especial para Safari - asegurar que el token esté disponible
    const token = getInMemoryToken();
        if (!token) {
          console.log('⚠️ No hay token disponible, esperando...');
          // Reintentar en 200ms para Safari
                    setTimeout(() => {
                        const retryToken = getInMemoryToken();
            if (retryToken && isLoggedIn) {
              loadUsers();
              loadProducts();
              console.log('🔐 Usuario logueado - cargando usuarios y productos del servidor (retry)');
            }
          }, 200);
          return;
        }
        
        // Cargar datos del servidor
        loadUsers();
        loadProducts();
        console.log('🔐 Usuario logueado - cargando usuarios y productos del servidor');
      }
    }, [isLoggedIn]);

    // Sincronización periódica de productos (cada 5 minutos, muy cuidadosa)
    useEffect(() => {
      let interval = null;
      let registerInteraction = null;
      
      if (isLoggedIn) {
        // Registrar interacciones del usuario para pausar sincronización
        registerInteraction = () => {
          window.lastUserInteraction = Date.now();
        };
        
        // Escuchar eventos de interacción
        document.addEventListener('click', registerInteraction);
        document.addEventListener('keydown', registerInteraction);
        document.addEventListener('input', registerInteraction);
        document.addEventListener('change', registerInteraction);
        
        interval = setInterval(() => {
          // Verificaciones múltiples para no interrumpir al usuario
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
          );
          
          // Verificar si hay formularios abiertos, modales, o consultas en progreso
          const hasOpenForms = document.querySelector('.form-container:not([style*="display: none"])') ||
                               document.querySelector('.modal-overlay') ||
                               document.querySelector('.tab-content') ||
                               document.querySelector('[class*="show"]') ||
                               document.querySelector('.consultation-results') ||
                               document.querySelector('.purchase-item') ||
                               document.querySelector('.order-item') ||
                               document.querySelector('.query-results'); // Proteger resultados de consulta
          
          // Verificar si estamos en la página de consultas con resultados
          const isInConsultationPage = currentPage === 'consultas';
          const hasQueryResults = document.querySelector('.query-results');
          
          // Verificar si el usuario ha interactuado recientemente (últimos 2 minutos)
          const lastInteraction = window.lastUserInteraction || 0;
          const now = Date.now();
          const recentInteraction = now - lastInteraction < 120000; // 2 minutos
          
          if (!isTyping && !hasOpenForms && !recentInteraction && !(isInConsultationPage && hasQueryResults)) {
            loadProducts();
            console.log('🔄 Sincronización automática de productos');
          } else {
            console.log('⏸️ Sincronización pausada - usuario activo:', {
              typing: isTyping,
              forms: !!hasOpenForms,
              recent: recentInteraction,
              consultingData: !!(isInConsultationPage && hasQueryResults)
            });
          }
        }, 300000); // 5 minutos
      }

      return () => {
        if (interval) {
          clearInterval(interval);
        }
        // Limpiar event listeners si existen
        if (registerInteraction) {
          document.removeEventListener('click', registerInteraction);
          document.removeEventListener('keydown', registerInteraction);
          document.removeEventListener('input', registerInteraction);
          document.removeEventListener('change', registerInteraction);
        }
      };
    }, [isLoggedIn, currentPage]);    // Sincronización cuando la ventana recupera el foco (menos agresiva)

    // Marcar productos que tienen ventas para que no sean considerados "sin ventas"
    // Depende solo de `sales`. Usamos un update funcional y solo aplicamos setProducts
    // cuando realmente cambie la bandera `hasSales`, para evitar bucles de render.
    useEffect(() => {
        if (!Array.isArray(sales) || sales.length === 0) return;

        // Construir set de nombres de producto que aparecen en las ventas
        const soldProductNames = new Set();
        sales.forEach(s => {
            const items = Array.isArray(s.sale_items) && s.sale_items.length ? s.sale_items : (Array.isArray(s.items) ? s.items : []);
            items.forEach(it => {
                const name = (it && (it.product_name || it.product || it.productName)) || '';
                if (name) soldProductNames.add(String(name).trim());
            });
        });

        setProducts(prev => {
            if (!Array.isArray(prev) || prev.length === 0) return prev;
            // Construir nuevo array pero solo cambiar si alguna bandera difiere
            let changed = false;
            const next = prev.map(p => {
                const shouldHaveSales = soldProductNames.has(p.name) || !!p.hasSales;
                if (shouldHaveSales !== !!p.hasSales) changed = true;
                return shouldHaveSales !== !!p.hasSales ? { ...p, hasSales: shouldHaveSales } : p;
            });
            return changed ? next : prev;
        });
    }, [sales]);
    useEffect(() => {
      const handleFocus = () => {
        if (isLoggedIn) {
          // Solo sincronizar si no hay formularios abiertos o inputs activos
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
          );
          
          // Verificar si hay formularios, modales abiertos o resultados de consulta
          const hasOpenForms = document.querySelector('.form-container:not([style*="display: none"])') ||
                               document.querySelector('.modal-overlay') ||
                               document.querySelector('.tab-content') ||
                               document.querySelector('[class*="show"]') ||
                               document.querySelector('.query-results'); // Proteger resultados de consulta
          
          // Verificar si estamos en la página de consultas con resultados
          const isInConsultationPage = currentPage === 'consultas';
          const hasQueryResults = document.querySelector('.query-results');
          
          if (!isTyping && !hasOpenForms && !(isInConsultationPage && hasQueryResults)) {
            // Solo sincronizar productos cada 30 segundos como máximo al enfocar
            const lastSync = window.lastFocusSync || 0;
            const now = Date.now();
            
            if (now - lastSync > 30000) { // 30 segundos
              loadProducts();
              window.lastFocusSync = now;
              console.log('👁️ Ventana enfocada - sincronizando productos (sin formularios abiertos)');
            } else {
              console.log('⏸️ Sincronización saltada - muy reciente o usuario trabajando');
            }
          } else {
            console.log('⏸️ Sincronización pausada - usuario interactuando con formularios o consultando datos');
          }
        }
      };

      const handleVisibilityChange = () => {
        if (!document.hidden && isLoggedIn) {
          // Aplicar la misma lógica que handleFocus
          const activeElement = document.activeElement;
          const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
          );
          
          const hasOpenForms = document.querySelector('.form-container:not([style*="display: none"])') ||
                               document.querySelector('.modal-overlay') ||
                               document.querySelector('.tab-content') ||
                               document.querySelector('[class*="show"]') ||
                               document.querySelector('.query-results'); // Proteger resultados de consulta
          
          // Verificar si estamos en la página de consultas con resultados
          const isInConsultationPage = currentPage === 'consultas';
          const hasQueryResults = document.querySelector('.query-results');
          
          if (!isTyping && !hasOpenForms && !(isInConsultationPage && hasQueryResults)) {
            const lastSync = window.lastVisibilitySync || 0;
            const now = Date.now();
            
            if (now - lastSync > 30000) { // 30 segundos
              loadProducts();
              window.lastVisibilitySync = now;
              console.log('👁️ Pestaña visible - sincronizando productos (sin formularios abiertos)');
            }
          } else {
            console.log('⏸️ Sincronización pausada - usuario trabajando o consultando datos');
          }
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [isLoggedIn, currentPage]);

    if (!sessionChecked) {
        return (
            <div className="app-loading" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
                <div style={{textAlign: 'center'}}>
                    <div style={{fontSize: 18, marginBottom: 8}}>Comprobando sesión...</div>
                    <div style={{fontSize: 12, color: '#666'}}>Si esto tarda mucho, confirma que el backend esté corriendo.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Panel de desarrollo "DEV STATUS" eliminado para UI limpia. */}
            {showModal && <LockedAccountModal />}
            {isLoggedIn && <Navbar />}
            {renderPage()}
        </div>
    );
    };

export default App;