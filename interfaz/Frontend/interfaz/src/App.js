import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import './App.css';
import { formatMovementDate } from './utils/date';
import api, { backendLogin, backendLogout, setInMemoryToken, clearInMemoryToken, getInMemoryToken, getPendingPurchases, approvePurchase, rejectPurchase, getPurchaseHistory, getRecipe, addRecipeIngredient, updateRecipeIngredient, deleteRecipeIngredient, getIngredients, getIngredientsWithSuggestedUnit, updateOrderStatus } from './services/api';
import userStorage from './services/userStorage';
import DataConsultation from './DataConsultation';
import MyUserData from './components/MyUserData';
import ForgotPassword from './components/ForgotPassword';
import PurchaseManagement from './components/PurchaseManagement';
import Proveedores from './components/Proveedores';
import PurchaseRequests from './components/PurchaseRequests';
import PurchaseHistory from './components/PurchaseHistory';
import ProductManagement from './components/ProductManagement';
import LossManagement from './components/LossManagement';
import UserManagement from './components/UserManagement';
import Registrar_Venta from './components/Registrar_Venta';
import Movimientos_De_Caja from './components/Movimientos_De_Caja';
import Pedidos from './components/Pedidos';
import PedDialogo from './components/PedDialogo';
import Edicion from './components/Edicion';
import Ver_Reportes_De_Faltantes from './components/Ver_Reportes_De_Faltantes';



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

// Use shared formatMovementDate from ./utils/date
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
    'Gerente': ['Dashboard', 'Inventario', 'Gestión de Usuarios', 'Ventas', 'Pedidos', 'Productos', 'Edicion', 'Proveedores', 'Compras', 'Consultas', 'Ver Reportes de Faltantes'],
    'Panadero': ['Dashboard', 'Inventario', 'Ventas', 'Datos de mi Usuario', 'Reportar Faltantes'],
    'Encargado': ['Dashboard', 'Inventario', 'Ventas', 'Compras', 'Datos de mi Usuario', 'Gestión de Pérdidas'],
    'Cajero': ['Dashboard', 'Ventas', 'Inventario', 'Datos de mi Usuario', 'Reportar Faltantes'],
  };

// Componente principal de la aplicación.
const App = () => {
    
    // Capturar errores de render
    try {
    
    // (cashSortOrder es manejado localmente dentro de SalesView)
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
                    // Almacenamiento limpiado exitosamente
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
    
    // Monitorear cambios en sessionChecked
    useEffect(() => {
        // Monitor de cambios en sessionChecked
    }, [sessionChecked]);


    
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

        // Solo ejecutar si sessionChecked es false (primera vez)
        if (!sessionChecked) {
            tryRestore();
        }

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
    }, []); // Quitar sessionChecked de las dependencias para evitar loop
    const [loginError, setLoginError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(() => {
        const saved = sessionStorage.getItem('failedAttempts');
        return saved ? parseInt(saved, 10) : 0;
    });
    const [isLocked, setIsLocked] = useState(() => {
        const saved = sessionStorage.getItem('isLocked');
        return saved === 'true';
    });
    const [lockType, setLockType] = useState(() => {
        return sessionStorage.getItem('lockType') || '';
    });
    const [showModal, setShowModal] = useState(false);
    const [currentEmail, setCurrentEmail] = useState(() => {
        return sessionStorage.getItem('currentEmail') || '';
    });
    const maxAttempts = 5;
    
    // Preservar estado crítico en sessionStorage para resistir remontajes de HMR
    useEffect(() => {
        sessionStorage.setItem('failedAttempts', failedAttempts.toString());
        console.log('🔄 failedAttempts cambió a:', failedAttempts, '- Guardado en sessionStorage');
    }, [failedAttempts]);
    
    useEffect(() => {
        sessionStorage.setItem('isLocked', isLocked.toString());
        console.log('🔒 isLocked cambió a:', isLocked, '- Guardado en sessionStorage');
    }, [isLocked]);
    
    useEffect(() => {
        sessionStorage.setItem('lockType', lockType);
        console.log('🔐 lockType cambió a:', lockType, '- Guardado en sessionStorage');
    }, [lockType]);
    
    useEffect(() => {
        sessionStorage.setItem('currentEmail', currentEmail);
        console.log('📧 currentEmail cambió a:', currentEmail, '- Guardado en sessionStorage');
    }, [currentEmail]);
    
    // Verificar si se alcanzó el máximo de intentos y bloquear automáticamente
    useEffect(() => {
        if (failedAttempts >= maxAttempts && !isLocked) {
            console.log('🚫 Máximo de intentos alcanzado, bloqueando cuenta');
            setIsLocked(true);
            // NO mostrar modal, solo usar el texto de error en el formulario
        }
    }, [failedAttempts, maxAttempts, isLocked]);
    
    // Monitorear cambios en isLoggedIn
    useEffect(() => {
        console.log('🔐 isLoggedIn cambió a:', isLoggedIn);
    }, [isLoggedIn]);
     
    // Estado para el rol del usuario actualmente autenticado.
    const [userRole, setUserRole] = useState(null);
    // Estado para el ID del usuario actual
    const [currentUserId, setCurrentUserId] = useState(null);
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
    
    // Funciones para manejar el diálogo de pedidos
    const handleOpenPedDialogo = () => {
        setIsPedDialogoOpen(true);
        setIsPedDialogoMinimized(false);
    };
    
    const handleClosePedDialogo = () => {
        setIsPedDialogoOpen(false);
        setIsPedDialogoMinimized(false);
    };
    
    const handleMinimizePedDialogo = () => {
        setIsPedDialogoMinimized(!isPedDialogoMinimized);
    };
    
    const handleOpenPedDialogoNewTab = () => {
        const url = `${window.location.origin}${window.location.pathname}?pedidos-fullscreen=true`;
        window.open(url, '_blank');
    };

    // Permitir abrir el diálogo desde cualquier componente usando un evento global
    React.useEffect(() => {
        const openDialog = () => handleOpenPedDialogo();
        window.addEventListener('openPedDialogo', openDialog);
        return () => window.removeEventListener('openPedDialogo', openDialog);
    }, []);
    
    // Cerrar el diálogo de pedidos cuando se cambia de página
    React.useEffect(() => {
        if (isPedDialogoOpen && !isPedDialogoFullscreen) {
            handleClosePedDialogo();
        }
    }, [currentPage]);
    // ...existing code...

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
        // NO llamar preventDefault aquí ya que se llama en onSubmit
        console.log('🔐 handleLogin llamado con:', { email: userEmail });
        console.log('🔢 failedAttempts al inicio de handleLogin:', failedAttempts);
        
        // Verificar si el email cambió y resetear intentos si es necesario
        if (userEmail && userEmail !== currentEmail) {
            console.log('📧 Email cambió de', currentEmail, 'a', userEmail, '- Reseteando intentos fallidos');
            setCurrentEmail(userEmail);
            setFailedAttempts(0);
            setIsLocked(false);
            setLockType('');
            setShowModal(false);
            // Limpiar sessionStorage del estado anterior
            sessionStorage.removeItem('failedAttempts');
            sessionStorage.removeItem('isLocked');
            sessionStorage.removeItem('lockType');
        }
        
        try {
            setLoginError('');
            
            // Limpiar estado de bloqueo del sessionStorage ANTES de cada intento
            // El servidor es la única fuente de verdad - si está bloqueado, el servidor responderá con error
            sessionStorage.removeItem('isLocked');
            sessionStorage.removeItem('lockType');
            setIsLocked(false);
            setLockType('');
            
            // Validaciones mínimas
            if (!userEmail || !userPassword) {
                setLoginError('Debes ingresar email y contraseña');
                // NO incrementar failedAttempts para validaciones de frontend
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

            // Resetear intentos fallidos y bloqueo al login exitoso
            setFailedAttempts(0);
            setIsLocked(false);
            setLockType('');
            
            // Limpiar estado crítico de sessionStorage al login exitoso
            sessionStorage.removeItem('failedAttempts');
            sessionStorage.removeItem('isLocked');
            sessionStorage.removeItem('lockType');
            sessionStorage.removeItem('currentEmail');
            setCurrentEmail('');
            
            // Limpiar TODO localStorage de lockTypes al login exitoso
            try {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('lockType_')) {
                        localStorage.removeItem(key);
                    }
                });
            } catch (e) {
                console.error('Error limpiando localStorage en login exitoso:', e);
            }
            
            // Limpiar lockType de localStorage para este usuario
            try {
                localStorage.removeItem('lockType_' + userEmail);
            } catch (e) {}
            
            setIsLoggedIn(true);
            const roleFromResp = resp?.data?.user?.role || resp?.data?.role || (resp?.data?.user && resp.data.user.role) || 'Gerente';
            const userIdFromResp = resp?.data?.user?.id || resp?.data?.id || null;
            setUserRole(roleFromResp);
            setCurrentUserId(userIdFromResp);
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
            
            // Manejar errores específicos del backend
            const errorData = error?.response?.data?.error;
            console.log('🔍 DEBUG - errorData completo:', JSON.stringify(errorData, null, 2));
            console.log('🔍 DEBUG - error.response.data:', JSON.stringify(error?.response?.data, null, 2));
            if (errorData) {
                // Actualizar intentos fallidos desde el backend
                if (typeof errorData.failed_attempts === 'number') {
                    console.log('🔢 Actualizando intentos fallidos desde backend:', errorData.failed_attempts);
                    setFailedAttempts(errorData.failed_attempts);
                } else {
                    console.log('🔢 Incrementando intentos fallidos localmente');
                    setFailedAttempts(prev => {
                        const newValue = prev + 1;
                        console.log('🔢 Nuevos intentos fallidos:', newValue);
                        return newValue;
                    });
                }
                
                // Verificar si la cuenta está bloqueada
                if (errorData.code === 'account_locked') {
                    console.log('🔒 Cuenta bloqueada detectada');
                    console.log('🔍 DEBUG - error.response.data COMPLETO:', JSON.stringify(error?.response?.data, null, 2));
                    console.log('🔍 DEBUG - errorData.lock_type RAW:', errorData.lock_type);
                    console.log('🔍 DEBUG - tipo:', typeof errorData.lock_type);
                    console.log('🔍 DEBUG - errorData.lock_type === null?:', errorData.lock_type === null);
                    console.log('🔍 DEBUG - errorData.lock_type === undefined?:', errorData.lock_type === undefined);
                    setIsLocked(true);
                    
                    // Si lock_type es null, undefined o vacío, usar 'automatic'
                    let lockTypeFromServer = errorData.lock_type;
                    if (!lockTypeFromServer || lockTypeFromServer === null || lockTypeFromServer === undefined || lockTypeFromServer === '') {
                        console.warn('⚠️ lock_type es null/undefined/vacío, usando automatic');
                        lockTypeFromServer = 'automatic';
                    }
                    
                    console.log('🔍 DEBUG - lockTypeFromServer FINAL:', lockTypeFromServer);
                    console.log('🔍 DEBUG - lockTypeFromServer === "manual"?:', lockTypeFromServer === 'manual');
                    console.log('🔍 DEBUG - String(lockTypeFromServer):', String(lockTypeFromServer));
                    
                    // Normalizar el lockType antes de guardarlo
                    const lockTypeStr = String(lockTypeFromServer).toLowerCase().trim();
                    console.log('🔍 DEBUG - lockTypeStr normalizado:', lockTypeStr);
                    setLockType(lockTypeStr);
                    
                    if (lockTypeStr === 'manual') {
                        console.log('✅ Mostrando mensaje MANUAL');
                        setLoginError('🔒 Tu cuenta ha sido bloqueada por el administrador.');
                    } else {
                        console.log('⚠️ Mostrando mensaje AUTOMÁTICO (lockType=' + lockTypeStr + ')');
                        setLoginError('🔒 Cuenta bloqueada por múltiples intentos fallidos. Contacte al administrador para desbloquearla.');
                    }
                } else if (errorData.code === 'invalid_credentials') {
                    // Mostrar solo "Credenciales inválidas" sin mencionar intentos (ya tenemos el contador)
                    setLoginError('❌ Credenciales inválidas');
                } else if (errorData.code === 'inactive') {
                    setLoginError('La cuenta está inactiva. Contacte al administrador.');
                } else {
                    setLoginError(errorData.message || 'Error iniciando sesión');
                }
            } else if (error.response && error.response.status === 401) {
                console.log('🔢 Error 401 - Incrementando intentos');
                setFailedAttempts(prev => prev + 1);
                setLoginError('Credenciales inválidas');
            } else if (error.response && error.response.status === 403) {
                console.log('🔢 Error 403 - Incrementando intentos');
                setFailedAttempts(prev => prev + 1);
                setLoginError('Acceso denegado. Verifica tus credenciales.');
            } else {
                console.log('🔢 Error genérico - Incrementando intentos');
                setFailedAttempts(prev => prev + 1);
                setLoginError('Error iniciando sesión. Revisa la consola.');
            }
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
    
    // Estados para el diálogo de pedidos
    const [isPedDialogoOpen, setIsPedDialogoOpen] = useState(false);
    const [isPedDialogoMinimized, setIsPedDialogoMinimized] = useState(false);
    const [isPedDialogoFullscreen, setIsPedDialogoFullscreen] = useState(false);
    
    // Detectar parámetro URL para modo fullscreen
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('pedidos-fullscreen') === 'true') {
            setIsPedDialogoFullscreen(true);
            setIsPedDialogoOpen(true);
            // Si el usuario ya tiene sesión activa, evitar mostrar login
            if (isLoggedIn) {
                setCurrentPage('pedidos');
            }
        }
    }, [isLoggedIn]);

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

    // Cargar compras desde el backend al iniciar sesión
    useEffect(() => {
        if (isLoggedIn) {
            // Solo Gerente puede ver compras pendientes de aprobación
            if (userRole === 'Gerente') {
                fetchPurchases();
            }
            // Gerente y Encargado pueden ver el historial de compras
            if (userRole === 'Gerente' || userRole === 'Encargado') {
                fetchPurchaseHistory();
            }
        }
    }, [isLoggedIn, userRole]);
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
                        fecha_para_la_que_se_quiere_el_pedido: o.fecha_para_la_que_se_quiere_el_pedido,
                        fecha_de_orden_del_pedido: o.fecha_de_orden_del_pedido,
                        customerName: o.customer_name || o.customerName || '',
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

    // Estado para indicar cuando se están cargando productos
    const [isLoading, setIsLoading] = useState(false);

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
            console.log('👥 loadUsersFromBackend llamado - iniciando carga...');
            const response = await api.get('/users/');
            if (response.data) {
                // Transformar datos del backend para compatibilidad con componentes nuevos y antiguos
                const backendUsers = response.data.map(user => ({
                    id: user.id,
                    // Para compatibilidad con componentes antiguos
                    name: user.username,
                    // Para componentes nuevos con Tailwind
                    username: user.username,
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    email: user.email,
                    // Mantener objeto role completo para componente nuevo
                    role: user.role || { name: 'Cajero' },
                    is_active: user.is_active,
                    is_locked: user.is_locked || false, // Incluir estado de bloqueo
                    failed_login_attempts: user.failed_login_attempts || 0, // Intentos fallidos
                    locked_at: user.locked_at || null, // Fecha de bloqueo
                    hashedPassword: 'backend-managed' // Password manejado por backend
                }));
                console.log('👥 setUsers llamado con', backendUsers.length, 'usuarios');
                try {
                    setUsers(backendUsers);
                    // setUsers ejecutado exitosamente
                } catch (error) {
                    console.error('❌ Error en setUsers:', error);
                    throw error; // Re-throw para que se pueda investigar
                }
                // Usuarios cargados desde backend
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
                // Sincronizar inventario desde products

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
                    unit: product.unit,
                    type: product.category || 'Producto',
                    price: product.price,      // Ahora sí se incluye el precio
                    estado: product.estado,    // Y el estado si viene del backend
                    low_stock_threshold: product.lowStockThreshold, // Umbral procesado en loadProducts
                    lowStockThreshold: product.lowStockThreshold    // Compatibilidad con ambos nombres
                }));

                console.log('🎯 Inventario sincronizado:', newInventory?.length ? `${newInventory.length} productos` : 'Array vacío');

                setInventory(newInventory);
        }, [products]);

    // Función para cerrar la sesión.
    const handleLogout = async (preserveErrorMessage = false) => {
        // Llamar al backend para que borre cookies / invalide refresh
        try {
            try { await backendLogout(); } catch (e) { /* continuar limpiando aun si falla el backend */ }
        } catch (e) {
            // no-op
        }

        // Limpiar estado local de la app
        setIsLoggedIn(false);
        setUserRole(null);
        setCurrentUserId(null);
        setCurrentPage('login');
        setEmail('');
        setPassword('');
        // Solo limpiar el error si no se solicita preservar
        if (!preserveErrorMessage) {
            setLoginError('');
        }
        setFailedAttempts(0);  // Resetear intentos fallidos
        setIsLocked(false);    // Desbloquear cuenta
        setLockType('');       // Limpiar tipo de bloqueo
        setShowModal(false);   // Cerrar modal
        
        // Limpiar estado crítico de sessionStorage al logout
        sessionStorage.removeItem('failedAttempts');
        sessionStorage.removeItem('isLocked');
        sessionStorage.removeItem('lockType');
        sessionStorage.removeItem('currentEmail');
        setCurrentEmail('');

        // Limpiar almacenamiento local y token en memoria
        try { await removeAccessToken(); } catch (e) {}
        try { clearInMemoryToken(); } catch (e) {}
        try { localStorage.removeItem('access'); localStorage.removeItem('refresh'); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}

        // Notificar a otras pestañas que se ha cerrado la sesión
        try {
            // Usar un valor con timestamp para forzar el evento storage
            localStorage.setItem('app_logout', String(Date.now()));
        } catch (e) {}
    };

    // Función para manejar la navegación.
    const navigateTo = (page) => {
        setCurrentPage(page);
    };

    // Lógica para el modal de cuenta bloqueada
    const handleModalClose = () => {
        setShowModal(false);
    };

    // Escuchar eventos de storage para sincronizar logout entre pestañas
    useEffect(() => {
        const onStorage = (e) => {
            if (!e) return;
            if (e.key === 'app_logout') {
                // Otra pestaña hizo logout: limpiar estado aquí también
                try { clearInMemoryToken(); } catch (err) {}
                try { localStorage.removeItem('access'); localStorage.removeItem('refresh'); } catch (err) {}
                try { sessionStorage.clear(); } catch (err) {}
                setIsLoggedIn(false);
                setUserRole(null);
                setCurrentPage('login');
            }
            // Escuchar evento de bloqueo de cuenta (para otras pestañas)
            if (e.key === 'account_locked' && e.newValue) {
                const lockData = JSON.parse(e.newValue);
                // Si el usuario bloqueado coincide con el actual, cerrar sesión
                if (lockData.userId && lockData.userId === currentUserId && lockData.lockType === 'manual') {
                    setLoginError('🔒 Tu cuenta ha sido bloqueada por el administrador.');
                    handleLogout(true);
                }
            }
            // Escuchar evento de desbloqueo de cuenta (para otras pestañas)
            if (e.key === 'account_unlocked' && e.newValue) {
                console.log('🔓 Evento de desbloqueo detectado en storage');
                const unlockData = JSON.parse(e.newValue);
                
                // Solo recargar si el usuario desbloqueado es el usuario ACTUAL
                if (unlockData.userId && unlockData.userId === currentUserId) {
                    console.log('✅ El usuario desbloqueado soy YO (storage), recargando...');
                    // Limpiar TODO PRIMERO
                    try {
                        const keys = Object.keys(localStorage);
                        keys.forEach(key => {
                            if (key.startsWith('lockType_')) {
                                localStorage.removeItem(key);
                            }
                        });
                    } catch (err) {}
                    sessionStorage.clear();
                    
                    // Forzar recarga COMPLETA sin cache
                    window.location.href = window.location.origin + window.location.pathname + '?_t=' + Date.now();
                } else {
                    console.log('ℹ️ El usuario desbloqueado NO soy yo (storage), ignorando evento');
                }
            }
        };
        
        // Escuchar CustomEvent para bloqueo en la misma pestaña (inmediato)
        const onUserLocked = (e) => {
            const lockData = e.detail;
            if (lockData.userId && lockData.userId === currentUserId && lockData.lockType === 'manual') {
                setLoginError('🔒 Tu cuenta ha sido bloqueada por el administrador.');
                handleLogout(true);
            }
        };
        
        // Escuchar CustomEvent para desbloqueo
        const onUserUnlocked = (e) => {
            const unlockData = e.detail;
            console.log('🔓 CustomEvent de desbloqueo recibido:', unlockData);
            
            // Solo recargar si el usuario desbloqueado es el usuario ACTUAL (no el gerente)
            if (unlockData.userId && unlockData.userId === currentUserId) {
                console.log('✅ El usuario desbloqueado soy YO, recargando...');
                // Limpiar TODO localStorage y sessionStorage PRIMERO
                try {
                    const keys = Object.keys(localStorage);
                    keys.forEach(key => {
                        if (key.startsWith('lockType_')) {
                            localStorage.removeItem(key);
                        }
                    });
                } catch (e) {}
                sessionStorage.clear();
                
                // Forzar recarga COMPLETA sin cache
                window.location.href = window.location.origin + window.location.pathname + '?_t=' + Date.now();
            } else {
                console.log('ℹ️ El usuario desbloqueado NO soy yo, ignorando evento');
            }
        };
        
        window.addEventListener('storage', onStorage);
        window.addEventListener('userAccountLocked', onUserLocked);
        window.addEventListener('userAccountUnlocked', onUserUnlocked);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('userAccountLocked', onUserLocked);
            window.removeEventListener('userAccountUnlocked', onUserUnlocked);
        };
    }, [currentUserId]);
    
    // Verificar periódicamente si el usuario fue bloqueado (cada 60 segundos como respaldo)
    useEffect(() => {
        if (!isLoggedIn) return;
        
        const checkUserStatus = async () => {
            try {
                const response = await api.get('/users/me/');
                if (response.data.is_locked) {
                    // Usuario fue bloqueado, cerrar sesión
                    const lockTypeFromServer = response.data.lock_type || 'automatic';
                    if (lockTypeFromServer === 'manual') {
                        setLoginError('🔒 Tu cuenta ha sido bloqueada por el administrador.');
                    } else {
                        setLoginError('🔒 Cuenta bloqueada por múltiples intentos fallidos. Contacte al administrador para desbloquearla.');
                    }
                    await handleLogout(true);
                }
            } catch (error) {
                // Si hay error 401 o 403, la sesión ya no es válida
                if (error?.response?.status === 401 || error?.response?.status === 403) {
                    await handleLogout();
                }
            }
        };
        
        // Verificar cada 3 segundos para detección rápida de bloqueos
        const interval = setInterval(checkUserStatus, 3000);
        
        return () => clearInterval(interval);
    }, [isLoggedIn]);
     
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
        setLockType('');
        setShowModal(false);
        setLoginError('');
        
        // Limpiar estado crítico de sessionStorage al reintentar
        sessionStorage.removeItem('failedAttempts');
        sessionStorage.removeItem('isLocked');
        sessionStorage.removeItem('lockType');
        sessionStorage.removeItem('currentEmail');
        setCurrentEmail('');
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
                        // Para compatibilidad con componentes antiguos
                        name: u.username ?? u.name ?? (typeof u === 'string' ? u : ''),
                        // Para componentes nuevos con Tailwind
                        username: u.username,
                        first_name: u.first_name || '',
                        last_name: u.last_name || '',
                        email: u.email ?? '',
                        // Mantener objeto role completo para componente nuevo
                        role: u.role || { name: 'Cajero' },
                        is_active: u.is_active ?? true,
                        is_locked: u.is_locked ?? false,
                        failed_login_attempts: u.failed_login_attempts ?? 0,
                        locked_at: u.locked_at ?? null,
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

    const loadProducts = async (showLoading = true) => {
      try {
        if (showLoading) {
          setIsLoading(true);
        }
        const response = await api.get('/products/');
        const serverProducts = response.data;
        
        // Convertir productos del servidor al formato local
        const formattedProducts = serverProducts.map(product => ({
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category || 'Producto',
          stock: product.stock,
          unit: product.unit || '',
          description: product.description || '',
          status: 'Sincronizado',
          hasSales: false,
          lowStockThreshold: product.low_stock_threshold !== undefined && product.low_stock_threshold !== null ? product.low_stock_threshold : 10,
          highStockMultiplier: product.high_stock_multiplier !== undefined && product.high_stock_multiplier !== null ? product.high_stock_multiplier : 2.0,
          recipe_yield: product.recipe_yield || 1,
          is_ingredient: product.is_ingredient || false
        }));
        
        // Solo actualizar si hay diferencias para evitar re-renders innecesarios
        setProducts(prevProducts => {
          if (JSON.stringify(prevProducts) !== JSON.stringify(formattedProducts)) {
            // Productos actualizados exitosamente
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
        if (showLoading) {
          setIsLoading(false);
        }
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

      const onSubmit = async () => {
        console.log('🔐 Login clicked, calling handleLogin');
        console.log('🔢 Estado actual failedAttempts:', failedAttempts);
        await handleLogin(null, { email: emailInput, password: passwordInput });
        console.log('🔢 Estado después de handleLogin:', failedAttempts);
      };
      
      // Limpiar solo el mensaje de error cuando el usuario empieza a escribir
      // (pero mantener el contador de intentos visible)
      const handleEmailChange = (e) => {
        setEmailInput(e.target.value);
        // Solo limpiar el mensaje de error, NO los intentos fallidos
        if (loginError && !isLocked) setLoginError('');
      };
      
      const handlePasswordChange = (e) => {
        setPasswordInput(e.target.value);
        // Solo limpiar el mensaje de error, NO los intentos fallidos
        if (loginError && !isLocked) setLoginError('');
      };

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 p-3 sm:p-6 md:p-8">
          <div className="w-full max-w-[95%] sm:max-w-md md:max-w-lg lg:max-w-xl bg-white rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 lg:p-10 border border-gray-100 overflow-hidden">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center text-gray-800 mb-4 sm:mb-6 md:mb-8 break-words">
              🔐 Iniciar Sesión
            </h1>
            
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4 sm:space-y-5 md:space-y-6">
              <div className="space-y-1.5 sm:space-y-2 min-w-0">
                <label 
                  htmlFor="email" 
                  className="block text-xs sm:text-sm md:text-base font-semibold text-gray-700 truncate"
                >
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  id="email"
                  value={emailInput}
                  onChange={handleEmailChange}
                  onFocus={() => {
                    // NO limpiar el mensaje si es bloqueo manual
                    if (!(isLocked && lockType === 'manual')) {
                      setLoginError('');
                    }
                  }}
                  placeholder="ejemplo@email.com"
                  required
                  autoComplete="email"
                  className="w-full min-w-0 px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 lg:py-4 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 overflow-hidden text-ellipsis"
                />
              </div>
              
              <div className="space-y-1.5 sm:space-y-2 min-w-0">
                <label 
                  htmlFor="password" 
                  className="block text-xs sm:text-sm md:text-base font-semibold text-gray-700 truncate"
                >
                  Contraseña
                </label>
                <input
                  type="password"
                  id="password"
                  value={passwordInput}
                  onChange={handlePasswordChange}
                  onFocus={() => {
                    // NO limpiar el mensaje si es bloqueo manual
                    if (!(isLocked && lockType === 'manual')) {
                      setLoginError('');
                    }
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full min-w-0 px-3 py-2.5 sm:px-4 sm:py-3 md:py-3.5 lg:py-4 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 overflow-hidden text-ellipsis"
                />
              </div>
              
              {/* Mostrar contador de intentos (SIEMPRE visible, permanente) */}
              {!isLocked && (
                <div className={`my-2 sm:my-3 p-2.5 sm:p-3 md:p-4 rounded-lg text-center text-xs sm:text-sm md:text-base transition-all duration-200 overflow-hidden ${
                  failedAttempts > 0 
                    ? 'bg-yellow-50 border-2 border-yellow-400 text-yellow-800 font-bold' 
                    : 'bg-gray-50 border border-gray-300 text-gray-600'
                }`}>
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis block">
                    {failedAttempts > 0 ? '⚠️ ' : ''}Intentos fallidos: {failedAttempts} de {maxAttempts}
                  </span>
                </div>
              )}
              
              {/* Mostrar mensaje de error o bloqueo dinámicamente según el tipo */}
              {loginError && (
                <div className={`my-2 sm:my-3 p-3 sm:p-4 md:p-5 rounded-lg text-center text-xs sm:text-sm md:text-base overflow-hidden ${
                  isLocked 
                    ? 'bg-red-50 border-2 border-red-500 text-red-600 font-bold' 
                    : 'bg-red-50 border border-red-300 text-red-600'
                }`}>
                  <span className="block break-words">
                    {loginError}
                  </span>
                </div>
              )}
              
              {/* Formulario de login - sin funciones de test en producción */}
              <button 
                type="button"
                onClick={onSubmit}
                className="w-full py-2.5 sm:py-3 md:py-3.5 lg:py-4 px-4 sm:px-6 text-sm sm:text-base md:text-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 overflow-hidden whitespace-nowrap text-ellipsis"
              >
                ✓ Iniciar Sesión
              </button>
              
              <div className="mt-3 sm:mt-4 md:mt-5 text-center overflow-hidden">
                <button 
                  type="button" 
                  onClick={() => setCurrentPage('forgot-password')}
                  className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm md:text-base font-medium underline hover:no-underline transition-all duration-200 truncate inline-block max-w-full"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    };

    // Componente de la interfaz de navegación superior.
    const Navbar = () => {
        const itemsToShow = rolePermissions[userRole] || [];

        return (
            <nav className="navbar">
                <ul className="nav-list">
                    {itemsToShow.map(item => (
                        <li key={item}>
                            <button onClick={() => navigateTo(item.toLowerCase())} className={`nav-button ${currentPage === item.toLowerCase() ? 'active' : ''}`}>
                                {item}
                            </button>
                        </li>
                    ))}
                </ul>
                {/* Mostrar botón de cerrar sesión solo si está autenticado y no estamos en la pantalla pública de 'forgot-password' */}
                {(isLoggedIn && userRole && currentPage !== 'forgot-password') && (
                    <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
                )}
            </nav>
        );
    };



    // Componente del tablero (Dashboard).
    const Dashboard = () => {
        // Estados para manejar el colapso de las secciones
        const [showSuppliesAlerts, setShowSuppliesAlerts] = useState(false);
        const [showProductsAlerts, setShowProductsAlerts] = useState(false);

        // Obtener productos e insumos con stock bajo según su umbral personalizado
        // Comparar en la misma unidad base (gramos/ml/unidades)
        const lowStockItems = products.filter(product => {
            const threshold = product.lowStockThreshold || 10;
            // El stock ya está en unidad base, el threshold también debe estar en unidad base
            // (si el backend lo guardó correctamente)
            return product.stock < threshold;
        });

        // Separar productos e insumos para mejor organización
        const lowStockProducts = lowStockItems.filter(item => item.category === 'Producto');
        const lowStockSupplies = lowStockItems.filter(item => item.category === 'Insumo');

        // Calcular total de alertas
        const totalAlerts = lowStockProducts.length + lowStockSupplies.length;

        const formatStockDisplay = (stock, unit) => {
            const stockNum = parseFloat(stock);
            if (isNaN(stockNum)) {
                return `0 unid`;
            }

            let displayValue;
            let displayUnit;

            if (unit === 'g') {
                displayValue = stockNum / 1000;
                displayUnit = 'kilos';
            } else if (unit === 'ml') {
                displayValue = stockNum / 1000;
                displayUnit = 'litros';
            } else if (unit === 'kg') {
                displayValue = stockNum;
                displayUnit = 'kilos';
            } else if (unit === 'l') {
                displayValue = stockNum;
                displayUnit = 'litros';
            } else {
                displayValue = stockNum;
                displayUnit = 'unid';
            }

            // Format number to remove trailing zeros from decimals, up to 3 decimal places
            const formattedValue = Number(displayValue.toFixed(3));

            return `${formattedValue} ${displayUnit}`;
        };

        const formatThresholdDisplay = (threshold, unit) => {
            const thresholdNum = parseFloat(threshold) || 10;
            if (isNaN(thresholdNum)) {
                return `10`;
            }

            let displayValue;

            if (unit === 'g') {
                displayValue = thresholdNum / 1000;
            } else if (unit === 'ml') {
                displayValue = thresholdNum / 1000;
            } else {
                displayValue = thresholdNum;
            }

            return Number(displayValue.toFixed(3));
        };

        return (
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h2>Dashboard de {userRole}</h2>   
                       {/* 
                //totalAlerts > 0 && (
                //  <div className="total-alerts-badge">
                //    <span className="alert-icon">⚠️</span>
                //    <span className="alert-text">TOTAL ALERTAS</span>
                //    <span className="alert-count">{totalAlerts}</span>
                //  </div>
                //)
                */}
            </div>
    

                {['Gerente', 'Encargado', 'Panadero', 'Cajero'].includes(userRole) && (
                    <div className="alerts-wrapper">
                        {/* Sección de Insumos Faltantes */}
                        {lowStockSupplies.length > 0 && (
                            <div className="alert-category">
                                <button 
                                    className="alert-category-header"
                                    onClick={() => setShowSuppliesAlerts(!showSuppliesAlerts)}
                                >
                                    <div className="header-left">
                                        
                                        <span className="category-title">Insumos Faltantes o con bajo Stock</span>
                                        <span className="category-count">{lowStockSupplies.length}</span>
                                    </div>
                                    <span className={`collapse-icon ${showSuppliesAlerts ? 'open' : ''}`}>▼</span>
                                </button>
                                
                                {showSuppliesAlerts && (
                                    <div className="alert-grid">
                                        {lowStockSupplies.map(item => (
                                            <div key={item.id} className="alert-card alert-card-red">
                                                <div className="alert-card-icon">⚠️</div>
                                                <div className="alert-card-content">
                                                    <h4 className="alert-card-title">{item.name}</h4>
                                                    <div className="alert-card-stock">
                                                        <span className="stock-value">{formatStockDisplay(item.stock, item.unit)}</span>
                                                        <span className="stock-separator">·</span>
                                                        <span className="stock-min">Mín: {formatThresholdDisplay(item.lowStockThreshold, item.unit)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sección de Productos Bajo Mínimo */}
                        {lowStockProducts.length > 0 && (
                            <div className="alert-category">
                                <button 
                                    className="alert-category-header"
                                    onClick={() => setShowProductsAlerts(!showProductsAlerts)}
                                >
                                    <div className="header-left">
                                        
                                        <span className="category-title">Productos Faltantes o con bajo Stock</span>
                                        <span className="category-count">{lowStockProducts.length}</span>
                                    </div>
                                    <span className={`collapse-icon ${showProductsAlerts ? 'open' : ''}`}>▼</span>
                                </button>
                                
                                {showProductsAlerts && (
                                    <div className="alert-grid">
                                        {lowStockProducts.map(item => (
                                            <div key={item.id} className="alert-card alert-card-red">
                                                <div className="alert-card-icon">⚠️</div>
                                                <div className="alert-card-content">
                                                    <h4 className="alert-card-title">{item.name}</h4>
                                                    <div className="alert-card-stock">
                                                        <span className="stock-value">{formatStockDisplay(item.stock, item.unit)}</span>
                                                        <span className="stock-separator">·</span>
                                                        <span className="stock-min">Mín: {formatThresholdDisplay(item.lowStockThreshold, item.unit)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="info-section">
                    <h3>Información General</h3>
                    <p className='textoBienvenida'>Bienvenido al sistema de gestión de churrería. Utiliza el menú superior para navegar por las diferentes funcionalidades.</p>
                </div>
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
        const [activeTab, setActiveTab] = useState('productos'); // 'productos' o 'insumos'
        
        // Estados para filtros de productos
        const [productNameFilter, setProductNameFilter] = useState('');
        const [productStockFilter, setProductStockFilter] = useState('');
        const [productStockOp, setProductStockOp] = useState('equals');
        
        // Estados para filtros de insumos
        const [insumoNameFilter, setInsumoNameFilter] = useState('');
        const [insumoStockFilter, setInsumoStockFilter] = useState('');
        const [insumoStockOp, setInsumoStockOp] = useState('equals');
        const [insumoStockUnit, setInsumoStockUnit] = useState('unidades');

        const handleRegisterChange = (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            // Validaciones previas: producto seleccionado y cantidad válida
            const qty = parseFloat(String(change.quantity).replace(',', '.'));
            if (!change.productId) {
                alert('Debes seleccionar un producto.');
                return;
            }
            if (isNaN(qty) || qty <= 0) {
                alert('La cantidad debe ser un número positivo (ej: 3.5). El sistema lo tomará como una salida excepcional.');
                return;
            }

            // Abrir modal de confirmación en vez de enviar directamente
            setConfirmOpen(true);
        };

        const doRegisterChange = async () => {
            // Ejecutar la acción tras confirmación
            const product = inventory.find(p => p.id === change.productId || String(p.id) === String(change.productId));
            // Tomar cantidad como valor absoluto (si el usuario escribió -3 o 3)
            let quantity = Math.abs(parseFloat(String(change.quantity).replace(',', '.')));
            const reason = change.reason;
            if (!product) {
                alert('Producto no encontrado.');
                setConfirmOpen(false);
                return;
            }

            // Convert quantity to base unit (grams or ml) if necessary
            if (product.unit === 'g' || product.unit === 'ml') {
                quantity = quantity * 1000;
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
                <div className="inventory-header">
                    <h2>Control de Inventario</h2>
                    <div className="inventory-tabs">
                        <div className='inventory-tab-producto'>

                            <button 
                                className={`inventory-tab-button ${activeTab === 'productos' ? 'active' : ''}`}
                                onClick={() => setActiveTab('productos')}
                            >
                                Productos
                            </button>
                        </div>

                        <div className='inventory-tab-insumo'>
                            <button 
                                className={`inventory-tab-button ${activeTab === 'insumos' ? 'active' : ''}`}
                                onClick={() => setActiveTab('insumos')}
                            >
                                Insumos
                           </button>
                        </div> 
                    </div>
                </div>
                
                {activeTab === 'productos' && (
                    <div className="tab-content">
                        {/* Filtros para productos */}
                        <div className="inventory-filters">
                            <h4>FILTROS DE BÚSQUEDA</h4>
                            
                            <div className="inventory-filters-row">
                                <div className="filter-row">
                                    <label>Nombre del Producto</label>
                                    <input
                                        type="text"
                                        value={productNameFilter}
                                        onChange={e => setProductNameFilter(e.target.value)}
                                        placeholder="Buscar por nombre..."
                                    />
                                </div>
                                
                                <div className="filter-row">
                                    <label>Cantidad en Stock</label>
                                    <select value={productStockOp} onChange={e => setProductStockOp(e.target.value)}>
                                        <option value="equals">Es igual</option>
                                        <option value="gt">Mayor que</option>
                                        <option value="gte">Mayor o igual</option>
                                        <option value="lt">Menor que</option>
                                        <option value="lte">Menor o igual</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={productStockFilter}
                                        onChange={e => setProductStockFilter(e.target.value)}
                                        placeholder="Cant..."
                                    />
                                    <span className="unit-label">unidades</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="inventory-results">
                            <p className="results-count">
                                Mostrando {inventory.filter(item => {
                                    if (item.type !== 'Producto') return false;
                                    if (productNameFilter && !item.name.toLowerCase().includes(productNameFilter.toLowerCase())) return false;
                                    if (productStockFilter) {
                                        const filterValue = parseFloat(productStockFilter);
                                        const itemStock = parseFloat(item.stock);
                                        if (productStockOp === 'equals' && itemStock !== filterValue) return false;
                                        if (productStockOp === 'gt' && itemStock <= filterValue) return false;
                                        if (productStockOp === 'gte' && itemStock < filterValue) return false;
                                        if (productStockOp === 'lt' && itemStock >= filterValue) return false;
                                        if (productStockOp === 'lte' && itemStock > filterValue) return false;
                                    }
                                    return true;
                                }).length} resultados
                            </p>
                        </div>
                        
                        <div className="inventory-grid">
                            {inventory
                                .filter(item => {
                                    // Filtro por tipo
                                    if (item.type !== 'Producto') return false;
                                    
                                    // Filtro por nombre
                                    if (productNameFilter && !item.name.toLowerCase().includes(productNameFilter.toLowerCase())) {
                                        return false;
                                    }
                                    
                                    // Filtro por stock
                                    if (productStockFilter) {
                                        const filterValue = parseFloat(productStockFilter);
                                        const itemStock = parseFloat(item.stock);
                                        
                                        if (productStockOp === 'equals' && itemStock !== filterValue) return false;
                                        if (productStockOp === 'gt' && itemStock <= filterValue) return false;
                                        if (productStockOp === 'gte' && itemStock < filterValue) return false;
                                        if (productStockOp === 'lt' && itemStock >= filterValue) return false;
                                        if (productStockOp === 'lte' && itemStock > filterValue) return false;
                                    }
                                    
                                    return true;
                                })
                                .map(item => {
                                    let stockDisplay;
                                    const stockNum = parseFloat(item.stock);
                                    if (item.unit === 'g') {
                                        stockDisplay = `${parseFloat((stockNum / 1000).toFixed(3))} kilos`;
                                    } else if (item.unit === 'ml') {
                                        stockDisplay = `${parseFloat((stockNum / 1000).toFixed(3))} litros`;
                                    } else {
                                        stockDisplay = `${stockNum} unidades`;
                                    }
                                    
                                    const isLowStock = item.stock < (item.lowStockThreshold || item.low_stock_threshold || 0);
                                    
                                    return (
                                        <div key={item.id} className={`inventory-card ${isLowStock ? 'low-stock' : ''}`}>
                                            <div className="inventory-card-content">
                                                <h4 className="inventory-card-title">{item.name}</h4>
                                                <div className="inventory-card-stock">
                                                    <span className="stock-label">Stock:</span>
                                                    <span className={`stock-value ${isLowStock ? 'low' : ''}`}>{stockDisplay}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
                
                {activeTab === 'insumos' && (
                    <div className="tab-content">
                        {/* Filtros para insumos */}
                        <div className="inventory-filters">
                            <h4>FILTROS DE BÚSQUEDA</h4>
                            
                            <div className="inventory-filters-row">
                                <div className="filter-row">
                                    <label>Nombre del Insumo</label>
                                    <input
                                        type="text"
                                        value={insumoNameFilter}
                                        onChange={e => setInsumoNameFilter(e.target.value)}
                                        placeholder="Buscar por nombre..."
                                    />
                                </div>
                                
                                <div className="filter-row">
                                    <label>Cantidad en Stock</label>
                                    <select value={insumoStockOp} onChange={e => setInsumoStockOp(e.target.value)}>
                                        <option value="equals">Es igual</option>
                                        <option value="gt">Mayor que</option>
                                        <option value="gte">Mayor o igual</option>
                                        <option value="lt">Menor que</option>
                                        <option value="lte">Menor o igual</option>
                                    </select>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={insumoStockFilter}
                                        onChange={e => setInsumoStockFilter(e.target.value)}
                                        placeholder="Cant..."
                                    />
                                    <select 
                                        value={insumoStockUnit} 
                                        onChange={e => setInsumoStockUnit(e.target.value)}
                                        className="unit-selector"
                                    >
                                        <option value="unidades">unidades</option>
                                        <option value="Kg">Kg</option>
                                        <option value="L">L</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div className="inventory-results">
                            <p className="results-count">
                                Mostrando {inventory.filter(item => {
                                    if (item.type !== 'Insumo') return false;
                                    if (insumoNameFilter && !item.name.toLowerCase().includes(insumoNameFilter.toLowerCase())) return false;
                                    if (insumoStockFilter) {
                                        const filterValue = parseFloat(insumoStockFilter);
                                        let itemStock = parseFloat(item.stock);
                                        if (insumoStockUnit === 'Kg' && item.unit === 'g') {
                                            itemStock = itemStock / 1000;
                                        } else if (insumoStockUnit === 'L' && item.unit === 'ml') {
                                            itemStock = itemStock / 1000;
                                        } else if (insumoStockUnit === 'Kg' && item.unit !== 'g') {
                                            return false;
                                        } else if (insumoStockUnit === 'L' && item.unit !== 'ml') {
                                            return false;
                                        } else if (insumoStockUnit === 'unidades' && (item.unit === 'g' || item.unit === 'ml')) {
                                            return false;
                                        }
                                        if (insumoStockOp === 'equals' && Math.abs(itemStock - filterValue) > 0.001) return false;
                                        if (insumoStockOp === 'gt' && itemStock <= filterValue) return false;
                                        if (insumoStockOp === 'gte' && itemStock < filterValue) return false;
                                        if (insumoStockOp === 'lt' && itemStock >= filterValue) return false;
                                        if (insumoStockOp === 'lte' && itemStock > filterValue) return false;
                                    }
                                    return true;
                                }).length} resultados
                            </p>
                        </div>
                        
                        <div className="inventory-grid">
                            {inventory
                                .filter(item => {
                                    // Filtro por tipo
                                    if (item.type !== 'Insumo') return false;
                                    
                                    // Filtro por nombre
                                    if (insumoNameFilter && !item.name.toLowerCase().includes(insumoNameFilter.toLowerCase())) {
                                        return false;
                                    }
                                    
                                    // Filtro por stock
                                    if (insumoStockFilter) {
                                        const filterValue = parseFloat(insumoStockFilter);
                                        let itemStock = parseFloat(item.stock);
                                        
                                        // Convertir el stock del item según la unidad seleccionada
                                        if (insumoStockUnit === 'Kg' && item.unit === 'g') {
                                            // Convertir de gramos a kilos
                                            itemStock = itemStock / 1000;
                                        } else if (insumoStockUnit === 'L' && item.unit === 'ml') {
                                            // Convertir de mililitros a litros
                                            itemStock = itemStock / 1000;
                                        } else if (insumoStockUnit === 'Kg' && item.unit !== 'g') {
                                            // Si buscamos en Kg pero el item no está en gramos, no coincide
                                            return false;
                                        } else if (insumoStockUnit === 'L' && item.unit !== 'ml') {
                                            // Si buscamos en L pero el item no está en ml, no coincide
                                            return false;
                                        } else if (insumoStockUnit === 'unidades' && (item.unit === 'g' || item.unit === 'ml')) {
                                            // Si buscamos en unidades pero el item está en g o ml, no coincide
                                            return false;
                                        }
                                        
                                        if (insumoStockOp === 'equals' && Math.abs(itemStock - filterValue) > 0.001) return false;
                                        if (insumoStockOp === 'gt' && itemStock <= filterValue) return false;
                                        if (insumoStockOp === 'gte' && itemStock < filterValue) return false;
                                        if (insumoStockOp === 'lt' && itemStock >= filterValue) return false;
                                        if (insumoStockOp === 'lte' && itemStock > filterValue) return false;
                                    }
                                    
                                    return true;
                                })
                                .map(item => {
                                    let stockDisplay;
                                    const stockNum = parseFloat(item.stock);
                                    if (item.unit === 'g') {
                                        stockDisplay = `${parseFloat((stockNum / 1000).toFixed(3))} kilos`;
                                    } else if (item.unit === 'ml') {
                                        stockDisplay = `${parseFloat((stockNum / 1000).toFixed(3))} litros`;
                                    } else {
                                        stockDisplay = `${stockNum} unidades`;
                                    }
                                    
                                    const isLowStock = item.stock < (item.lowStockThreshold || item.low_stock_threshold || 0);
                                    
                                    return (
                                        <div key={item.id} className={`inventory-card ${isLowStock ? 'low-stock' : ''}`}>
                                            <div className="inventory-card-content">
                                                <h4 className="inventory-card-title">{item.name}</h4>
                                                <div className="inventory-card-stock">
                                                    <span className="stock-label">Stock:</span>
                                                    <span className={`stock-value ${isLowStock ? 'low' : ''}`}>{stockDisplay}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
                <hr />
          {/* Bloque 'Registrar Cambios en el Inventario' comentado  */}
          {false && (
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
                                <input type="number" step="0.01" value={change.quantity} onChange={e => setChange({ ...change, quantity: e.target.value })} placeholder="Cantidad (ej: 3.5) - será tomada como salida" required />
                                <input type="text" value={change.reason} onChange={e => setChange({ ...change, reason: e.target.value })} placeholder="Motivo (ej: Desperdicio, Contaminación)" required />
                                <div className="button-group">
                                    <button type="submit" className="action-button primary" disabled={!change.productId || isNaN(parseFloat(change.quantity)) || parseFloat(change.quantity) <= 0}>Guardar Salida</button>
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
        const [activeTab, setActiveTab] = useState('ventas'); // 'ventas' o 'caja'

        return (
            <div className="min-h-screen bg-gray-50">
                {/* Navigation Tabs */}
                <div className="bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-full mx-auto px-2 sm:px-4">
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setActiveTab('ventas')}
                                className={`py-4 px-6 font-medium text-lg transition-all rounded-t-lg ${
                                    activeTab === 'ventas'
                                        ? 'text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                style={activeTab === 'ventas' ? { backgroundColor: 'rgb(82, 150, 214)' } : {}}
                            >
                                Registrar Venta
                            </button>
                            <button
                                onClick={() => setActiveTab('caja')}
                                className={`py-4 px-6 font-medium text-lg transition-all rounded-t-lg ${
                                    activeTab === 'caja'
                                        ? 'text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                style={activeTab === 'caja' ? { backgroundColor: 'rgb(82, 150, 214)' } : {}}
                            >
                                Movimientos de Caja
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="max-w-full mx-auto px-2 sm:px-4 py-4">
                    <div style={{ display: activeTab === 'ventas' ? 'block' : 'none' }}>
                        <Registrar_Venta 
                            products={products}
                            loadProducts={loadProducts}
                            loadCashMovements={loadCashMovements}
                        />
                    </div>
                    
                    <div style={{ display: activeTab === 'caja' ? 'block' : 'none' }}>
                        <Movimientos_De_Caja 
                            cashMovements={cashMovements}
                        />
                    </div>
                </div>
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
                            <span>{formatMovementDate(movement.date)} - {movement.description}</span>
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
        const ProductCreationViewComponent = () => {
            // Función para convertir y formatear unidades (igual que en ProductionCreation)
            const formatQuantityWithConversion = (quantity, unit) => {
                const num = parseFloat(quantity);
                
                if (unit === 'g') {
                    if (num >= 1000) {
                        const kg = (num / 1000).toFixed(2);
                        return `${num.toFixed(1)} g (${kg} kg)`;
                    }
                    return `${num.toFixed(1)} g`;
                } else if (unit === 'ml') {
                    if (num >= 1000) {
                        const liters = (num / 1000).toFixed(2);
                        return `${num.toFixed(1)} ml (${liters} L)`;
                    }
                    return `${num.toFixed(1)} ml`;
                } else {
                    return `${num.toFixed(1)} ${unit}`;
                }
            };

            const [newProduct, setNewProduct] = useState({
                name: '', 
                description: '', 
                price: 0, 
                stock: 0, 
                // Rendimiento de la receta: cuántas unidades produce una receta/lote
                recipe_yield: 1,
                low_stock_threshold: 10,
                high_stock_multiplier: 2.0,
                category: 'Producto',
                unit: 'unidades'
            });
            const [recipeItems, setRecipeItems] = useState([{ ingredient: '', quantity: '', unit: '' }]);
            const [message, setMessage] = useState('');

            const handleRecipeChange = (index, field, value) => {
                const newRecipeItems = [...recipeItems];
                newRecipeItems[index][field] = value;

                if (field === 'ingredient') {
                    const selectedIngredient = products.find(p => p.id === value);
                    if (selectedIngredient) {
                        // Normalizar variantes de unidad que vengan del backend
                        const normalizeUnit = (u) => {
                            if (u === null || u === undefined) return '';
                            const s = String(u).toLowerCase().trim();
                            // Mapear a 'g'
                            if (['g', 'gr', 'grs', 'gramo', 'gramos', 'grams', 'gram'].includes(s)) return 'g';
                            // Mapear a 'ml'
                            if (['ml', 'mililitro', 'mililitros', 'milil', 'millilitro', 'millilitros'].includes(s)) return 'ml';
                            // Mapear a 'unidades'
                            if (['unidad', 'unidades', 'u', 'uds', 'unidad(es)'].includes(s)) return 'unidades';
                            return '';
                        };

                        const mapped = normalizeUnit(selectedIngredient.unit || '');
                        if (mapped) {
                            newRecipeItems[index]['unit'] = mapped;
                        } else {
                            // Si no se pudo mapear, dejar vacío y loggear para debug
                            newRecipeItems[index]['unit'] = '';
                        }
                    }
                }

                setRecipeItems(newRecipeItems);
            };

            const addRecipeItem = () => {
                setRecipeItems([...recipeItems, { ingredient: '', quantity: '', unit: '' }]);
            };

            const removeRecipeItem = (index) => {
                const newRecipeItems = recipeItems.filter((_, i) => i !== index);
                setRecipeItems(newRecipeItems);
            };

            const ingredientOptions = products
                .filter(p => p.category === 'Insumo')
                .map(p => ({ value: p.id, label: p.name }));
    
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

                    if (newProduct.category === 'Producto' && newProduct.stock > 0) {
                        for (const item of recipeItems) {
                            if (!item.ingredient || !item.quantity || parseFloat(item.quantity) <= 0) {
                                setMessage('🚫 Error: Todos los insumos de la receta deben tener un ingrediente seleccionado y una cantidad válida.');
                                return;
                            }
    
                            const ingredientInStore = products.find(p => p.id === item.ingredient);
                            if (!ingredientInStore) {
                                setMessage(`🚫 Error: El insumo con ID ${item.ingredient} no se encuentra en el inventario.`);
                                return;
                            }
    
                            // Calcular cantidad requerida proporcionalmente según el rendimiento por lote
                            const recipeYield = parseFloat(newProduct.recipe_yield) || 1;
                            const stockFloat = parseFloat(newProduct.stock) || 0;
                            const multiplier = recipeYield > 0 ? (stockFloat / recipeYield) : 0;
                            let requiredQuantity = parseFloat(item.quantity) * multiplier;

                            // Si la unidad es 'unidades' redondear hacia arriba
                            if ((item.unit || '').toString().toLowerCase() === 'unidades') {
                                requiredQuantity = Math.ceil(requiredQuantity);
                            }

                            if (ingredientInStore.stock < requiredQuantity) {
                                const requiredFormatted = formatQuantityWithConversion(requiredQuantity, item.unit);
                                const availableFormatted = formatQuantityWithConversion(ingredientInStore.stock, ingredientInStore.unit || item.unit);
                                setMessage(`🚫 Error: Stock insuficiente para el insumo "${ingredientInStore.name}". Se necesitan ${requiredFormatted} para crear ${newProduct.stock} unidades del producto (rendimiento por lote: ${recipeYield}), pero solo hay ${availableFormatted} disponibles.`);
                                return;
                            }
                        }
                    }

                    let recipePayload = [];
                    if (newProduct.category === 'Producto') {
                        recipePayload = recipeItems
                            .filter(item => item.ingredient && parseFloat(item.quantity) > 0)
                            .map(item => ({
                                ingredient: item.ingredient,
                                quantity: parseFloat(item.quantity),
                                unit: item.unit,
                            }));
    
                        if (recipeItems.some(item => item.ingredient && (!item.quantity || parseFloat(item.quantity) <= 0))) {
                            setMessage('🚫 Error: Todos los insumos de la receta deben tener una cantidad mayor a 0.');
                            return;
                        }
                    }
                    
                    // Para productos finales, el stock inicial representa una producción inicial
                    let finalStock = parseInt(newProduct.stock);

                    // Convertir umbral de stock a unidad base antes de enviar
                    const convertThresholdToBaseUnit = (threshold, unit) => {
                        if (unit === 'g') return threshold * 1000; // Kg a gramos
                        if (unit === 'ml') return threshold * 1000; // L a mililitros
                        return threshold; // unidades sin cambio
                    };

                    // Convertir stock a unidad base antes de enviar
                    const convertStockToBaseUnit = (stock, unit) => {
                        if (unit === 'g') return stock * 1000; // Kg a gramos
                        if (unit === 'ml') return stock * 1000; // L a mililitros
                        return stock; // unidades sin cambio
                    };

                    const payload = {
                        name: newProduct.name.trim(),
                        description: newProduct.description.trim(),
                        price: parseFloat(newProduct.price),
                        stock: convertStockToBaseUnit(finalStock, newProduct.unit),
                        recipe_yield: parseInt(newProduct.recipe_yield) || 1,
                        low_stock_threshold: convertThresholdToBaseUnit(parseInt(newProduct.low_stock_threshold), newProduct.unit),
                        high_stock_multiplier: parseFloat(newProduct.high_stock_multiplier),
                        category: newProduct.category,
                        unit: newProduct.unit,
                        recipe_ingredients: recipePayload
                    };
                    
                    // Crear producto
                    const response = await api.post('/products/', payload);

                    // Recargar productos desde PostgreSQL para mantener sincronización
                    await loadProducts();
                    setMessage('✅ Producto creado exitosamente y datos recargados desde PostgreSQL.');
                    // Productos recargados desde PostgreSQL después de crear producto

                    // Limpiar formulario
                    setNewProduct({ 
                        name: '', 
                        description: '', 
                        price: 0, 
                        stock: 0, 
                        recipe_yield: 1,
                        low_stock_threshold: 10,
                        high_stock_multiplier: 2.0,
                        category: 'Producto',
                        unit: 'unidades'
                    });
                    setRecipeItems([{ ingredient: '', quantity: '', unit: '' }]);
                } catch (error) {
                    console.log('❌ Error creando producto:', error);
                    
                    // Manejo específico de errores para Safari
                    if (error.response) {
                        // Error con respuesta del servidor
                        if (error.response.status === 400) {
                            setMessage('🚫 Error: ' + (error.response.data.detail || JSON.stringify(error.response.data)));
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
                    <p className='Parrafo'>Crea nuevos productos e insumos. Los productos creados aparecerán automáticamente en la sección "Inventario" y "Editar Productos".</p>
                    
                    <h3>Agregar nuevo producto</h3>
                    <form className="form-container" onSubmit={handleCreateProduct}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Nombre del Producto *</label>
                                <input 
                                    type="text" 
                                    value={newProduct.name} 
                                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} 
                                    placeholder="Nombre del Producto *" 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>Descripción del Producto</label>
                                <textarea 
                                    value={newProduct.description} 
                                    onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} 
                                    placeholder="Descripción del producto (opcional)"
                                    rows="3"
                                />
                            </div>
                        </div>
                       
                        
                        

                        <p>Unidad de Medida</p>
                        <select 
                            value={newProduct.unit} 
                            onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
                            required
                        >
                            <option value="unidades">Unidades</option>
                            <option value="g">Gramos (se mostrará en Kg)</option>
                            <option value="ml">Mililitros (se mostrará en L)</option>
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
                        <p>Stock ({newProduct.unit === 'g' ? 'Kg' : newProduct.unit === 'ml' ? 'L' : 'Unidades'})</p>
                        <input 
                            type="number" 
                            value={newProduct.stock} 
                            onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })} 
                            placeholder={`Stock en ${newProduct.unit === 'g' ? 'Kg' : newProduct.unit === 'ml' ? 'L' : 'Unidades'}`} 
                            min="0"
                            required 
                        />
                        
                        <p>Rendimiento de la receta (unidades por lote)</p>
                        <input
                            type="number"
                            value={newProduct.recipe_yield}
                            onChange={e => setNewProduct({ ...newProduct, recipe_yield: parseInt(e.target.value) || 1 })}
                            placeholder="Ej: 10 (la receta rinde 10 unidades)"
                            min="1"
                            required
                        />

                        <p>Umbral de Stock Bajo ({newProduct.unit === 'g' ? 'Kg' : newProduct.unit === 'ml' ? 'L' : 'Unidades'})</p>
                        <input 
                            type="number" 
                            value={newProduct.low_stock_threshold} 
                            onChange={e => setNewProduct({ ...newProduct, low_stock_threshold: parseInt(e.target.value) || 10 })} 
                            placeholder={`Umbral en ${newProduct.unit === 'g' ? 'Kg' : newProduct.unit === 'ml' ? 'L' : 'Unidades'} (por defecto: 10)`} 
                            min="0"
                        />

                        <p>Multiplicador para Stock Alto</p>
                        <input 
                            type="number" 
                            step="0.1"
                            value={newProduct.high_stock_multiplier} 
                            onChange={e => setNewProduct({ ...newProduct, high_stock_multiplier: parseFloat(e.target.value) || 2.0 })} 
                            placeholder="Ej: 2.0 = duplicar, 3.5 = triplicar y medio (por defecto: 2.0)" 
                            min="1.1"
                        />

                        {newProduct.category === 'Producto' && (
                            <div className="recipe-builder">
                                <h4>Receta (Insumos por receta / por lote)</h4>
                                {recipeItems.map((item, index) => (
                                    <div key={index} className="recipe-item">
                                        <Select
                                            options={ingredientOptions}
                                            value={ingredientOptions.find(opt => opt.value === item.ingredient)}
                                            onChange={selectedOption => handleRecipeChange(index, 'ingredient', selectedOption ? selectedOption.value : '')}
                                            placeholder="Seleccionar insumo..."
                                        />
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => handleRecipeChange(index, 'quantity', e.target.value)}
                                            placeholder="Cantidad"
                                            min="0"
                                        />
                                        <select
                                            value={item.unit}
                                            onChange={e => handleRecipeChange(index, 'unit', e.target.value)}
                                        >
                                            <option value="g">Gramos (g)</option>
                                            <option value="ml">Mililitros (ml)</option>
                                            <option value="unidades">Unidades</option>
                                        </select>
                                        <button type="button" onClick={() => removeRecipeItem(index)}>Eliminar</button>
                                    </div>
                                ))}
                                <button type="button" onClick={addRecipeItem}>Agregar Insumo</button>
                            </div>
                        )}
                        <button type="submit" className="main-button">Crear Producto</button>
                    </form>
                </div>
            );
        };

                

        // Componente de la interfaz de gestión de proveedores (solo para Gerente).
        const SupplierManagement = () => {
            return <Proveedores suppliers={suppliers} setSuppliers={setSuppliers} />;
        };
    
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
    

    

    
        // Mapeo de traducción para encabezados de tablas
        const headerTranslationMap = {
            
            'name': 'Nombre',
            'cuit': 'CUIT',
            'phone': 'Teléfono',
            'address': 'Dirección',
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
            'products': 'Productos',
            'units': 'Unidades',
            'totalMovements': 'Total de Movimientos',
            'totalIncome': 'Ingresos Totales',
            'totalExpenses': 'Gastos Totales',
            'period': 'Período'
        };

    
        // DataConsultation moved to `src/DataConsultation.js` to provide a stable identity
        // and avoid remounts caused by defining the component inline within App.
    
        const LowStockReport = () => {
            const [selectedProducts, setSelectedProducts] = useState([{ id: '', product: null }]);
            const [message, setMessage] = useState('');
            const [notification, setNotification] = useState('');
        
            // Función para formatear el stock con la unidad apropiada
            const formatStock = (stock, unit) => {
                if (!unit) return stock;
                
                switch(unit.toLowerCase()) {
                    case 'g':
                        return `${(stock / 1000).toFixed(2)} Kg`;
                    case 'ml':
                        return `${(stock / 1000).toFixed(2)} L`;
                    case 'u':
                        return `${Math.round(stock)} U`;
                    default:
                        return `${stock} ${unit}`;
                }
            };
        
            const handleAddProduct = () => {
                setSelectedProducts([...selectedProducts, { id: Date.now(), product: null }]);
            };
            
            const handleRemoveProduct = (id) => {
                if (selectedProducts.length > 1) {
                    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
                }
            };
            
            const handleProductChange = (id, option) => {
                setSelectedProducts(selectedProducts.map(p => 
                    p.id === id ? { ...p, product: option } : p
                ));
            };
        
            const handleSubmit = async (e) => {
                e.preventDefault();
                const validProducts = selectedProducts.filter(p => p.product && p.product.value);
                
                if (validProducts.length === 0 || !message) {
                    setNotification('Por favor, selecciona al menos un producto/insumo y escribe un mensaje.');
                    return;
                }
                
                try {
                    // Enviar un solo reporte con múltiples productos
                    await api.post('/low-stock-reports/create/', {
                        product_ids: validProducts.map(p => p.product.value),
                        message: message,
                    });
                    
                    setNotification(`Reporte con ${validProducts.length} producto(s)/insumo(s) enviado con éxito.`);
                    setSelectedProducts([{ id: Date.now(), product: null }]);
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
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: window.innerWidth >= 2560 ? 'repeat(7, 1fr)' :
                                                   window.innerWidth >= 1900 ? 'repeat(6, 1fr)' :
                                                   window.innerWidth >= 1600 ? 'repeat(5, 1fr)' :
                                                   window.innerWidth >= 1400 ? 'repeat(4, 1fr)' :
                                                   window.innerWidth >= 1200 ? 'repeat(3, 1fr)' :
                                                   window.innerWidth >= 740 ? 'repeat(2, 1fr)' : '1fr',
                                gap: '15px',
                                marginBottom: '15px'
                            }}>
                                {selectedProducts.map((item, index) => (
                                    <div key={item.id} style={{ position: 'relative' }}>
                                        <Select
                                            value={item.product}
                                            options={products.map(p => ({ 
                                                value: p.id, 
                                                label: p.name,
                                                category: p.category
                                            }))}
                                            onChange={(option) => handleProductChange(item.id, option)}
                                            placeholder="Selecciona producto/insumo"
                                            isClearable
                                            isSearchable
                                        />
                                        {selectedProducts.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveProduct(item.id)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-10px',
                                                    right: '-10px',
                                                    width: '25px',
                                                    height: '25px',
                                                    borderRadius: '50%',
                                                    border: 'none',
                                                    backgroundColor: '#dc3545',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    fontSize: '16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: 0,
                                                    zIndex: 10
                                                }}
                                                title="Eliminar"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={handleAddProduct}
                                className="action-button secondary"
                                style={{ marginTop: '10px' }}
                            >
                                + Agregar otro producto/insumo
                            </button>
                        </div>
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
        
    // Renderiza el componente de la página actual según el estado.
    const renderPage = () => {
        // Always allow forgot-password page even when not logged in
        if (currentPage === 'forgot-password') {
                // Siempre regresar a la pantalla de login al cancelar desde "Olvidé mi contraseña",
                // sin depender del estado `isLoggedIn` que puede cambiar al restaurar sesión
                // cuando la pestaña recibe foco.
                return <ForgotPassword onDone={() => setCurrentPage('login')} />;
            }

        if (!isLoggedIn) {
            return <Login />;
        }

        // Defensive: ensure currentPage is a known page when logged in to avoid falling
        // into the default case which renders the "Página no encontrada." message
    const validPages = new Set(['dashboard','inventario','ventas','productos','gestión de usuarios','proveedores','compras','pedidos','consultas', 'datos de mi usuario', 'edicion','login', 'reportar faltantes', 'ver reportes de faltantes', 'gestión de pérdidas', 'generate-token']);
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
                return userRole === 'Gerente' ? <ProductManagement 
                    userRole={userRole}
                    products={products}
                    inventory={inventory}
                    loadProducts={loadProducts}
                    ProductCreationViewComponent={ProductCreationViewComponent}
                /> : <ProductCreationViewComponent />;
            case 'gestión de usuarios':
                return <UserManagement 
                    users={users}
                    loadUsers={loadUsers}
                    userRole={userRole}
                />;
            // legacy token generation view removed
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
                        reloadProducts={loadProducts}
                    /> : <div>Acceso Denegado</div>;
            case 'pedidos':
                return userRole === 'Gerente' ? (
                    <Pedidos orders={orders} setOrders={setOrders} products={products} />
                ) : <div>Acceso Denegado</div>;
            case 'consultas':
                return <DataConsultation 
                    api={api}
                    getInMemoryToken={getInMemoryToken}
                    loadSales={loadSales}
                    loadCashMovements={loadCashMovements}
                            inventory={inventory}
                            suppliers={suppliers}
                            purchases={purchaseHistory}
                            orders={orders}
                            cashMovements={cashMovements}                    sales={sales}
                    headerTranslationMap={headerTranslationMap}
                    safeToFixed={safeToFixed}
                />;
            case 'datos de mi usuario':
                return <MyUserData />;
            case 'edicion':
                return userRole === 'Gerente' ? (
                    <Edicion
                        products={products}
                        setProducts={setProducts}
                        loadProducts={loadProducts}
                        isLoading={isLoading}
                    />
                ) : <div>Acceso Denegado</div>;
            case 'reportar faltantes':
                return <LowStockReport />;
            case 'ver reportes de faltantes':
                return userRole === 'Gerente' ? <Ver_Reportes_De_Faltantes products={products} /> : <div>Acceso Denegado</div>;
            case 'gestión de pérdidas':
                return ['Gerente', 'Encargado'].includes(userRole) ? 
                    <LossManagement 
                        products={products}
                        userRole={userRole}
                        loadProducts={loadProducts}
                    /> : <div>Acceso Denegado</div>;
            case 'login':
                // Permitir renderizar la pantalla de login incluso cuando la aplicación
                // detecta que está logueada en otra pestaña; esto evita que "Cancelar"
                // desde 'forgot-password' lleve al default (Página no encontrada).
                return <Login />;
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
              loadProducts(false); // Carga silenciosa en retry
              console.log('🔐 Usuario logueado - cargando usuarios y productos del servidor (retry)');
            }
          }, 200);
          return;
        }
        
        // Cargar datos del servidor
        loadUsers();
        loadProducts(false); // Carga silenciosa al hacer login
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
            loadProducts(false); // Sincronización silenciosa automática
            // Sincronización automática de productos
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
              loadProducts(false); // false = no mostrar mensaje de carga
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
              loadProducts(false); // Sincronización silenciosa
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
            {/* Mostrar la barra superior SOLO cuando el usuario esté autenticado y
                no estemos en páginas públicas como 'forgot-password' o 'login'.
                Evita que la barra azul aparezca en la pantalla de inicio de sesión. */}
            {isLoggedIn && !['forgot-password', 'login'].includes(currentPage) && <Navbar />}
            {renderPage()}
            
            {/* Diálogo de Pedidos */}
            {isPedDialogoOpen && (
                <PedDialogo
                    orders={orders}
                    setOrders={setOrders}
                    isOpen={isPedDialogoOpen}
                    onClose={handleClosePedDialogo}
                    onMinimize={handleMinimizePedDialogo}
                    isMinimized={isPedDialogoMinimized}
                    onOpenNewTab={handleOpenPedDialogoNewTab}
                    isFullscreen={isPedDialogoFullscreen}
                />
            )}
        </div>
    );
    } catch (error) {
        console.error('❌ Error de render en App:', error);
        throw error; // Re-throw para que ErrorBoundary lo atrape
    }
    };

export default App;