
import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import api from '../services/api';

const ProductionCreation = ({ products, userRole, loadProducts }) => {
    const [productions, setProductions] = useState([]);
    const [showDialog, setShowDialog] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [dialogSize, setDialogSize] = useState({ width: 900, height: 600 });
    const [dialogPosition, setDialogPosition] = useState({ x: 16, y: 16 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [selectedProduction, setSelectedProduction] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [externalWindow, setExternalWindow] = useState(null);
    const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1200);
    const [showCreationPanel, setShowCreationPanel] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = más nuevos primero, 'asc' = más viejos primero
    const [showFilters, setShowFilters] = useState(false);
    const [userFilter, setUserFilter] = useState('');
    const [totalFilter, setTotalFilter] = useState('');
    const [totalFilterOp, setTotalFilterOp] = useState('equals');
    const [dateFromYear, setDateFromYear] = useState('');
    const [dateFromMonth, setDateFromMonth] = useState('');
    const [dateFromDay, setDateFromDay] = useState('');
    const [dateFromHour, setDateFromHour] = useState('');
    const [dateFromMinute, setDateFromMinute] = useState('');
    const [dateToYear, setDateToYear] = useState('');
    const [dateToMonth, setDateToMonth] = useState('');
    const [dateToDay, setDateToDay] = useState('');
    const [dateToHour, setDateToHour] = useState('');
    const [dateToMinute, setDateToMinute] = useState('');
    const selectedProductsRef = useRef(selectedProducts);
    const externalWindowRef = useRef(null);
    
    useEffect(() => {
        if (userRole === 'Gerente') {
            loadProductions();
        }
    }, [userRole]);

    // Mantener ref actualizado con selectedProducts
    useEffect(() => {
        selectedProductsRef.current = selectedProducts;
    }, [selectedProducts]);

    // Mantener ref actualizado con externalWindow
    useEffect(() => {
        externalWindowRef.current = externalWindow;
    }, [externalWindow]);

    useEffect(() => {
        // Cleanup: cerrar ventana externa al desmontar componente
        return () => {
            if (externalWindow && !externalWindow.closed) {
                externalWindow.close();
            }
        };
    }, [externalWindow]);

    useEffect(() => {
        // Detectar cambios en el tamaño de pantalla
        const handleResize = () => {
            setIsLargeScreen(window.innerWidth >= 1200);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Manejar arrastre del diálogo
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            setDialogPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    // Escuchar mensajes de la ventana externa - DEBE estar antes de cualquier return condicional
    useEffect(() => {
        const handleMessage = (event) => {
            if (!event.data || !event.data.type) return;
            
            switch (event.data.type) {
                case 'ADD_PRODUCT':
                    setSelectedProducts(prev => {
                        const exists = prev.find(p => p.id === event.data.product.id);
                        if (exists) return prev;
                        return [...prev, { ...event.data.product, quantity: 0 }];
                    });
                    setSearchTerm('');
                    break;
                case 'REMOVE_PRODUCT':
                    setSelectedProducts(prev => prev.filter(p => p.id !== event.data.productId));
                    break;
                case 'UPDATE_QUANTITY':
                    setSelectedProducts(prev => prev.map(p => 
                        p.id === event.data.productId ? { ...p, quantity: parseInt(event.data.quantity) || 0 } : p
                    ));
                    break;
                case 'SEARCH_CHANGE':
                    setSearchTerm(event.data.value);
                    break;
                case 'SUBMIT_PRODUCTION':
                    // Se manejará con un ref para evitar problemas de closure
                    if (window.handleSubmitProduction) {
                        window.handleSubmitProduction();
                    }
                    break;
                case 'CONFIRM_PRODUCTION':
                    // Confirmar la carga desde la ventana externa
                    confirmSubmit();
                    break;
                case 'CANCEL_CONFIRM':
                    // Llamar la función global para cancelar
                    if (window.handleCancelConfirm) {
                        window.handleCancelConfirm();
                    }
                    break;
                case 'WINDOW_CLOSED':
                    setExternalWindow(null);
                    setSelectedProducts([]);
                    setSearchTerm('');
                    setError('');
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Efecto para renderizar la ventana externa cuando está lista y cuando cambian los datos
    useEffect(() => {
        if (!externalWindow || externalWindow.closed) return;
        
        // Renderizar inmediatamente si la ventana ya está lista
        const root = externalWindow.document.getElementById('root');
        if (root && root.innerHTML !== 'Cargando...') {
            // La ventana ya está lista, re-renderizar con los nuevos datos
            renderInNewWindowDirect(externalWindow);
        }
        
        // También escuchar WINDOW_READY para el render inicial
        const handleWindowReady = (event) => {
            if (event.data && event.data.type === 'WINDOW_READY') {
                renderInNewWindowDirect(externalWindow);
            }
        };

        window.addEventListener('message', handleWindowReady);
        return () => window.removeEventListener('message', handleWindowReady);
    }, [externalWindow, products, selectedProducts, searchTerm, error]);

    const loadProductions = async () => {
        try {
            const response = await api.get('/productions/');
            setProductions(response.data);
        } catch (err) {
            console.error('Error loading productions:', err);
        }
    };

    const handleMouseDown = (e) => {
        if (isFullscreen || isMinimized) return;
        // Solo permitir arrastre desde el header, no desde botones
        if (e.target.closest('button') || e.target.closest('input')) return;
        
        const dialogElement = e.currentTarget.parentElement;
        const rect = dialogElement.getBoundingClientRect();
        
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setIsDragging(true);
    };

    // Función para renderizar en ventana externa (necesita estar antes del return condicional)
    const renderInNewWindowDirect = (win, showModal = false) => {
        if (!win || win.closed) return;
        
        const root = win.document.getElementById('root');
        if (!root) return;

        const finalProds = products.filter(p => !p.is_ingredient && p.category === 'Producto');
        const filteredProds = finalProds.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        root.innerHTML = `
            <div class="w-full h-screen flex flex-col bg-gray-50">
                <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                    <div class="flex items-center gap-2">
                        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <h3 class="text-lg font-bold text-gray-800">Nueva Carga de Producción</h3>
                            <p class="text-xs text-gray-600">${new Date().toLocaleDateString('es-AR')} • ${selectedProducts.length} items</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex-1 overflow-y-auto p-4">
                    ${error ? `<div class="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">${error}</div>` : ''}
                    
                    <div class="mb-4">
                        <label class="block text-xs font-semibold text-gray-700 uppercase mb-1.5">Producto</label>
                        <div class="relative">
                            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                id="searchInput"
                                placeholder="Escribe para buscar..."
                                class="w-full pl-10 pr-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                value="${searchTerm}"
                            />
                        </div>
                        ${searchTerm && filteredProds.length > 0 ? `
                            <div class="mt-2 max-h-40 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                                ${filteredProds.map(product => `
                                    <button 
                                        onclick="window.opener.postMessage({ type: 'ADD_PRODUCT', product: ${JSON.stringify(product).replace(/"/g, '&quot;')} }, '*')"
                                        ${selectedProducts.find(p => p.id === product.id) ? 'disabled' : ''}
                                        class="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0 ${selectedProducts.find(p => p.id === product.id) ? 'opacity-50 cursor-not-allowed' : ''}">
                                        <div class="font-medium text-gray-800 text-sm">${product.name}</div>
                                        <div class="text-xs text-gray-500">Stock: ${product.stock}</div>
                                    </button>
                                `).join('')}
                            </div>
                        ` : searchTerm && filteredProds.length === 0 ? `
                            <div class="mt-2 px-3 py-2 text-gray-500 text-center text-sm bg-white border border-gray-300 rounded-lg">No se encontraron productos</div>
                        ` : ''}
                    </div>
                    
                    <div class="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        ${selectedProducts.length === 0 ? `
                            <div class="col-span-full text-center py-8 text-gray-400">
                                <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p class="text-base font-medium">No hay productos agregados</p>
                                <p class="text-xs">Busca y selecciona productos arriba</p>
                            </div>
                        ` : selectedProducts.map(product => `
                            <div class="bg-white rounded-lg border-2 border-gray-200 p-2.5 relative hover:border-blue-300 transition-colors">
                                <button onclick="window.opener.postMessage({ type: 'REMOVE_PRODUCT', productId: ${product.id} }, '*')" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <div class="mb-2">
                                    <h4 class="font-bold text-gray-800 text-xs leading-tight break-words line-clamp-2" title="${product.name}">${product.name}</h4>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 uppercase font-semibold mb-1">Cantidad</label>
                                    <input
                                        type="number"
                                        value="${product.quantity || ''}"
                                        onchange="window.opener.postMessage({ type: 'UPDATE_QUANTITY', productId: ${product.id}, quantity: this.value }, '*')"
                                        min="0"
                                        class="w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center text-base font-bold"
                                        placeholder="0"
                                    />
                                    <span class="block text-[10px] text-gray-500 text-center mt-0.5">un.</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="border-t border-gray-200 p-4 bg-white">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs text-gray-600">Total Unidades</p>
                            <p class="text-2xl font-bold text-gray-800">${selectedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0)}</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="window.close()" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors text-sm">
                                Cancelar
                            </button>
                            <button 
                                onclick="window.opener.postMessage({ type: 'SUBMIT_PRODUCTION' }, '*')" 
                                ${selectedProducts.filter(p => p.quantity > 0).length === 0 ? 'disabled' : ''}
                                class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
                
                ${showModal ? `
                    <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50">
                        <div class="bg-white rounded-lg shadow-2xl w-full max-w-md">
                            <div class="p-6">
                                <div class="flex items-center gap-3 mb-4">
                                    <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                        <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-lg font-bold text-gray-800">Confirmar Carga</h3>
                                        <p class="text-sm text-gray-600">Esta acción actualizará el inventario</p>
                                    </div>
                                </div>
                                
                                <div class="mb-6">
                                    <p class="text-gray-700 mb-4">
                                        ¿Estás seguro que deseas cargar esta producción?
                                    </p>
                                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-sm text-gray-600">Productos:</span>
                                            <span class="font-semibold text-gray-800">${selectedProducts.filter(p => p.quantity > 0).length}</span>
                                        </div>
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm text-gray-600">Total Unidades:</span>
                                            <span class="text-lg font-bold text-orange-600">${selectedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0)} un.</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="flex gap-3">
                                    <button
                                        onclick="window.opener.postMessage({ type: 'CANCEL_CONFIRM' }, '*')"
                                        class="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onclick="window.opener.postMessage({ type: 'CONFIRM_PRODUCTION' }, '*')"
                                        class="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md"
                                    >
                                        Confirmar Carga
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Agregar event listener para búsqueda y mantener el foco
        const searchInput = win.document.getElementById('searchInput');
        if (searchInput) {
            // Guardar posición del cursor
            const cursorPos = searchTerm.length;
            searchInput.focus();
            searchInput.setSelectionRange(cursorPos, cursorPos);
            
            searchInput.addEventListener('input', (e) => {
                if (win.opener && !win.opener.closed) {
                    win.opener.postMessage({ type: 'SEARCH_CHANGE', value: e.target.value }, '*');
                }
            });
        }
    };

    // Función para submit desde ventana externa
    const handleSubmitProduction = () => {
        const currentProducts = selectedProductsRef.current;
        const validProducts = currentProducts.filter(p => p.quantity > 0);
        
        if (validProducts.length === 0) {
            setError('Por favor, agrega al menos un producto con cantidad mayor a 0.');
            return;
        }

        // Mostrar modal de confirmación en la ventana externa
        const win = externalWindowRef.current;
        if (win && !win.closed) {
            renderInNewWindowDirect(win, true); // true indica mostrar modal
        }
    };

    // Función para cancelar confirmación desde ventana externa
    const handleCancelConfirm = () => {
        // Volver a renderizar sin modal
        const win = externalWindowRef.current;
        if (win && !win.closed) {
            renderInNewWindowDirect(win, false);
        }
    };

    // Asignar funciones a window para que los mensajes puedan llamarlas
    window.handleSubmitProduction = handleSubmitProduction;
    window.handleCancelConfirm = handleCancelConfirm;

    // Verificación de rol DESPUÉS de todos los hooks
    if (userRole !== 'Gerente') {
        return (
            <div className="unauthorized-message">
                <h2>Acceso Denegado</h2>
                <p>Esta función solo está disponible para el rol de Gerente.</p>
            </div>
        );
    }

    // Funciones y cálculos (no son hooks, pueden estar después del return condicional)
    const finalProducts = products.filter(p => !p.is_ingredient && p.category === 'Producto');
    
    const filteredProducts = finalProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddProduct = (product) => {
        if (selectedProducts.find(p => p.id === product.id)) {
            return;
        }
        setSelectedProducts([...selectedProducts, { ...product, quantity: 0 }]);
        setSearchTerm('');
    };

    const handleRemoveProduct = (productId) => {
        setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
    };

    // Función para parsear fechas
    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (isoMatch) {
            const [, year, month, day, hour, minute, second] = isoMatch;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
        }
        const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})/);
        if (slashMatch) {
            const [, day, month, year, hour, minute] = slashMatch;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
        }
        const parsedDate = new Date(dateStr);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
    };

    // Función para obtener producciones filtradas
    const getFilteredProductions = () => {
        let filtered = [...productions];

        // Filtro por usuario
        if (userFilter.trim()) {
            filtered = filtered.filter(p => 
                p.user && p.user.toLowerCase().includes(userFilter.toLowerCase())
            );
        }

        // Filtro por total
        if (totalFilter.trim()) {
            const totalValue = parseFloat(totalFilter);
            if (!isNaN(totalValue)) {
                filtered = filtered.filter(p => {
                    switch (totalFilterOp) {
                        case 'lt': return p.total_units < totalValue;
                        case 'lte': return p.total_units <= totalValue;
                        case 'gt': return p.total_units > totalValue;
                        case 'gte': return p.total_units >= totalValue;
                        case 'equals': return p.total_units === totalValue;
                        default: return true;
                    }
                });
            }
        }

        // Filtro por fecha (flexible como Movimientos_De_Caja)
        if (dateFromYear || dateFromMonth || dateFromDay || dateFromHour || dateFromMinute || 
            dateToYear || dateToMonth || dateToDay || dateToHour || dateToMinute) {
            filtered = filtered.filter(production => {
                const prodDate = parseAnyDate(production.created_at);
                if (!prodDate) return false;
                const hasToFilters = dateToYear || dateToMonth || dateToDay || dateToHour || dateToMinute;
                let matches = true;

                if (dateFromYear && matches) {
                    if (hasToFilters) {
                        matches = prodDate.getFullYear() >= parseInt(dateFromYear);
                    } else {
                        matches = prodDate.getFullYear() === parseInt(dateFromYear);
                    }
                }

                if (dateFromMonth && matches) {
                    if (hasToFilters) {
                        if (dateFromYear) {
                            const yearMatches = prodDate.getFullYear() > parseInt(dateFromYear);
                            const yearExact = prodDate.getFullYear() === parseInt(dateFromYear);
                            matches = yearMatches || (yearExact && prodDate.getMonth() >= (parseInt(dateFromMonth) - 1));
                        } else {
                            matches = prodDate.getMonth() >= (parseInt(dateFromMonth) - 1);
                        }
                    } else {
                        const yearMatches = !dateFromYear || prodDate.getFullYear() === parseInt(dateFromYear);
                        matches = yearMatches && prodDate.getMonth() === (parseInt(dateFromMonth) - 1);
                    }
                }

                if (dateFromDay && matches) {
                    if (hasToFilters) {
                        const yearMatch = !dateFromYear || prodDate.getFullYear() >= parseInt(dateFromYear);
                        const monthMatch = !dateFromMonth || prodDate.getMonth() >= (parseInt(dateFromMonth) - 1);
                        if (dateFromYear && dateFromMonth) {
                            const exactYearMonth = prodDate.getFullYear() === parseInt(dateFromYear) && 
                                                   prodDate.getMonth() === (parseInt(dateFromMonth) - 1);
                            matches = (!exactYearMonth) || (exactYearMonth && prodDate.getDate() >= parseInt(dateFromDay));
                        } else {
                            matches = yearMatch && monthMatch && prodDate.getDate() >= parseInt(dateFromDay);
                        }
                    } else {
                        const yearMatches = !dateFromYear || prodDate.getFullYear() === parseInt(dateFromYear);
                        const monthMatches = !dateFromMonth || prodDate.getMonth() === (parseInt(dateFromMonth) - 1);
                        matches = yearMatches && monthMatches && prodDate.getDate() === parseInt(dateFromDay);
                    }
                }

                if (dateFromHour && matches) {
                    const yearMatches = !dateFromYear || prodDate.getFullYear() === parseInt(dateFromYear);
                    const monthMatches = !dateFromMonth || prodDate.getMonth() === (parseInt(dateFromMonth) - 1);
                    const dayMatches = !dateFromDay || prodDate.getDate() === parseInt(dateFromDay);
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches) {
                            matches = prodDate.getHours() >= parseInt(dateFromHour);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && prodDate.getHours() === parseInt(dateFromHour);
                    }
                }

                if (dateFromMinute && matches) {
                    const yearMatches = !dateFromYear || prodDate.getFullYear() === parseInt(dateFromYear);
                    const monthMatches = !dateFromMonth || prodDate.getMonth() === (parseInt(dateFromMonth) - 1);
                    const dayMatches = !dateFromDay || prodDate.getDate() === parseInt(dateFromDay);
                    const hourMatches = !dateFromHour || prodDate.getHours() === parseInt(dateFromHour);
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches && hourMatches) {
                            matches = prodDate.getMinutes() >= parseInt(dateFromMinute);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && hourMatches && prodDate.getMinutes() === parseInt(dateFromMinute);
                    }
                }

                if (hasToFilters) {
                    if (dateToYear && matches) {
                        matches = prodDate.getFullYear() <= parseInt(dateToYear);
                    }
                    if (dateToMonth && matches) {
                        if (dateToYear) {
                            const yearMatches = prodDate.getFullYear() < parseInt(dateToYear);
                            const yearExact = prodDate.getFullYear() === parseInt(dateToYear);
                            matches = yearMatches || (yearExact && prodDate.getMonth() <= (parseInt(dateToMonth) - 1));
                        } else {
                            matches = prodDate.getMonth() <= (parseInt(dateToMonth) - 1);
                        }
                    }
                    if (dateToDay && matches) {
                        const exactYearMonth = (!dateToYear || prodDate.getFullYear() === parseInt(dateToYear)) && 
                                               (!dateToMonth || prodDate.getMonth() === (parseInt(dateToMonth) - 1));
                        if (exactYearMonth) {
                            matches = prodDate.getDate() <= parseInt(dateToDay);
                        }
                    }
                    if (dateToHour && matches) {
                        const exactDate = (!dateToYear || prodDate.getFullYear() === parseInt(dateToYear)) &&
                                          (!dateToMonth || prodDate.getMonth() === (parseInt(dateToMonth) - 1)) &&
                                          (!dateToDay || prodDate.getDate() === parseInt(dateToDay));
                        if (exactDate) {
                            matches = prodDate.getHours() <= parseInt(dateToHour);
                        }
                    }
                    if (dateToMinute && matches) {
                        const exactDateTime = (!dateToYear || prodDate.getFullYear() === parseInt(dateToYear)) &&
                                              (!dateToMonth || prodDate.getMonth() === (parseInt(dateToMonth) - 1)) &&
                                              (!dateToDay || prodDate.getDate() === parseInt(dateToDay)) &&
                                              (!dateToHour || prodDate.getHours() === parseInt(dateToHour));
                        if (exactDateTime) {
                            matches = prodDate.getMinutes() <= parseInt(dateToMinute);
                        }
                    }
                }
                return matches;
            });
        }

        // Ordenar por fecha
        return filtered.sort((a, b) => {
            const dateA = parseAnyDate(a.created_at);
            const dateB = parseAnyDate(b.created_at);
            if (!dateA || !dateB) return 0;
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });
    };

    const filteredProductions = getFilteredProductions();


    const handleQuantityChange = (productId, quantity) => {
        setSelectedProducts(selectedProducts.map(p => 
            p.id === productId ? { ...p, quantity: parseInt(quantity) || 0 } : p
        ));
    };

    const getTotalUnits = () => {
        return selectedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        const validProducts = selectedProducts.filter(p => p.quantity > 0);
        
        if (validProducts.length === 0) {
            setError('Por favor, agrega al menos un producto con cantidad mayor a 0.');
            return;
        }

        // Mostrar modal de confirmación
        setShowConfirmModal(true);
    };

    const confirmSubmit = async () => {
        setShowConfirmModal(false);
        
        try {
            // Usar ref para obtener el valor actual de selectedProducts
            const currentProducts = selectedProductsRef.current;
            const response = await api.post('/productions/batch/', {
                productions: currentProducts
                    .filter(p => p.quantity > 0)
                    .map(p => ({
                        product_id: p.id,
                        quantity_produced: p.quantity
                    }))
            });
            
            // Abrir ventana con resumen de cambios
            openSummaryWindow(response.data);
            
            setMessage('✅ Producción registrada con éxito.');
            setSelectedProducts([]);
            setShowDialog(false);
            setShowCreationPanel(false);
            
            // Cerrar ventana externa si existe
            if (externalWindow && !externalWindow.closed) {
                externalWindow.close();
                setExternalWindow(null);
            }
            
            await loadProducts();
            await loadProductions();
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Ocurrió un error al registrar la producción.';
            setError(errorMessage);
            console.error('Error creating production:', err);
        }
    };

    const openDetailsModal = (production) => {
        setSelectedProduction(production);
        setShowDetailsModal(true);
    };

    const closeDetailsModal = () => {
        setShowDetailsModal(false);
        setSelectedProduction(null);
    };

    const openInNewWindow = () => {
        // Abrir ventana con controles nativos completos (minimizar, maximizar, cerrar, resize)
        // Dejando la configuración al mínimo para que el navegador use valores por defecto
        const newWindow = window.open('', '_blank', 'width=1000,height=800');
        
        if (newWindow) {
            setExternalWindow(newWindow);
            setShowDialog(false);
            
            newWindow.document.write(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Nueva Producción</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                        .line-clamp-2 {
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                        }
                    </style>
                </head>
                <body>
                    <div id="root">Cargando...</div>
                    <script>
                        window.addEventListener('beforeunload', () => {
                            if (window.opener && !window.opener.closed) {
                                window.opener.postMessage({ type: 'WINDOW_CLOSED' }, '*');
                            }
                        });
                        
                        // Esperar a que Tailwind CSS se cargue
                        setTimeout(() => {
                            window.opener.postMessage({ type: 'WINDOW_READY' }, '*');
                        }, 500);
                    </script>
                </body>
                </html>
            `);
            newWindow.document.close();
        }
    };

    const openSummaryWindow = (productionData) => {
        const summaryWindow = window.open('', '_blank', 'width=1400,height=900');
        if (!summaryWindow) {
            alert('Por favor permite las ventanas emergentes para ver el resumen');
            return;
        }

        // Tabla de productos creados CON sus insumos específicos
        const productsDetailHtml = productionData.changes?.products?.map((product, idx) => {
            const ingredientsRows = product.ingredients_used?.map((ing, ingIdx) => `
                <tr class="${ingIdx % 2 === 0 ? 'bg-orange-50' : 'bg-white'}">
                    <td class="px-4 py-2 text-gray-700 pl-8">→ ${ing.name}</td>
                    <td class="px-4 py-2 text-center text-gray-500">-</td>
                    <td class="px-4 py-2 text-center text-orange-600 font-semibold">${ing.formatted_used}</td>
                    <td class="px-4 py-2 text-center text-gray-500">-</td>
                    <td class="px-4 py-2 text-center text-gray-500">-</td>
                </tr>
            `).join('') || '';

            return `
                <tr class="bg-green-100 border-t-2 border-green-300">
                    <td class="px-4 py-3 font-bold text-gray-900">${product.name}</td>
                    <td class="px-4 py-3 text-center text-gray-700">${product.stock_before} un.</td>
                    <td class="px-4 py-3 text-center">
                        <span class="inline-block bg-green-600 text-white px-3 py-1 rounded-full font-bold">+${product.quantity_produced} un.</span>
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-green-700">${product.stock_after} un.</td>
                    <td class="px-4 py-3 text-center text-sm text-gray-600">
                        ${product.stock_before} + ${product.quantity_produced} = <strong>${product.stock_after}</strong>
                    </td>
                </tr>
                ${ingredientsRows}
            `;
        }).join('') || '';

        // Tabla de totales de insumos
        const ingredientsTotalsHtml = productionData.changes?.ingredients?.length > 0 ? `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="bg-orange-600 text-white">
                            <th class="px-4 py-3 text-left font-semibold">Insumo</th>
                            <th class="px-4 py-3 text-center font-semibold">Stock Previo</th>
                            <th class="px-4 py-3 text-center font-semibold">Total Usado</th>
                            <th class="px-4 py-3 text-center font-semibold">Stock Final</th>
                            <th class="px-4 py-3 text-center font-semibold">Cálculo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productionData.changes.ingredients.map((ingredient, idx) => `
                            <tr class="${idx % 2 === 0 ? 'bg-orange-50' : 'bg-white'} border-b border-orange-200">
                                <td class="px-4 py-3 font-semibold text-gray-800">${ingredient.name}</td>
                                <td class="px-4 py-3 text-center text-gray-700">${ingredient.formatted_before}</td>
                                <td class="px-4 py-3 text-center">
                                    <span class="inline-block bg-orange-600 text-white px-3 py-1 rounded-full font-bold">-${ingredient.formatted_used}</span>
                                </td>
                                <td class="px-4 py-3 text-center font-bold text-orange-700">${ingredient.formatted_after}</td>
                                <td class="px-4 py-3 text-center text-sm text-gray-600">
                                    ${ingredient.formatted_before} - ${ingredient.formatted_used} = <strong>${ingredient.formatted_after}</strong>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '';

        summaryWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <title>Resumen de Producción</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background-color: #f3f4f6; }
                        @media print {
                            .no-print { display: none !important; }
                        }
                        table { font-size: 0.95rem; }
                    </style>
                </head>
                <body>
                    <div class="min-h-screen p-6">
                        <div class="max-w-7xl mx-auto">
                            <div class="bg-white rounded-lg shadow-lg">
                                <!-- Header -->
                                <div class="flex items-center justify-between p-6 border-b border-gray-200">
                                    <div class="flex items-center gap-3">
                                        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h1 class="text-2xl font-bold text-gray-800">Producción Registrada</h1>
                                            <p class="text-sm text-gray-600">Resumen detallado de cambios en inventario</p>
                                        </div>
                                    </div>
                                    <button onclick="window.close()" class="no-print p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                        <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                
                                <!-- Content -->
                                <div id="summary-content" class="p-6">
                                    ${productionData.changes?.products?.length > 0 ? `
                                    <div class="mb-8">
                                        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase">
                                            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            Productos Creados e Insumos Utilizados
                                        </h2>
                                        <div class="overflow-x-auto">
                                            <table class="w-full border-collapse">
                                                <thead>
                                                    <tr class="bg-green-600 text-white">
                                                        <th class="px-4 py-3 text-left font-semibold">Producto / Insumo</th>
                                                        <th class="px-4 py-3 text-center font-semibold">Stock Previo</th>
                                                        <th class="px-4 py-3 text-center font-semibold">Cantidad</th>
                                                        <th class="px-4 py-3 text-center font-semibold">Stock Final</th>
                                                        <th class="px-4 py-3 text-center font-semibold">Cálculo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${productsDetailHtml}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    ` : ''}

                                    ${productionData.changes?.ingredients?.length > 0 ? `
                                    <div class="mb-8">
                                        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 uppercase">
                                            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            Total de Insumos Utilizados
                                        </h2>
                                        ${ingredientsTotalsHtml}
                                    </div>
                                    ` : ''}
                                </div>

                                <!-- Footer -->
                                <div class="no-print border-t border-gray-200 p-6 bg-gray-50 flex justify-end">
                                    <button onclick="window.close()" class="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md">
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `);
        summaryWindow.document.close();
    };

    const renderInNewWindow = (win) => {
        if (!win || win.closed) return;
        
        const root = win.document.getElementById('root');
        if (!root) return;

        const finalProducts = products.filter(p => !p.is_ingredient && p.category === 'Producto');
        const filteredProducts = finalProducts.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const render = () => {
            if (!win || win.closed) return;
            
            root.innerHTML = `
                <div class="w-full h-screen flex flex-col bg-gray-50">
                    <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                        <div class="flex items-center gap-2">
                            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                                <h3 class="text-lg font-bold text-gray-800">Nueva Carga de Producción</h3>
                                <p class="text-xs text-gray-600">${new Date().toLocaleDateString('es-AR')} • ${selectedProducts.length} items</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto p-4">
                        ${error ? `<div class="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">${error}</div>` : ''}
                        
                        <div class="mb-4">
                            <label class="block text-xs font-semibold text-gray-700 uppercase mb-1.5">Producto</label>
                            <div class="relative">
                                <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    id="searchInput"
                                    placeholder="Escribe para buscar..."
                                    class="w-full pl-10 pr-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                    value="${searchTerm}"
                                />
                            </div>
                            ${searchTerm && filteredProducts.length > 0 ? `
                                <div class="mt-2 max-h-40 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                                    ${filteredProducts.map(product => `
                                        <button 
                                            onclick="window.opener.postMessage({ type: 'ADD_PRODUCT', product: ${JSON.stringify(product).replace(/"/g, '&quot;')} }, '*')"
                                            ${selectedProducts.find(p => p.id === product.id) ? 'disabled' : ''}
                                            class="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0 ${selectedProducts.find(p => p.id === product.id) ? 'opacity-50 cursor-not-allowed' : ''}">
                                            <div class="font-medium text-gray-800 text-sm">${product.name}</div>
                                            <div class="text-xs text-gray-500">Stock: ${product.stock}</div>
                                        </button>
                                    `).join('')}
                                </div>
                            ` : searchTerm && filteredProducts.length === 0 ? `
                                <div class="mt-2 px-3 py-2 text-gray-500 text-center text-sm bg-white border border-gray-300 rounded-lg">No se encontraron productos</div>
                            ` : ''}
                            <div id="searchResults"></div>
                        </div>
                        
                        <div id="productGrid" class="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            ${selectedProducts.length === 0 ? `
                                <div class="col-span-full text-center py-8 text-gray-400">
                                    <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p class="text-base font-medium">No hay productos agregados</p>
                                    <p class="text-xs">Busca y selecciona productos arriba</p>
                                </div>
                            ` : selectedProducts.map(product => `
                                <div class="bg-white rounded-lg border-2 border-gray-200 p-2.5 relative hover:border-blue-300 transition-colors">
                                    <button onclick="window.opener.postMessage({ type: 'REMOVE_PRODUCT', productId: ${product.id} }, '*')" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                    <div class="mb-2">
                                        <h4 class="font-bold text-gray-800 text-xs leading-tight break-words line-clamp-2" title="${product.name}">${product.name}</h4>
                                    </div>
                                    <div>
                                        <label class="block text-[10px] text-gray-500 uppercase font-semibold mb-1">Cantidad</label>
                                        <input
                                            type="number"
                                            value="${product.quantity || ''}"
                                            onchange="window.opener.postMessage({ type: 'UPDATE_QUANTITY', productId: ${product.id}, quantity: this.value }, '*')"
                                            min="0"
                                            class="w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center text-base font-bold"
                                            placeholder="0"
                                        />
                                        <span class="block text-[10px] text-gray-500 text-center mt-0.5">un.</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="border-t border-gray-200 p-4 bg-white">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-xs text-gray-600">Total Unidades</p>
                                <p class="text-2xl font-bold text-gray-800">${selectedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0)}</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.close()" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors text-sm">
                                    Cancelar
                                </button>
                                <button 
                                    onclick="window.opener.postMessage({ type: 'SUBMIT_PRODUCTION' }, '*')" 
                                    ${selectedProducts.filter(p => p.quantity > 0).length === 0 ? 'disabled' : ''}
                                    class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Agregar event listener para búsqueda
            const searchInput = win.document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    if (win.opener && !win.opener.closed) {
                        win.opener.postMessage({ type: 'SEARCH_CHANGE', value: e.target.value }, '*');
                    }
                });
            }
        };

        render();
    };


    return (
        <>
        <div className="w-full h-full" style={{
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* En pantallas < 1200px: mostrar historial O formulario de creación (no ambos) */}
            {/* En pantallas >= 1200px: siempre mostrar historial */}
            
            {/* Vista del Historial - Se oculta en pantallas pequeñas cuando showCreationPanel está activo */}
            {(!showCreationPanel || isLargeScreen) && (
            <div 
                className="p-4 h-full overflow-y-auto"
            >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Registro de Producción</h2>
                                <p className="text-sm text-gray-600">Historial de cargas realizadas</p>
                            </div>
                        </div>
                        {/* Mostrar botón en pantallas >= 1200px para diálogo, en < 1200px para panel deslizante */}
                        <button
                            onClick={() => isLargeScreen ? setShowDialog(true) : setShowCreationPanel(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Nueva Producción
                        </button>
                    </div>

                    {/* Messages */}
                    {message && (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                            {message}
                        </div>
                    )}

                    {/* Filtros y Ordenamiento */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                            </button>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                            >
                                <option value="desc">Más nuevos primero</option>
                                <option value="asc">Más viejos primero</option>
                            </select>
                        </div>

                        {showFilters && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Filtro por Usuario */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Usuario</label>
                                        <input
                                            type="text"
                                            value={userFilter}
                                            onChange={(e) => setUserFilter(e.target.value)}
                                            placeholder="Buscar por usuario"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Filtro por Total */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Total Unidades</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={totalFilterOp}
                                                onChange={(e) => setTotalFilterOp(e.target.value)}
                                                className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="equals">=</option>
                                                <option value="lt">&lt;</option>
                                                <option value="lte">&lt;=</option>
                                                <option value="gt">&gt;</option>
                                                <option value="gte">&gt;=</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={totalFilter}
                                                onChange={(e) => setTotalFilter(e.target.value)}
                                                placeholder="Cantidad"
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Filtro de Fecha Desde */}
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Fecha Desde</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        <input
                                            type="number"
                                            value={dateFromYear}
                                            onChange={(e) => setDateFromYear(e.target.value)}
                                            placeholder="Año"
                                            min="2000"
                                            max="2100"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateFromMonth}
                                            onChange={(e) => setDateFromMonth(e.target.value)}
                                            placeholder="Mes"
                                            min="1"
                                            max="12"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateFromDay}
                                            onChange={(e) => setDateFromDay(e.target.value)}
                                            placeholder="Día"
                                            min="1"
                                            max="31"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateFromHour}
                                            onChange={(e) => setDateFromHour(e.target.value)}
                                            placeholder="Hora"
                                            min="0"
                                            max="23"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateFromMinute}
                                            onChange={(e) => setDateFromMinute(e.target.value)}
                                            placeholder="Min"
                                            min="0"
                                            max="59"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Filtro de Fecha Hasta */}
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Fecha Hasta</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        <input
                                            type="number"
                                            value={dateToYear}
                                            onChange={(e) => setDateToYear(e.target.value)}
                                            placeholder="Año"
                                            min="2000"
                                            max="2100"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateToMonth}
                                            onChange={(e) => setDateToMonth(e.target.value)}
                                            placeholder="Mes"
                                            min="1"
                                            max="12"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateToDay}
                                            onChange={(e) => setDateToDay(e.target.value)}
                                            placeholder="Día"
                                            min="1"
                                            max="31"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateToHour}
                                            onChange={(e) => setDateToHour(e.target.value)}
                                            placeholder="Hora"
                                            min="0"
                                            max="23"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={dateToMinute}
                                            onChange={(e) => setDateToMinute(e.target.value)}
                                            placeholder="Min"
                                            min="0"
                                            max="59"
                                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* Botón para limpiar filtros */}
                                <div className="mt-4">
                                    <button
                                        onClick={() => {
                                            setUserFilter('');
                                            setTotalFilter('');
                                            setTotalFilterOp('equals');
                                            setDateFromYear('');
                                            setDateFromMonth('');
                                            setDateFromDay('');
                                            setDateFromHour('');
                                            setDateFromMinute('');
                                            setDateToYear('');
                                            setDateToMonth('');
                                            setDateToDay('');
                                            setDateToHour('');
                                            setDateToMinute('');
                                        }}
                                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                                    >
                                        Limpiar Filtros
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Productions Grid */}
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                        {filteredProductions.map((production) => (
                            <div
                                key={production.id}
                                onClick={() => openDetailsModal(production)}
                                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-2 cursor-pointer border border-gray-200 hover:border-orange-400"
                            >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-[10px] font-medium text-gray-600 truncate">
                                            {new Date(production.created_at).toLocaleString('es-AR', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).replace(/\/(\d{2})\/(\d{4}),/, '/$2/$1').replace(',', ' ')}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 mb-1">
                                    <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-[9px] font-bold text-blue-600">
                                            {production.user?.charAt(0).toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-gray-600 truncate">
                                        {production.user || 'Usuario'}
                                    </span>
                                </div>
                                
                                <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
                                    <span className="text-[9px] text-gray-400 uppercase">Total</span>
                                    <span className="text-sm font-bold text-orange-600">
                                        {production.total_units} <span className="text-[10px]">un.</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Vista de Creación de Producción - Solo en pantallas < 1200px cuando showCreationPanel está activo */}
            {!isLargeScreen && showCreationPanel && (
                <div className="p-4 h-full overflow-y-auto bg-gray-50">
                    {/* Header con botón volver */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setShowCreationPanel(false);
                                    setSelectedProducts([]);
                                    setSearchTerm('');
                                    setError('');
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Nueva Producción</h2>
                                <p className="text-sm text-gray-600">Registrar carga de producción</p>
                            </div>
                        </div>
                        <button
                            onClick={openInNewWindow}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Abrir en nueva ventana"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Buscador de productos */}
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-gray-700 uppercase mb-2">Buscar Producto</label>
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Escribe para buscar..."
                                autoComplete="off"
                                className="w-full pl-12 pr-4 py-3 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-base"
                            />
                        </div>
                        
                        {/* Resultados de búsqueda */}
                        {searchTerm && (
                            <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <button
                                            key={product.id}
                                            onClick={() => handleAddProduct(product)}
                                            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0"
                                            disabled={selectedProducts.find(p => p.id === product.id)}
                                        >
                                            <div className="font-medium text-gray-800">{product.name}</div>
                                            <div className="text-sm text-gray-500">Stock actual: {product.stock}</div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-gray-500 text-center">No se encontraron productos</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Productos seleccionados */}
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                            Productos Agregados ({selectedProducts.length})
                        </h3>
                        
                        {selectedProducts.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-lg font-medium text-gray-500">No hay productos agregados</p>
                                <p className="text-sm text-gray-400">Usa el buscador para agregar productos</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                                {selectedProducts.map(product => (
                                    <div key={product.id} className="bg-white rounded-lg border-2 border-gray-200 p-3 relative hover:border-blue-300 transition-colors">
                                        <button
                                            onClick={() => handleRemoveProduct(product.id)}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        
                                        <div className="mb-2">
                                            <h4 className="font-bold text-gray-800 text-sm leading-tight break-words line-clamp-2" title={product.name}>
                                                {product.name}
                                            </h4>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs text-gray-500 uppercase font-semibold mb-1">
                                                Cantidad
                                            </label>
                                            <input
                                                type="number"
                                                value={product.quantity || ''}
                                                onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                                min="0"
                                                className="w-full px-2 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center text-lg font-bold"
                                                placeholder="0"
                                            />
                                            <span className="block text-xs text-gray-500 text-center mt-0.5">unidades</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer con Total y Botones */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 pb-2 -mx-4 px-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-gray-600">Total Unidades</p>
                                <p className="text-3xl font-bold text-orange-600">{getTotalUnits()}</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCreationPanel(false);
                                    setSelectedProducts([]);
                                    setSearchTerm('');
                                    setError('');
                                }}
                                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={selectedProducts.filter(p => p.quantity > 0).length === 0}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Production Dialog - Non-Modal (solo para pantallas >= 1200px) */}
            {showDialog && isLargeScreen && (
                <div 
                    className={`fixed z-50 ${isFullscreen ? 'inset-0' : ''}`}
                    style={!isFullscreen && !isMinimized ? {
                        left: `${dialogPosition.x}px`,
                        top: `${dialogPosition.y}px`,
                        width: `${dialogSize.width}px`,
                        height: `${dialogSize.height}px`,
                        minWidth: '400px',
                        minHeight: '300px',
                        maxWidth: 'calc(100vw - 32px)',
                        maxHeight: 'calc(100vh - 32px)',
                        resize: 'both',
                        overflow: 'auto'
                    } : isMinimized ? {
                        bottom: '16px',
                        right: '16px',
                        width: '300px',
                        height: 'auto'
                    } : {}}
                >
                    <div className={`bg-white rounded-lg shadow-2xl ${isFullscreen || !isMinimized ? 'h-full' : ''} flex flex-col`} style={{ minHeight: isMinimized ? 'auto' : '100%' }}>
                        {/* Dialog Header */}
                        <div 
                            className="flex items-center justify-between p-4 border-b border-gray-200 cursor-move select-none"
                            onMouseDown={handleMouseDown}
                        >
                            <div className="flex items-center gap-2">
                                
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{isMinimized ? 'Nueva Producción' : 'Nueva Carga de Producción'}</h3>
                                    {!isMinimized && (
                                        <p className="text-xs text-gray-600">
                                            {new Date().toLocaleDateString('es-AR')} • {selectedProducts.length} items
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {!isMinimized && (
                                    <button
                                        onClick={openInNewWindow}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Abrir en nueva ventana"
                                    >
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </button>
                                )}
                                {/* Botón Minimizar */}
                                <button
                                    onClick={() => {
                                        setIsMinimized(!isMinimized);
                                        if (!isMinimized) setIsFullscreen(false);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={isMinimized ? 'Restaurar' : 'Minimizar'}
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {isMinimized ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        )}
                                    </svg>
                                </button>
                                {!isMinimized && (
                                    <button
                                        onClick={() => setIsFullscreen(!isFullscreen)}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        title={isFullscreen ? 'Ventana' : 'Pantalla completa'}
                                    >
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {isFullscreen ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                            )}
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowDialog(false);
                                        setSelectedProducts([]);
                                        setSearchTerm('');
                                        setError('');
                                    }}
                                    className="p-2 hover:bg-red-600  rounded-lg transition-colors"
                                >
                                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Dialog Content - Solo mostrar si no está minimizado */}
                        {!isMinimized && (
                        <div className="flex-1 overflow-y-auto p-4">
                            {error && (
                                <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Search */}
                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">Producto</label>
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Escribe para buscar..."
                                        autoComplete="off"
                                        className="w-full pl-10 pr-3 py-2 border-2 border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                                    />
                                </div>
                                
                                {/* Search Results Dropdown */}
                                {searchTerm && (
                                    <div className="mt-2 max-h-40 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map(product => (
                                                <button
                                                    key={product.id}
                                                    onClick={() => handleAddProduct(product)}
                                                    className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0"
                                                    disabled={selectedProducts.find(p => p.id === product.id)}
                                                >
                                                    <div className="font-medium text-gray-800 text-sm">{product.name}</div>
                                                    <div className="text-xs text-gray-500">Stock: {product.stock}</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-gray-500 text-center text-sm">No se encontraron productos</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selected Products Grid */}
                            <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {selectedProducts.map(product => (
                                    <div key={product.id} className="bg-white rounded-lg border-2 border-gray-200 p-2.5 relative hover:border-blue-300 transition-colors">
                                        <button
                                            onClick={() => handleRemoveProduct(product.id)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        
                                        <div className="mb-2">
                                            <h4 className="font-bold text-gray-800 text-xs leading-tight break-words line-clamp-2" title={product.name}>
                                                {product.name}
                                            </h4>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-[10px] text-gray-500 uppercase font-semibold mb-1">
                                                Cantidad
                                            </label>
                                            <input
                                                type="number"
                                                value={product.quantity || ''}
                                                onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                                                min="0"
                                                className="w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-center text-base font-bold"
                                                placeholder="0"
                                            />
                                            <span className="block text-[10px] text-gray-500 text-center mt-0.5">un.</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedProducts.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="text-base font-medium">No hay productos agregados</p>
                                    <p className="text-xs">Busca y selecciona productos arriba</p>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Dialog Footer */}
                        {!isMinimized && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-600">Total Unidades</p>
                                    <p className="text-2xl font-bold text-gray-800">{getTotalUnits()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowDialog(false);
                                            setSelectedProducts([]);
                                            setSearchTerm('');
                                            setError('');
                                        }}
                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition-colors text-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={selectedProducts.filter(p => p.quantity > 0).length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                        )}
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedProduction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-800">Detalles de Producción</h3>
                            <button
                                onClick={closeDetailsModal}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="mb-6">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase mb-1">Fecha</p>
                                        <p className="text-lg font-semibold text-gray-800">
                                            {new Date(selectedProduction.created_at).toLocaleString('es-AR', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }).replace(/(\d{2})\/(\d{2})\/(\d{4}),/, '$3/$2/$1').replace(',', '')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase mb-1">Responsable</p>
                                        <p className="text-lg font-semibold text-gray-800">
                                            {selectedProduction.user || 'Usuario'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase mb-1">Total Unidades</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        {selectedProduction.total_units} un.
                                    </p>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 uppercase mb-3">Productos</h4>
                                <div className="space-y-2">
                                    {selectedProduction.items?.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <span className="font-medium text-gray-800">{item.product_name}</span>
                                            <span className="text-lg font-bold text-blue-600">{item.quantity} un.</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación - Fuera del contenedor con overflow */}
        {showConfirmModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Confirmar Carga</h3>
                                <p className="text-sm text-gray-600">Esta acción actualizará el inventario</p>
                            </div>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-gray-700 mb-4">
                                ¿Estás seguro que deseas cargar esta producción?
                            </p>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">Productos:</span>
                                    <span className="font-semibold text-gray-800">{selectedProducts.filter(p => p.quantity > 0).length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Total Unidades:</span>
                                    <span className="text-lg font-bold text-orange-600">{getTotalUnits()} un.</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSubmit}
                                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md"
                            >
                                Confirmar Carga
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </div>
        </>
    );
};

export default ProductionCreation;
