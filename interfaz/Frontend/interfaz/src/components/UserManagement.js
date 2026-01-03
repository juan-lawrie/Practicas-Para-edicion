import React, { useState, useEffect } from 'react';
import api, { getInMemoryToken } from '../services/api';

const UserManagement = ({ users, loadUsers, userRole }) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
    const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
    const [showLockConfirm, setShowLockConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Estados para paginación y filtros
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10; // Cantidad fija de usuarios por página
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState([]); // Array para múltiples roles
    const [filterStatus, setFilterStatus] = useState(''); // '', 'active', 'locked'

    // Estados para el diálogo de usuarios
    const [showUsersDialog, setShowUsersDialog] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [dialogSize, setDialogSize] = useState({ width: 1200, height: 700 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [dialogPosition, setDialogPosition] = useState({ x: 150, y: 50 });
    const [resizeStart, setResizeStart] = useState({ width: 0, height: 0 });

    // Estados para el formulario de creación
    const [newUser, setNewUser] = useState({
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roleId: ''
    });

    // Estados para el formulario de edición
    const [editUser, setEditUser] = useState({
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roleId: ''
    });

    // Cargar roles al montar el componente
    useEffect(() => {
        loadRoles();
    }, []);

    // Effect para manejar drag/resize con eventos globales
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                let newX = dialogPosition.x + dx;
                let newY = dialogPosition.y + dy;
                const minX = 0;
                const minY = 0;
                const maxX = window.innerWidth - 200;
                const maxY = window.innerHeight - 50;
                if (newX < minX) newX = minX;
                if (newY < minY) newY = minY;
                if (newX > maxX) newX = maxX;
                if (newY > maxY) newY = maxY;
                setDialogPosition({ x: newX, y: newY });
                setDragStart({ x: e.clientX, y: e.clientY });
            }
            if (isResizing) {
                const newWidth = Math.max(800, resizeStart.width + (e.clientX - dragStart.x));
                const newHeight = Math.max(500, resizeStart.height + (e.clientY - dragStart.y));
                setDialogSize({ width: newWidth, height: newHeight });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart, dialogPosition, resizeStart]);

    const loadRoles = async () => {
        try {
            const response = await api.get('/roles/');
            setRoles(response.data);
        } catch (error) {
            console.error('Error al cargar roles:', error);
            setError('Error al cargar los roles disponibles');
        }
    };

    // Abrir modal de creación
    const handleOpenCreateModal = () => {
        setNewUser({
            username: '',
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            roleId: ''
        });
        setMessage('');
        setError('');
        setShowCreateModal(true);
    };

    // Abrir modal de edición
    const handleOpenEditModal = (user) => {
        setSelectedUser(user);
        setEditUser({
            username: user.username || '',
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email || '',
            password: '',
            roleId: user.role?.id || ''
        });
        setMessage('');
        setError('');
        setShowEditModal(true);
    };

    // Cerrar modales
    const handleCloseModals = () => {
        setShowCreateModal(false);
        setShowEditModal(false);
        setShowDeleteConfirm(false);
        setShowUpdateConfirm(false);
        setShowUnlockConfirm(false);
        setShowLockConfirm(false);
        setSelectedUser(null);
        setMessage('');
        setError('');
    };

    // Crear usuario
    const handleCreateUser = async () => {
        try {
            if (!newUser.username || !newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password || !newUser.roleId) {
                setError('Todos los campos son obligatorios');
                return;
            }

            const selectedRole = roles.find(r => r.id === parseInt(newUser.roleId));

            const userData = {
                username: newUser.username.trim(),
                first_name: newUser.firstName,
                last_name: newUser.lastName,
                email: newUser.email,
                password: newUser.password,
                role_name: selectedRole?.name
            };

            await api.post('/users/create/', userData);
            setMessage('Usuario creado exitosamente');
            await loadUsers();
            setTimeout(() => {
                handleCloseModals();
            }, 1500);
        } catch (error) {
            console.error('Error al crear usuario:', error);
            console.log('🔍 DEBUG - error.response:', error.response);
            console.log('🔍 DEBUG - error.response?.data:', error.response?.data);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || '';
            const errorStr = JSON.stringify(error.response?.data || {}).toLowerCase();
            console.log('🔍 DEBUG - errorMessage:', errorMessage);
            console.log('🔍 DEBUG - errorStr completo:', errorStr);
            
            // Detectar errores de usuario duplicado (buscar en toda la respuesta)
            if (errorStr.includes('username') || errorStr.includes('usuario')) {
                if (errorStr.includes('already exists') || 
                    errorStr.includes('ya existe') ||
                    errorStr.includes('duplicate') ||
                    errorStr.includes('duplicado') ||
                    errorStr.includes('unique') ||
                    errorStr.includes('único') ||
                    errorStr.includes('unico') ||
                    errorStr.includes('existe')) {
                    setError('No se pueden repetir los usuarios, los usuarios deben ser únicos.');
                    return;
                }
            }
            
            setError(errorMessage || 'Error al crear el usuario');
        }
    };

    // Confirmar actualización
    const handleConfirmUpdate = () => {
        setShowUpdateConfirm(true);
    };

    // Actualizar usuario
    const handleUpdateUser = async () => {
        try {
            if (!editUser.username || !editUser.firstName || !editUser.lastName || !editUser.email || !editUser.roleId) {
                setError('Usuario, nombre, apellido, email y rol son obligatorios');
                return;
            }

            const userData = {
                username: editUser.username.trim(),
                first_name: editUser.firstName,
                last_name: editUser.lastName,
                email: editUser.email,
                role_id: parseInt(editUser.roleId)
            };

            // Solo incluir contraseña si se proporcionó una nueva
            if (editUser.password && editUser.password.trim() !== '') {
                userData.password = editUser.password;
            }

            await api.patch(`/users/${selectedUser.id}/`, userData);
            setMessage('Usuario actualizado exitosamente');
            await loadUsers();
            setTimeout(() => {
                handleCloseModals();
            }, 1500);
        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            console.log('🔍 DEBUG - error.response:', error.response);
            console.log('🔍 DEBUG - error.response?.data:', error.response?.data);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || '';
            const errorStr = JSON.stringify(error.response?.data || {}).toLowerCase();
            console.log('🔍 DEBUG - errorMessage:', errorMessage);
            console.log('🔍 DEBUG - errorStr completo:', errorStr);
            
            // Detectar errores de usuario duplicado (buscar en toda la respuesta)
            if (errorStr.includes('username') || errorStr.includes('usuario')) {
                if (errorStr.includes('already exists') || 
                    errorStr.includes('ya existe') ||
                    errorStr.includes('duplicate') ||
                    errorStr.includes('duplicado') ||
                    errorStr.includes('unique') ||
                    errorStr.includes('único') ||
                    errorStr.includes('unico') ||
                    errorStr.includes('existe')) {
                    setError('No se pueden repetir los usuarios, los usuarios deben ser únicos.');
                    return;
                }
            }
            
            setError(errorMessage || 'Error al actualizar el usuario');
        }
    };

    // Confirmar eliminación
    const handleConfirmDelete = (user) => {
        setSelectedUser(user);
        setShowDeleteConfirm(true);
    };

    // Eliminar usuario
    const handleDeleteUser = async () => {
        try {
            await api.delete(`/users/${selectedUser.id}/delete/`);
            setMessage('Usuario eliminado exitosamente');
            await loadUsers();
            setTimeout(() => {
                handleCloseModals();
            }, 1500);
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            setError(error.response?.data?.error || 'Error al eliminar el usuario');
        }
    };

    // Confirmar desbloqueo
    const handleConfirmUnlock = (user) => {
        setSelectedUser(user);
        setShowUnlockConfirm(true);
    };

    // Desbloquear usuario
    const handleUnlockUser = async () => {
        try {
            console.log('🔓 Iniciando desbloqueo del usuario:', selectedUser.id);
            const response = await api.post(`/users/${selectedUser.id}/unlock/`);
            console.log('✅ Respuesta del servidor:', response.data);
            setMessage('Usuario desbloqueado exitosamente');
            
            const userEmail = selectedUser.email;
            const userName = selectedUser.username;
            
            // Limpiar COMPLETAMENTE localStorage de lockTypes
            console.log('🧹 Limpiando TODO el localStorage de lockTypes');
            try {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('lockType_')) {
                        localStorage.removeItem(key);
                        console.log('🗑️ Eliminado:', key);
                    }
                });
            } catch (e) {
                console.error('Error limpiando localStorage:', e);
            }
            
            // Emitir evento para limpiar el estado de bloqueo en todas las pestañas
            try {
                const event = new CustomEvent('userAccountUnlocked', {
                    detail: {
                        userId: selectedUser.id,
                        userEmail: userEmail,
                        userName: userName,
                        timestamp: Date.now()
                    }
                });
                window.dispatchEvent(event);
                
                // También usar localStorage para otras pestañas
                localStorage.setItem('account_unlocked', JSON.stringify({
                    userId: selectedUser.id,
                    userEmail: userEmail,
                    userName: userName,
                    timestamp: Date.now()
                }));
                setTimeout(() => {
                    localStorage.removeItem('account_unlocked');
                }, 1000);
            } catch (e) {
                console.warn('No se pudo emitir evento de desbloqueo:', e);
            }
            
            await loadUsers();
            setTimeout(() => {
                handleCloseModals();
            }, 1500);
        } catch (error) {
            console.error('Error al desbloquear usuario:', error);
            setError(error.response?.data?.error || 'Error al desbloquear el usuario');
        }
    };

    // Confirmar bloqueo
    const handleConfirmLock = (user) => {
        setSelectedUser(user);
        setShowLockConfirm(true);
    };

    // Bloquear usuario
    const handleLockUser = async () => {
        try {
            await api.post(`/users/${selectedUser.id}/lock/`);
            setMessage('Usuario bloqueado exitosamente');
            
            const userEmail = selectedUser.email;
            const userName = selectedUser.username;
            
            // Emitir evento personalizado para cerrar sesión del usuario bloqueado inmediatamente
            try {
                // Usar CustomEvent para que funcione en la misma pestaña
                const event = new CustomEvent('userAccountLocked', {
                    detail: {
                        userId: selectedUser.id,
                        userEmail: userEmail,
                        userName: userName,
                        lockType: 'manual',
                        timestamp: Date.now()
                    }
                });
                window.dispatchEvent(event);
                
                // También usar localStorage para otras pestañas
                localStorage.setItem('account_locked', JSON.stringify({
                    userId: selectedUser.id,
                    userEmail: userEmail,
                    userName: userName,
                    lockType: 'manual',
                    timestamp: Date.now()
                }));
                // Limpiar el evento después de 1 segundo
                setTimeout(() => {
                    localStorage.removeItem('account_locked');
                }, 1000);
            } catch (e) {
                console.warn('No se pudo emitir evento de bloqueo:', e);
            }
            
            await loadUsers();
            setTimeout(() => {
                handleCloseModals();
            }, 1500);
        } catch (error) {
            console.error('Error al bloquear usuario:', error);
            setError(error.response?.data?.error || 'Error al bloquear el usuario');
        }
    };

    // Función para abrir el diálogo en ventana nueva
    const openInNewWindow = async () => {
        // Obtener el token de autorización desde el módulo api
        let authToken = '';
        try {
            // Intentar obtener el token del sistema de autenticación
            const tokenFromMemory = getInMemoryToken ? getInMemoryToken() : null;
            if (tokenFromMemory) {
                authToken = tokenFromMemory;
            } else {
                // Si no hay token en memoria, intentar hacer refresh
                const response = await api.post('/refresh-cookie/');
                if (response.data && response.data.access) {
                    authToken = response.data.access;
                }
            }
        } catch (error) {
            console.error('Error obteniendo token:', error);
        }
        
        const newWindow = window.open('', '_blank', 'width=1400,height=900');
        
        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Gestión de Usuarios</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { margin: 0; padding: 0; background: #f9fafb; font-family: system-ui; }
                </style>
            </head>
            <body>
                <!-- Barra superior -->
                <div class="bg-blue-600 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-lg">
                    <div class="flex items-center gap-4">
                        <h1 class="font-bold text-xl">👥 Gestión de Usuarios</h1>
                        <span id="userCount" class="bg-white text-blue-600 px-3 py-1.5 rounded text-sm font-semibold">
                            ${users.length} usuarios
                        </span>
                    </div>
                    <button onclick="window.close()" class="text-white hover:bg-red-600 font-bold text-3xl leading-none px-3 rounded transition-colors">×</button>
                </div>
                <div class="p-4">
                    <div id="filters-container"></div>
                    <div id="users-container"></div>
                    <div id="modals-container"></div>
                </div>
                <script>
                    const allUsers = ${JSON.stringify(users)};
                    const roles = ${JSON.stringify(roles)};
                    const authToken = '${authToken}';
                    let searchTerm = '';
                    let selectedRoles = [];
                    let selectedStatus = '';
                    let currentModal = null;
                    let selectedUser = null;
                    
                    function filterUsers() {
                        return allUsers.filter(user => {
                            const matchesSearch = searchTerm === '' || 
                                user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                user.email?.toLowerCase().includes(searchTerm.toLowerCase());
                            
                            const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(user.role?.name);
                            
                            const matchesStatus = selectedStatus === '' || 
                                (selectedStatus === 'active' && !user.is_locked) ||
                                (selectedStatus === 'locked' && user.is_locked);
                            
                            return matchesSearch && matchesRole && matchesStatus;
                        });
                    }
                    
                    function showModal(modalName, user = null) {
                        selectedUser = user;
                        currentModal = modalName;
                        renderModals();
                    }
                    
                    function closeModal() {
                        currentModal = null;
                        selectedUser = null;
                        renderModals();
                    }
                    
                    function renderModals() {
                        const container = document.getElementById('modals-container');
                        
                        if (!currentModal) {
                            container.innerHTML = '';
                            return;
                        }
                        
                        if (currentModal === 'delete' && selectedUser) {
                            container.innerHTML = \`
                                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                                        <h3 class="text-xl font-bold text-gray-900 mb-4">⚠️ Confirmación</h3>
                                        <p class="text-gray-700 mb-6">
                                            ¿Estás seguro de que deseas eliminar a <strong>\${selectedUser.first_name} \${selectedUser.last_name}</strong>?
                                        </p>
                                        <div class="flex flex-col-reverse sm:flex-row gap-3">
                                            <button
                                                onclick="closeModal()"
                                                class="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onclick="handleDeleteUser()"
                                                class="w-full sm:w-1/2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        } else if (currentModal === 'lock' && selectedUser) {
                            container.innerHTML = \`
                                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                                        <h3 class="text-xl font-bold text-gray-900 mb-4">🔒 Confirmación de Bloqueo</h3>
                                        <p class="text-gray-700 mb-6">
                                            ¿Estás seguro de que deseas bloquear a <strong>\${selectedUser.first_name} \${selectedUser.last_name}</strong>?
                                            <br /><br />
                                            <span class="text-sm text-gray-600">
                                                El usuario no podrá iniciar sesión hasta que sea desbloqueado manualmente.
                                            </span>
                                        </p>
                                        <div class="flex flex-col-reverse sm:flex-row gap-3">
                                            <button
                                                onclick="closeModal()"
                                                class="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onclick="handleLockUser()"
                                                class="w-full sm:w-1/2 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                                            >
                                                Bloquear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        } else if (currentModal === 'unlock' && selectedUser) {
                            container.innerHTML = \`
                                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                                        <h3 class="text-xl font-bold text-gray-900 mb-4">🔓 Confirmación de Desbloqueo</h3>
                                        <p class="text-gray-700 mb-6">
                                            ¿Estás seguro de que deseas desbloquear a <strong>\${selectedUser.first_name} \${selectedUser.last_name}</strong>?
                                            <br /><br />
                                            <span class="text-sm text-gray-600">
                                                Esto restablecerá los intentos de inicio de sesión fallidos y permitirá al usuario acceder nuevamente al sistema.
                                            </span>
                                        </p>
                                        <div class="flex flex-col-reverse sm:flex-row gap-3">
                                            <button
                                                onclick="closeModal()"
                                                class="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onclick="handleUnlockUser()"
                                                class="w-full sm:w-1/2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                                            >
                                                Desbloquear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        } else if (currentModal === 'edit' && selectedUser) {
                            container.innerHTML = \`
                                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                    <div class="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto" style="max-width: 600px;">
                                        <div class="p-6">
                                            <h3 class="text-xl font-bold text-gray-900 mb-4">✏️ Editar Usuario</h3>
                                            
                                            <div class="space-y-4">
                                                <div>
                                                    <label class="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
                                                    <input
                                                        type="text"
                                                        id="edit-username"
                                                        value="\${selectedUser.username || ''}"
                                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label class="block text-sm font-medium text-gray-700 mb-1">Nombre(s) *</label>
                                                    <input
                                                        type="text"
                                                        id="edit-firstname"
                                                        value="\${selectedUser.first_name || ''}"
                                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label class="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                                                    <input
                                                        type="text"
                                                        id="edit-lastname"
                                                        value="\${selectedUser.last_name || ''}"
                                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                                    <input
                                                        type="email"
                                                        id="edit-email"
                                                        value="\${selectedUser.email || ''}"
                                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label class="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña (dejar en blanco para no cambiar)</label>
                                                    <input
                                                        type="password"
                                                        id="edit-password"
                                                        placeholder="••••••••"
                                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>

                                                <div>
                                                    <label class="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                                                    <select
                                                        id="edit-role"
                                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    >
                                                        <option value="">Seleccionar rol...</option>
                                                        \${roles.map(role => \`
                                                            <option value="\${role.id}" \${selectedUser.role?.id === role.id ? 'selected' : ''}>
                                                                \${role.name}
                                                            </option>
                                                        \`).join('')}
                                                    </select>
                                                </div>
                                            </div>

                                            <div class="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                                                <button
                                                    onclick="closeModal()"
                                                    class="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onclick="handleUpdateUser()"
                                                    class="w-full sm:w-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                                >
                                                    Actualizar Datos
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            \`;
                        } else {
                            container.innerHTML = '';
                        }
                    }
                    
                    async function handleDeleteUser() {
                        if (!selectedUser) return;
                        
                        try {
                            const headers = {
                                'Content-Type': 'application/json'
                            };
                            if (authToken) {
                                headers['Authorization'] = 'Bearer ' + authToken;
                            }
                            
                            const response = await fetch('http://localhost:8000/api/users/' + selectedUser.id + '/delete/', {
                                method: 'DELETE',
                                credentials: 'include',
                                headers: headers
                            });
                            
                            if (response.ok) {
                                alert('✅ Usuario ' + selectedUser.first_name + ' eliminado exitosamente');
                                // Eliminar usuario del array local
                                const index = allUsers.findIndex(u => u.id === selectedUser.id);
                                if (index > -1) {
                                    allUsers.splice(index, 1);
                                }
                                closeModal();
                                renderUsers();
                                // Recargar ventana principal
                                if (window.opener && !window.opener.closed) {
                                    window.opener.location.reload();
                                }
                            } else {
                                let errorMsg = 'Error al eliminar usuario';
                                try {
                                    const error = await response.json();
                                    errorMsg = error.error || error.message || error.detail || JSON.stringify(error);
                                } catch (e) {
                                    const text = await response.text();
                                    errorMsg = text || 'Error ' + response.status;
                                }
                                console.error('Error response:', errorMsg);
                                alert('❌ ' + errorMsg);
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('❌ Error al eliminar usuario: ' + error.message);
                        }
                    }
                    
                    async function handleLockUser() {
                        if (!selectedUser) return;
                        
                        try {
                            const headers = {
                                'Content-Type': 'application/json'
                            };
                            if (authToken) {
                                headers['Authorization'] = 'Bearer ' + authToken;
                            }
                            
                            const response = await fetch('http://localhost:8000/api/users/' + selectedUser.id + '/lock/', {
                                method: 'POST',
                                credentials: 'include',
                                headers: headers
                            });
                            
                            if (response.ok) {
                                alert('✅ Usuario ' + selectedUser.first_name + ' bloqueado exitosamente');
                                // Actualizar estado del usuario en array local
                                const user = allUsers.find(u => u.id === selectedUser.id);
                                if (user) {
                                    user.is_locked = true;
                                }
                                closeModal();
                                renderUsers();
                                // Recargar ventana principal
                                if (window.opener && !window.opener.closed) {
                                    window.opener.location.reload();
                                }
                            } else {
                                let errorMsg = 'Error al bloquear usuario';
                                try {
                                    const error = await response.json();
                                    errorMsg = error.error || error.message || error.detail || JSON.stringify(error);
                                } catch (e) {
                                    const text = await response.text();
                                    errorMsg = text || 'Error ' + response.status;
                                }
                                console.error('Error response:', errorMsg);
                                alert('❌ ' + errorMsg);
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('❌ Error al bloquear usuario: ' + error.message);
                        }
                    }
                    
                    async function handleUnlockUser() {
                        if (!selectedUser) return;
                        
                        try {
                            const headers = {
                                'Content-Type': 'application/json'
                            };
                            if (authToken) {
                                headers['Authorization'] = 'Bearer ' + authToken;
                            }
                            
                            const response = await fetch('http://localhost:8000/api/users/' + selectedUser.id + '/unlock/', {
                                method: 'POST',
                                credentials: 'include',
                                headers: headers
                            });
                            
                            if (response.ok) {
                                alert('✅ Usuario ' + selectedUser.first_name + ' desbloqueado exitosamente');
                                // Actualizar estado del usuario en array local
                                const user = allUsers.find(u => u.id === selectedUser.id);
                                if (user) {
                                    user.is_locked = false;
                                }
                                closeModal();
                                renderUsers();
                                // Recargar ventana principal
                                if (window.opener && !window.opener.closed) {
                                    window.opener.location.reload();
                                }
                            } else {
                                let errorMsg = 'Error al desbloquear usuario';
                                try {
                                    const error = await response.json();
                                    errorMsg = error.error || error.message || error.detail || JSON.stringify(error);
                                } catch (e) {
                                    const text = await response.text();
                                    errorMsg = text || 'Error ' + response.status;
                                }
                                console.error('Error response:', errorMsg);
                                alert('❌ ' + errorMsg);
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('❌ Error al desbloquear usuario: ' + error.message);
                        }
                    }
                    
                    async function handleUpdateUser() {
                        const username = document.getElementById('edit-username')?.value;
                        const firstname = document.getElementById('edit-firstname')?.value;
                        const lastname = document.getElementById('edit-lastname')?.value;
                        const email = document.getElementById('edit-email')?.value;
                        const password = document.getElementById('edit-password')?.value;
                        const roleId = document.getElementById('edit-role')?.value;
                        
                        if (!username || !firstname || !lastname || !email || !roleId) {
                            alert('Usuario, nombre, apellido, email y rol son obligatorios');
                            return;
                        }
                        
                        if (!selectedUser) return;
                        
                        try {
                            const userData = {
                                username: username.trim(),
                                first_name: firstname,
                                last_name: lastname,
                                email: email,
                                role_id: parseInt(roleId)
                            };
                            
                            // Solo incluir contraseña si se proporcionó una nueva
                            if (password && password.trim() !== '') {
                                userData.password = password;
                            }
                            
                            const headers = {
                                'Content-Type': 'application/json'
                            };
                            if (authToken) {
                                headers['Authorization'] = 'Bearer ' + authToken;
                            }
                            
                            const response = await fetch('http://localhost:8000/api/users/' + selectedUser.id + '/', {
                                method: 'PATCH',
                                credentials: 'include',
                                headers: headers,
                                body: JSON.stringify(userData)
                            });
                            
                            if (response.ok) {
                                const updatedData = await response.json();
                                alert('✅ Usuario ' + selectedUser.first_name + ' actualizado exitosamente');
                                // Actualizar datos del usuario en array local
                                const user = allUsers.find(u => u.id === selectedUser.id);
                                if (user) {
                                    user.username = userData.username;
                                    user.first_name = userData.first_name;
                                    user.last_name = userData.last_name;
                                    user.email = userData.email;
                                    user.role_id = userData.role_id;
                                    // Actualizar el rol completo si viene en la respuesta
                                    if (updatedData.role) {
                                        user.role = updatedData.role;
                                    }
                                }
                                closeModal();
                                renderUsers();
                                // Recargar ventana principal
                                if (window.opener && !window.opener.closed) {
                                    window.opener.location.reload();
                                }
                            } else {
                                let errorMsg = 'Error al actualizar usuario';
                                try {
                                    const error = await response.json();
                                    const errorStr = JSON.stringify(error || {}).toLowerCase();
                                    
                                    // Detectar errores de usuario duplicado
                                    if (errorStr.includes('username') || errorStr.includes('usuario')) {
                                        if (errorStr.includes('already exists') || 
                                            errorStr.includes('ya existe') ||
                                            errorStr.includes('duplicate') ||
                                            errorStr.includes('duplicado') ||
                                            errorStr.includes('unique') ||
                                            errorStr.includes('único') ||
                                            errorStr.includes('unico') ||
                                            errorStr.includes('existe')) {
                                            alert('❌ No se pueden repetir los usuarios, los usuarios deben ser únicos.');
                                            return;
                                        }
                                    }
                                    
                                    errorMsg = error.error || error.message || error.detail || JSON.stringify(error);
                                } catch (e) {
                                    const text = await response.text();
                                    errorMsg = text || 'Error ' + response.status;
                                }
                                console.error('Error response:', errorMsg);
                                alert('❌ ' + errorMsg);
                            }
                        } catch (error) {
                            console.error('Error:', error);
                            alert('❌ Error al actualizar usuario: ' + error.message);
                        }
                    }
                    
                    function renderFilters() {
                        const container = document.getElementById('filters-container');
                        container.innerHTML = \`
                            <div class="bg-white rounded-lg shadow-md p-6 mb-4">
                                <h3 class="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h3>
                                <!-- Búsqueda -->
                                <div class="mb-4">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">Buscar usuario</label>
                                    <input
                                        type="text"
                                        id="search-input"
                                        placeholder="Nombre, apellido, email o usuario..."
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <!-- Filtros por rol y estado en la misma fila -->
                                <div class="mb-4 flex flex-col xl:flex-row xl:items-end xl:gap-4">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">Filtrar por rol</label>
                                        <div class="flex flex-wrap gap-4" id="role-filters">
                                            \${roles.map(role => \`
                                                <label class="flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        value="\${role.name}"
                                                        class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 role-checkbox"
                                                    />
                                                    <span class="ml-2 text-sm text-gray-700">\${role.name}</span>
                                                </label>
                                            \`).join('')}
                                        </div>
                                    </div>
                                    <div class="mt-4 xl:mt-0">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                                        <select
                                            id="status-filter"
                                            class="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Todos</option>
                                            <option value="active">Activos</option>
                                            <option value="locked">Bloqueados</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        \`;
                        
                        // Event listeners
                        document.getElementById('search-input').addEventListener('input', (e) => {
                            searchTerm = e.target.value;
                            renderUsers();
                        });
                        
                        document.querySelectorAll('.role-checkbox').forEach(checkbox => {
                            checkbox.addEventListener('change', (e) => {
                                if (e.target.checked) {
                                    selectedRoles.push(e.target.value);
                                } else {
                                    selectedRoles = selectedRoles.filter(r => r !== e.target.value);
                                }
                                renderUsers();
                            });
                        });
                        
                        document.getElementById('status-filter').addEventListener('change', (e) => {
                            selectedStatus = e.target.value;
                            renderUsers();
                        });
                    }
                    
                    function renderUsers() {
                        const filteredUsers = filterUsers();
                        const container = document.getElementById('users-container');
                        container.innerHTML = \`
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 users-grid-dialog gap-4">
                                \${filteredUsers.map(user => \`
                                    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5">
                                        <div class="flex items-center mb-3">
                                            <div class="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                                <span class="text-blue-600 font-bold text-lg">
                                                    \${(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="ml-3 flex-1 min-w-0 overflow-hidden">
                                                <div class="text-sm font-semibold text-gray-900 truncate">
                                                    \${user.first_name} \${user.last_name}
                                                </div>
                                                <div class="text-xs text-gray-500 truncate">
                                                    @\${user.username}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <div class="text-xs text-gray-500 mb-1">Email</div>
                                            <div class="text-sm text-gray-900 truncate">\${user.email}</div>
                                        </div>
                                        <div class="flex flex-wrap gap-2 mb-3">
                                            <span class="px-2 py-1 text-xs font-semibold rounded-full \${
                                                user.role?.name === 'Gerente' ? 'bg-purple-100 text-purple-800' :
                                                user.role?.name === 'Encargado' ? 'bg-blue-100 text-blue-800' :
                                                user.role?.name === 'Panadero' ? 'bg-green-100 text-green-800' :
                                                user.role?.name === 'Cajero' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                            }">
                                                \${user.role?.name || 'Sin rol'}
                                            </span>
                                            \${user.is_locked ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">🔒 Bloqueado</span>' : ''}
                                        </div>
                                        <div class="flex flex-col gap-2">
                                            \${user.is_locked ? \`
                                                <button
                                                    onclick="showModal('unlock', \${JSON.stringify(user).replace(/"/g, '&quot;')})"
                                                    class="w-full px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                                                >
                                                    🔓 Desbloquear
                                                </button>
                                            \` : (user.role?.name !== 'Gerente' ? \`
                                                <button
                                                    onclick="showModal('lock', \${JSON.stringify(user).replace(/"/g, '&quot;')})"
                                                    class="w-full px-3 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
                                                >
                                                    🔒 Bloquear
                                                </button>
                                            \` : '')}
                                            <div class="grid grid-cols-2 gap-2">
                                                <button
                                                    onclick="showModal('edit', \${JSON.stringify(user).replace(/"/g, '&quot;')})"
                                                    class="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                                >
                                                    ✏️ Editar
                                                </button>
                                                <button
                                                    onclick="showModal('delete', \${JSON.stringify(user).replace(/"/g, '&quot;')})"
                                                    class="px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                                                >
                                                    🗑️ Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }
                    
                    renderFilters();
                    renderUsers();
                </script>
            </body>
            </html>
        `);
        newWindow.document.close();
    };

    // Filtrar usuarios según búsqueda y filtros
    const filteredUsers = users.filter(user => {
        const matchesSearch = searchTerm === '' || 
            user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Si no hay roles seleccionados, mostrar todos; si hay roles, filtrar por ellos
        const matchesRole = filterRole.length === 0 || filterRole.includes(user.role?.name);
        
        const matchesStatus = filterStatus === '' || 
            (filterStatus === 'active' && !user.is_locked) ||
            (filterStatus === 'locked' && user.is_locked);
        
        return matchesSearch && matchesRole && matchesStatus;
    });

    // Calcular paginación
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    // Resetear a página 1 cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterRole, filterStatus]);

    // Verificar permisos
    if (userRole !== 'Gerente') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                    <div className="text-6xl mb-4">🔒</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
                    <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex-shrink min-w-0 overflow-hidden">
            <div className="w-full flex-shrink min-w-0">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
                                👥 Gestión de Usuarios
                            </h2>
                            <p className="text-gray-600 mt-1">Administra los usuarios del sistema</p>
                        </div>
                        <button
                            onClick={handleOpenCreateModal}
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg shadow-md hover:from-blue-700 hover:to-blue-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                        >
                            ➕ Crear Usuario
                        </button>
                    </div>
                </div>

                {/* Mensajes */}
                {message && (
                    <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
                        <p className="text-green-700 font-medium">✓ {message}</p>
                    </div>
                )}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                        <p className="text-red-700 font-medium">✗ {error}</p>
                    </div>
                )}

                {/* Botón para abrir diálogo en pantallas ≥1200px */}
                <div className="hidden min-[1200px]:flex justify-center items-center mb-6">
                    <button
                        onClick={() => setShowUsersDialog(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-colors shadow-lg"
                    >
                        👥 Ver Lista de Usuarios
                    </button>
                </div>

                {/* Barra de búsqueda y filtros - Solo visible en pantallas <1200px */}
                <div className="min-[1200px]:hidden">
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    {/* Búsqueda */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            🔍 Buscar usuario
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Nombre, apellido, email o usuario..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filtros por rol y estado */}
                    <div className="mb-4 flex flex-col md:flex-row gap-4 md:items-end">
                        {/* Filtro por rol (checkboxes) */}
                        <div className="flex-shrink-0">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                👔 Filtrar por rol
                            </label>
                            <div className="flex flex-wrap gap-4">
                                {roles.map(role => (
                                    <label key={role.id} className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={filterRole.includes(role.name)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setFilterRole([...filterRole, role.name]);
                                                } else {
                                                    setFilterRole(filterRole.filter(r => r !== role.name));
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">{role.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Filtro por estado */}
                        <div className="flex-1 md:max-w-sm">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                🔒 Estado
                            </label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Seleccione un Estado de usuario a filtrar</option>
                                <option value="active">Activos</option>
                                <option value="locked">Bloqueados</option>
                            </select>
                        </div>
                    </div>

                    {/* Información de resultados */}
                    <div className="text-sm text-gray-600">
                        Mostrando <strong>{currentUsers.length}</strong> de <strong>{filteredUsers.length}</strong> usuarios
                        {filteredUsers.length !== users.length && ` (filtrados de ${users.length} totales)`}
                    </div>
                </div>

                {/* Lista de usuarios en cuadrícula */}
                {currentUsers.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <div className="text-gray-400">
                            <div className="text-5xl mb-3">��</div>
                            <p className="text-lg font-medium text-gray-600">No se encontraron usuarios</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {searchTerm || filterRole.length > 0 || filterStatus ? 
                                    'Intenta ajustar los filtros de búsqueda' : 
                                    'No hay usuarios registrados en el sistema'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 ultra:grid-cols-7 gap-4">
                        {currentUsers.map((user) => (
                            <div key={user.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5 flex-shrink min-w-0 overflow-hidden">
                                {/* Avatar y nombre */}
                                <div className="flex items-center mb-3">
                                    <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-bold text-lg">
                                            {user.first_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="ml-3 flex-1 min-w-0 overflow-hidden">
                                        <div className="text-sm font-semibold text-gray-900 truncate overflow-hidden text-ellipsis">
                                            {user.first_name} {user.last_name}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            @{user.username}
                                        </div>
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="mb-3 min-w-0">
                                    <div className="text-xs text-gray-500 mb-1">Email</div>
                                    <div className="text-sm text-gray-900 truncate">{user.email}</div>
                                </div>

                                {/* Rol y estado */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        user.role?.name === 'Gerente' ? 'bg-purple-100 text-purple-800' :
                                        user.role?.name === 'Encargado' ? 'bg-blue-100 text-blue-800' :
                                        user.role?.name === 'Panadero' ? 'bg-green-100 text-green-800' :
                                        user.role?.name === 'Cajero' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {user.role?.name || 'Sin rol'}
                                    </span>
                                    {user.is_locked && (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                            🔒 Bloqueado
                                        </span>
                                    )}
                                </div>

                                {/* Acciones */}
                                <div className="flex flex-col gap-2 min-w-0">
                                    {user.is_locked ? (
                                        <button
                                            onClick={() => handleConfirmUnlock(user)}
                                            className="w-full px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                                        >
                                            🔓 Desbloquear
                                        </button>
                                    ) : (
                                        // Solo mostrar botón de bloqueo si NO es Gerente
                                        user.role?.name !== 'Gerente' && (
                                            <button
                                                onClick={() => handleConfirmLock(user)}
                                                className="w-full px-3 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
                                            >
                                                🔒 Bloquear
                                            </button>
                                        )
                                    )}
                                    <div className="grid grid-cols-2 gap-2 min-w-0">
                                        <button
                                            onClick={() => handleOpenEditModal(user)}
                                            className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            onClick={() => handleConfirmDelete(user)}
                                            className="px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                {/* Paginación */}
                {filteredUsers.length > 0 && totalPages > 1 && (
                    <div className="mt-6 bg-white rounded-lg shadow-md p-4">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                {/* Información de página */}
                                <div className="text-sm text-gray-600">
                                    Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                                </div>

                                {/* Botones de paginación */}
                                <div className="flex items-center gap-2">
                                    {/* Primera página */}
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                                            currentPage === 1
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-300'
                                        }`}
                                    >
                                        ⏮️
                                    </button>

                                    {/* Página anterior */}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            currentPage === 1
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-300'
                                        }`}
                                    >
                                        ← Anterior
                                    </button>

                                    {/* Números de página */}
                                    <div className="hidden sm:flex items-center gap-2">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                                        currentPage === pageNum
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-300'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Página siguiente */}
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                            currentPage === totalPages
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-300'
                                        }`}
                                    >
                                        Siguiente →
                                    </button>

                                    {/* Última página */}
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                                            currentPage === totalPages
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-300'
                                        }`}
                                    >
                                        ⏭️
                                    </button>
                                </div>

                                {/* Ir a página específica */}
                                <div className="flex items-center gap-2 text-sm">
                                    <label className="text-gray-600">Ir a:</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={totalPages}
                                        value={currentPage}
                                        onChange={(e) => {
                                            const page = parseInt(e.target.value);
                                            if (page >= 1 && page <= totalPages) {
                                                setCurrentPage(page);
                                            }
                                        }}
                                        className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Fin de contenido solo visible en <1200px */}

                {/* Diálogo pop-up para usuarios (solo ≥1200px) */}
                {showUsersDialog && (
                    <>
                        <div 
                            className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-300 flex flex-col"
                            style={{
                                left: `${dialogPosition.x}px`,
                                top: `${dialogPosition.y}px`,
                                width: isMinimized ? '350px' : `${dialogSize.width}px`,
                                height: isMinimized ? 'auto' : `${dialogSize.height}px`,
                                zIndex: 1000,
                                minWidth: isMinimized ? '350px' : '800px',
                                minHeight: isMinimized ? 'auto' : '500px',
                                maxWidth: '90vw',
                                maxHeight: isMinimized ? 'auto' : '90vh'
                            }}
                        >
                            {/* Barra de título draggable */}
                            <div 
                                className={`bg-blue-600 text-white px-4 py-3 cursor-move flex justify-between items-center select-none ${isMinimized ? 'min-h-[48px] px-2' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                    setDragStart({ x: e.clientX, y: e.clientY });
                                }}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <h3 className={`font-bold ${isMinimized ? 'text-sm' : 'text-base'} whitespace-normal`}>
                                        👥 Gestión de Usuarios
                                    </h3>
                                    {!isMinimized && (
                                        <span className="bg-white text-blue-600 px-2 py-1 rounded text-xs font-semibold">
                                            {filteredUsers.length} usuarios
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        className="hover:bg-blue-800 p-1.5 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openInNewWindow();
                                        }}
                                        title="Abrir en pestaña nueva"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </button>
                                    <button 
                                        className="hover:bg-blue-800 p-1.5 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMinimized(!isMinimized);
                                        }}
                                        title={isMinimized ? "Maximizar" : "Minimizar"}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {isMinimized ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                            )}
                                        </svg>
                                    </button>
                                    <button 
                                        className="hover:bg-red-600 p-1.5 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowUsersDialog(false);
                                            setIsMinimized(false);
                                        }}
                                        title="Cerrar"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Contenido del diálogo */}
                            {!isMinimized && (
                                <div className="flex flex-col flex-1" style={{minHeight: 0}}>
                                    {/* Filtros dentro del diálogo */}
                                    <div className="border-b border-gray-200 bg-gray-50 p-4 flex-shrink-0">
                                        <h4 className="text-sm font-bold text-gray-700 mb-3">🔍 Filtros</h4>
                                        
                                        {/* Búsqueda */}
                                        <div className="mb-3">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Buscar usuario</label>
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                placeholder="Nombre, apellido, email o usuario..."
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            />
                                        </div>

                                        {/* Filtros por rol */}
                                        <div className="mb-3">
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Filtrar por rol</label>
                                            <div className="flex flex-wrap gap-3">
                                                {roles.map(role => (
                                                    <label key={role.id} className="flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={filterRole.includes(role.name)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFilterRole([...filterRole, role.name]);
                                                                } else {
                                                                    setFilterRole(filterRole.filter(r => r !== role.name));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                                        />
                                                        <span className="ml-2 text-sm text-gray-700">{role.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Filtro por estado */}
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                                            <select
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                            >
                                                <option value="">Todos</option>
                                                <option value="active">Activos</option>
                                                <option value="locked">Bloqueados</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Lista de usuarios en el diálogo */}
                                    <div className="flex-1 overflow-y-auto p-4" style={{minHeight: 0, containerType: 'inline-size'}}>
                                        {filteredUsers.length === 0 ? (
                                            <div className="text-center text-gray-500 py-12">
                                                <div className="text-4xl mb-3">👤</div>
                                                <p>No se encontraron usuarios</p>
                                            </div>
                                        ) : (
                                            <div className="users-overlay-grid">
                                                {filteredUsers.map(user => (
                                                    <div key={user.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                                                        <div className="flex items-center mb-3">
                                                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <span className="text-blue-600 font-bold">
                                                                    {user.first_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="ml-3 flex-1 min-w-0">
                                                                <div className="text-sm font-semibold text-gray-900 truncate">
                                                                    {user.first_name} {user.last_name}
                                                                </div>
                                                                <div className="text-xs text-gray-500 truncate">
                                                                    @{user.username}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mb-2">
                                                            <div className="text-xs text-gray-500">Email</div>
                                                            <div className="text-sm text-gray-900 truncate">{user.email}</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mb-4">
                                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                                user.role?.name === 'Gerente' ? 'bg-purple-100 text-purple-800' :
                                                                user.role?.name === 'Encargado' ? 'bg-blue-100 text-blue-800' :
                                                                user.role?.name === 'Panadero' ? 'bg-green-100 text-green-800' :
                                                                user.role?.name === 'Cajero' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {user.role?.name || 'Sin rol'}
                                                            </span>
                                                            {user.is_locked && (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                                                    🔒 Bloqueado
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Acciones */}
                                                        <div className="flex flex-col gap-2">
                                                            {user.is_locked ? (
                                                                <button
                                                                    onClick={() => handleConfirmUnlock(user)}
                                                                    className="w-full px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
                                                                >
                                                                    🔓 Desbloquear
                                                                </button>
                                                            ) : (
                                                                user.role?.name !== 'Gerente' && (
                                                                    <button
                                                                        onClick={() => handleConfirmLock(user)}
                                                                        className="w-full px-3 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
                                                                    >
                                                                        🔒 Bloquear
                                                                    </button>
                                                                )
                                                            )}
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <button
                                                                    onClick={() => handleOpenEditModal(user)}
                                                                    className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                                                >
                                                                    ✏️ Editar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleConfirmDelete(user)}
                                                                    className="px-3 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                                                                >
                                                                    🗑️ Eliminar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Manejador de resize */}
                                    <div
                                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsResizing(true);
                                            setResizeStart({ width: dialogSize.width, height: dialogSize.height });
                                            setDragStart({ x: e.clientX, y: e.clientY });
                                        }}
                                        style={{
                                            background: 'linear-gradient(135deg, transparent 0%, transparent 50%, #94a3b8 50%, #94a3b8 100%)'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Overlay - REMOVIDO PARA HACERLO NO-MODAL */}
                        {/* El diálogo ahora es no-modal y permite interacción con el fondo */}
                    </>
                )}

                {/* Modal de Creación */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto" style={{
                            maxWidth: window.innerWidth >= 1920 ? '700px' : 
                                     window.innerWidth >= 1500 ? '650px' : 
                                     window.innerWidth >= 1300 ? '600px' : 
                                     window.innerWidth >= 1000 ? '550px' : 
                                     '28rem'
                        }}>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-4">
                                    ➕ Crear Nuevo Usuario
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Usuario *
                                        </label>
                                        <input
                                            type="text"
                                            value={newUser.username}
                                            onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="juangarcia"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nombre(s) *
                                        </label>
                                        <input
                                            type="text"
                                            value={newUser.firstName}
                                            onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Juan Carlos"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Apellido *
                                        </label>
                                        <input
                                            type="text"
                                            value={newUser.lastName}
                                            onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="García"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={newUser.email}
                                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="usuario@ejemplo.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Contraseña *
                                        </label>
                                        <input
                                            type="password"
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rol *
                                        </label>
                                        <select
                                            value={newUser.roleId}
                                            onChange={(e) => setNewUser({...newUser, roleId: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Seleccionar rol...</option>
                                            {roles.map(role => (
                                                <option key={role.id} value={role.id}>
                                                    {role.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                                    <button
                                        onClick={handleCloseModals}
                                        className="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCreateUser}
                                        className="w-full sm:w-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                    >
                                        Crear Usuario
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Edición */}
                {showEditModal && !showUpdateConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto" style={{
                            maxWidth: window.innerWidth >= 1920 ? '700px' : 
                                     window.innerWidth >= 1500 ? '650px' : 
                                     window.innerWidth >= 1300 ? '600px' : 
                                     window.innerWidth >= 1000 ? '550px' : 
                                     '28rem'
                        }}>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-4">
                                    ✏️ Editar Usuario
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Usuario *
                                        </label>
                                        <input
                                            type="text"
                                            value={editUser.username}
                                            onChange={(e) => setEditUser({...editUser, username: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nombre(s) *
                                        </label>
                                        <input
                                            type="text"
                                            value={editUser.firstName}
                                            onChange={(e) => setEditUser({...editUser, firstName: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Apellido *
                                        </label>
                                        <input
                                            type="text"
                                            value={editUser.lastName}
                                            onChange={(e) => setEditUser({...editUser, lastName: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={editUser.email}
                                            onChange={(e) => setEditUser({...editUser, email: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nueva Contraseña (dejar en blanco para no cambiar)
                                        </label>
                                        <input
                                            type="password"
                                            value={editUser.password}
                                            onChange={(e) => setEditUser({...editUser, password: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="••••••••"
                                            autoComplete="new-password"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rol *
                                        </label>
                                        <select
                                            value={editUser.roleId}
                                            onChange={(e) => setEditUser({...editUser, roleId: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Seleccionar rol...</option>
                                            {roles.map(role => (
                                                <option key={role.id} value={role.id}>
                                                    {role.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                                    <button
                                        onClick={handleCloseModals}
                                        className="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleConfirmUpdate}
                                        className="w-full sm:w-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                    >
                                        Actualizar Datos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmación de Actualización */}
                {showUpdateConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">
                                ⚠️ Confirmación
                            </h3>
                            <p className="text-gray-700 mb-6">
                                ¿Estás seguro de que deseas editar las credenciales de <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>?
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <button
                                    onClick={() => setShowUpdateConfirm(false)}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdateUser}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmación de Eliminación */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">
                                ⚠️ Confirmación
                            </h3>
                            <p className="text-gray-700 mb-6">
                                ¿Estás seguro de que deseas eliminar a <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>?
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <button
                                    onClick={handleCloseModals}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmación de Desbloqueo */}
                {showUnlockConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">
                                🔓 Confirmación de Desbloqueo
                            </h3>
                            <p className="text-gray-700 mb-6">
                                ¿Estás seguro de que deseas desbloquear a <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>?
                                <br /><br />
                                <span className="text-sm text-gray-600">
                                    Esto restablecerá los intentos de inicio de sesión fallidos y permitirá al usuario acceder nuevamente al sistema.
                                </span>
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <button
                                    onClick={handleCloseModals}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUnlockUser}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                                >
                                    Desbloquear
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmación de Bloqueo */}
                {showLockConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">
                                🔒 Confirmación de Bloqueo
                            </h3>
                            <p className="text-gray-700 mb-6">
                                ¿Estás seguro de que deseas bloquear a <strong>{selectedUser?.first_name} {selectedUser?.last_name}</strong>?
                                <br /><br />
                                <span className="text-sm text-gray-600">
                                    El usuario no podrá iniciar sesión hasta que sea desbloqueado manualmente.
                                </span>
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <button
                                    onClick={handleCloseModals}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleLockUser}
                                    className="w-full sm:w-1/2 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                                >
                                    Bloquear
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
