import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../services/api';

const LossManagement = ({ products, userRole, loadProducts }) => {
    const [activeSubTab, setActiveSubTab] = useState('register'); // 'register', 'history'
    const [lossRecords, setLossRecords] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [showConfirmLoss, setShowConfirmLoss] = useState(false); // Confirmación para registrar pérdida

    // Estados para registrar pérdida
    const [newLoss, setNewLoss] = useState({
        product: null,
        quantity: '',
        category: '',
        description: ''
    });

    // Estados para filtros del historial de pérdidas
    const [lossIdFilter, setLossIdFilter] = useState('');
    const [lossIdFilterOp, setLossIdFilterOp] = useState('equals');
    const [lossProductFilter, setLossProductFilter] = useState('');
    const [lossUserFilter, setLossUserFilter] = useState('');
    const [lossQuantityFilter, setLossQuantityFilter] = useState('');
    const [lossQuantityOp, setLossQuantityOp] = useState('equals');
    const [lossCostFilter, setLossCostFilter] = useState('');
    const [lossCostOp, setLossCostOp] = useState('equals');
    const [lossDescriptionFilter, setLossDescriptionFilter] = useState('');
    const [lossDescriptionFilterOp, setLossDescriptionFilterOp] = useState('contains');
    const [lossCategoryFilter, setLossCategoryFilter] = useState('');
    const [lossCategoryFilterOp, setLossCategoryFilterOp] = useState('contains');
    // Filtros de fecha granular
    const [lossDateFromYear, setLossDateFromYear] = useState('');
    const [lossDateFromMonth, setLossDateFromMonth] = useState('');
    const [lossDateFromDay, setLossDateFromDay] = useState('');
    const [lossDateFromHour, setLossDateFromHour] = useState('');
    const [lossDateFromMinute, setLossDateFromMinute] = useState('');
    const [lossDateToYear, setLossDateToYear] = useState('');
    const [lossDateToMonth, setLossDateToMonth] = useState('');
    const [lossDateToDay, setLossDateToDay] = useState('');
    const [lossDateToHour, setLossDateToHour] = useState('');
    const [lossDateToMinute, setLossDateToMinute] = useState('');

    // Cargar registros de pérdidas
    const loadLossRecords = async () => {
        try {
            const response = await api.get('/loss-records/');
            setLossRecords(response.data);
        } catch (err) {
            console.error('Error cargando registros de pérdidas:', err);
        }
    };

    useEffect(() => {
        if (userRole === 'Gerente' || userRole === 'Encargado') {
            loadLossRecords();
        }
    }, [userRole]);

    // Función para convertir y mostrar el stock en las unidades correctas
    const getDisplayStock = (product) => {
        const stock = parseFloat(product.stock) || 0;
        switch (product.unit) {
            case 'g':
                return `${(stock / 1000).toFixed(3)} kg`; // Convertir gramos a kilos
            case 'ml':
                return `${(stock / 1000).toFixed(3)} l`; // Convertir mililitros a litros
            case 'unidades':
                return `${stock} unidades`;
            default:
                return `${stock} ${product.unit}`;
        }
    };

    // Opciones para el selector de productos
    const productOptions = products.map(p => ({ 
        value: p.id, 
        label: `${p.name} (Stock: ${getDisplayStock(p)}) - ${p.category}`,
        category: p.category
    }));

    // Categorías de pérdida según el tipo de producto
    const getLossCategories = (productCategory) => {
        if (productCategory === 'Insumo') {
            return [
                { value: 'empaque_danado', label: 'Empaque dañado' },
                { value: 'sobreuso_receta', label: 'Sobreuso en receta' },
                { value: 'vencimiento', label: 'Vencimiento' },
                { value: 'cadena_frio', label: 'Perdió la cadena de frío - Temperatura inadecuada' }
            ];
        } else {
            return [
                { value: 'accidente_fisico', label: 'Accidentes físicos' },
                { value: 'contaminacion', label: 'Contaminación' },
                { value: 'vencimiento', label: 'Vencimiento' },
                { value: 'cadena_frio', label: 'Perdió la cadena de frío - Temperatura inadecuada' }
            ];
        }
    };

    // Manejar registro de nueva pérdida (abre modal de confirmación)
    const handleRegisterLoss = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (!newLoss.product || !newLoss.quantity || !newLoss.category) {
            setError('Por favor, completa todos los campos obligatorios.');
            return;
        }

        const quantity = parseFloat(newLoss.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            setError('La cantidad debe ser un número positivo.');
            return;
        }

        // Mostrar modal de confirmación (más visible) y no enviar todavía
        setShowConfirmLoss(true);
    };

    // Ejecuta el registro de pérdida después de confirmar
    const confirmRegisterLoss = async () => {
        setShowConfirmLoss(false);
        setMessage('');
        setError('');
        try {
            const quantity = parseFloat(newLoss.quantity);
            const payload = {
                product: newLoss.product.value,
                quantity: quantity,
                category: newLoss.category,
                description: newLoss.description.trim()
            };

            await api.post('/loss-records/', payload);
            setMessage('✅ Pérdida registrada exitosamente.');

            // Limpiar formulario
            setNewLoss({
                product: null,
                quantity: '',
                category: '',
                description: ''
            });

            // Recargar datos
            await loadLossRecords();
            await loadProducts();
        } catch (err) {
            const errorMessage = err.response?.data?.detail || 
                               err.response?.data?.message || 
                               'Error al registrar la pérdida.';
            setError(errorMessage);
            console.error('Error registrando pérdida:', err);
        }
    };

    // Función para cancelar la confirmación de pérdida
    const handleCancelLoss = () => {
        setShowConfirmLoss(false);
        setMessage('');
        setError('');
    };

    // Manejar selección de producto
    const handleProductChange = (selectedProduct) => {
        setNewLoss(prev => ({
            ...prev,
            product: selectedProduct,
            category: '' // Limpiar categoría cuando cambia el producto
        }));
    };

    // Función para parsear fechas en múltiples formatos
    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    // Función para aplicar filtros al historial de pérdidas
    const getFilteredLossRecords = () => {
        let filtered = [...lossRecords];

        // Filtro por ID
        if (lossIdFilter.trim()) {
            const filterValue = parseInt(lossIdFilter);
            if (!isNaN(filterValue)) {
                filtered = filtered.filter(record => {
                    const recordId = parseInt(record.id);
                    switch (lossIdFilterOp) {
                        case 'equals': return recordId === filterValue;
                        case 'lt': return recordId < filterValue;
                        case 'lte': return recordId <= filterValue;
                        case 'gt': return recordId > filterValue;
                        case 'gte': return recordId >= filterValue;
                        default: return recordId === filterValue;
                    }
                });
            }
        }

        // Filtro por Producto/Insumo
        if (lossProductFilter.trim()) {
            filtered = filtered.filter(record =>
                String(record.product_name || '').toLowerCase().includes(lossProductFilter.toLowerCase())
            );
        }

        // Filtro por Usuario (Registrado por)
        if (lossUserFilter.trim()) {
            filtered = filtered.filter(record =>
                String(record.user_name || '').toLowerCase().includes(lossUserFilter.toLowerCase())
            );
        }

        // Filtro por Cantidad
        if (lossQuantityFilter.trim()) {
            const filterValue = parseFloat(lossQuantityFilter);
            if (!isNaN(filterValue)) {
                filtered = filtered.filter(record => {
                    const quantity = parseFloat(record.quantity) || 0;
                    switch (lossQuantityOp) {
                        case 'equals': return quantity === filterValue;
                        case 'lt': return quantity < filterValue;
                        case 'lte': return quantity <= filterValue;
                        case 'gt': return quantity > filterValue;
                        case 'gte': return quantity >= filterValue;
                        default: return quantity === filterValue;
                    }
                });
            }
        }

        // Filtro por Costo Estimado
        if (lossCostFilter.trim()) {
            const filterValue = parseFloat(lossCostFilter);
            if (!isNaN(filterValue)) {
                filtered = filtered.filter(record => {
                    const cost = parseFloat(record.cost_estimate) || 0;
                    switch (lossCostOp) {
                        case 'equals': return cost === filterValue;
                        case 'lt': return cost < filterValue;
                        case 'lte': return cost <= filterValue;
                        case 'gt': return cost > filterValue;
                        case 'gte': return cost >= filterValue;
                        default: return cost === filterValue;
                    }
                });
            }
        }

        // Filtro por Descripción
        if (lossDescriptionFilter.trim()) {
            filtered = filtered.filter(record => {
                const description = String(record.description || '').toLowerCase();
                const filterValue = lossDescriptionFilter.toLowerCase();
                
                switch (lossDescriptionFilterOp) {
                    case 'equals': return description === filterValue;
                    case 'contains': return description.includes(filterValue);
                    default: return description.includes(filterValue);
                }
            });
        }

        // Filtro por Motivo (Categoría)
        if (lossCategoryFilter.trim()) {
            filtered = filtered.filter(record => {
                const category = String(record.category_display || '').toLowerCase();
                const filterValue = lossCategoryFilter.toLowerCase();
                
                switch (lossCategoryFilterOp) {
                    case 'equals': return category === filterValue;
                    case 'contains': return category.includes(filterValue);
                    default: return category.includes(filterValue);
                }
            });
        }

        // Filtro por Fecha y Hora (granular)
        const hasGranularFilters = lossDateFromYear || lossDateFromMonth || lossDateFromDay || 
                                   lossDateFromHour || lossDateFromMinute || lossDateToYear || 
                                   lossDateToMonth || lossDateToDay || lossDateToHour || lossDateToMinute;

        if (hasGranularFilters) {
            filtered = filtered.filter(record => {
                const recordDate = parseAnyDate(record.timestamp);
                if (!recordDate) return false;

                const hasToFilters = lossDateToYear || lossDateToMonth || lossDateToDay || 
                                    lossDateToHour || lossDateToMinute;
                let matches = true;

                // Filtros "desde"
                if (lossDateFromYear && matches) {
                    if (hasToFilters) {
                        matches = recordDate.getFullYear() >= parseInt(lossDateFromYear);
                    } else {
                        matches = recordDate.getFullYear() === parseInt(lossDateFromYear);
                    }
                }

                if (lossDateFromMonth && matches) {
                    if (hasToFilters) {
                        if (lossDateFromYear) {
                            const yearMatches = recordDate.getFullYear() > parseInt(lossDateFromYear);
                            const yearExact = recordDate.getFullYear() === parseInt(lossDateFromYear);
                            matches = yearMatches || (yearExact && recordDate.getMonth() >= (parseInt(lossDateFromMonth) - 1));
                        } else {
                            matches = recordDate.getMonth() >= (parseInt(lossDateFromMonth) - 1);
                        }
                    } else {
                        const yearMatches = !lossDateFromYear || recordDate.getFullYear() === parseInt(lossDateFromYear);
                        matches = yearMatches && recordDate.getMonth() === (parseInt(lossDateFromMonth) - 1);
                    }
                }

                if (lossDateFromDay && matches) {
                    if (hasToFilters) {
                        const yearMatch = !lossDateFromYear || recordDate.getFullYear() >= parseInt(lossDateFromYear);
                        const monthMatch = !lossDateFromMonth || recordDate.getMonth() >= (parseInt(lossDateFromMonth) - 1);
                        if (lossDateFromYear && lossDateFromMonth) {
                            const exactYearMonth = recordDate.getFullYear() === parseInt(lossDateFromYear) && 
                                                   recordDate.getMonth() === (parseInt(lossDateFromMonth) - 1);
                            matches = (!exactYearMonth) || (exactYearMonth && recordDate.getDate() >= parseInt(lossDateFromDay));
                        } else {
                            matches = yearMatch && monthMatch && recordDate.getDate() >= parseInt(lossDateFromDay);
                        }
                    } else {
                        const yearMatches = !lossDateFromYear || recordDate.getFullYear() === parseInt(lossDateFromYear);
                        const monthMatches = !lossDateFromMonth || recordDate.getMonth() === (parseInt(lossDateFromMonth) - 1);
                        matches = yearMatches && monthMatches && recordDate.getDate() === parseInt(lossDateFromDay);
                    }
                }

                if (lossDateFromHour && matches) {
                    const yearMatches = !lossDateFromYear || recordDate.getFullYear() === parseInt(lossDateFromYear);
                    const monthMatches = !lossDateFromMonth || recordDate.getMonth() === (parseInt(lossDateFromMonth) - 1);
                    const dayMatches = !lossDateFromDay || recordDate.getDate() === parseInt(lossDateFromDay);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches) {
                            matches = recordDate.getHours() >= parseInt(lossDateFromHour);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && recordDate.getHours() === parseInt(lossDateFromHour);
                    }
                }

                if (lossDateFromMinute && matches) {
                    const yearMatches = !lossDateFromYear || recordDate.getFullYear() === parseInt(lossDateFromYear);
                    const monthMatches = !lossDateFromMonth || recordDate.getMonth() === (parseInt(lossDateFromMonth) - 1);
                    const dayMatches = !lossDateFromDay || recordDate.getDate() === parseInt(lossDateFromDay);
                    const hourMatches = !lossDateFromHour || recordDate.getHours() === parseInt(lossDateFromHour);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches && hourMatches) {
                            matches = recordDate.getMinutes() >= parseInt(lossDateFromMinute);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && hourMatches && 
                                 recordDate.getMinutes() === parseInt(lossDateFromMinute);
                    }
                }

                // Filtros "hasta"
                if (hasToFilters) {
                    if (lossDateToYear && matches) {
                        matches = recordDate.getFullYear() <= parseInt(lossDateToYear);
                    }
                    if (lossDateToMonth && matches) {
                        if (lossDateToYear) {
                            const yearMatches = recordDate.getFullYear() < parseInt(lossDateToYear);
                            const yearExact = recordDate.getFullYear() === parseInt(lossDateToYear);
                            matches = yearMatches || (yearExact && recordDate.getMonth() <= (parseInt(lossDateToMonth) - 1));
                        } else {
                            matches = recordDate.getMonth() <= (parseInt(lossDateToMonth) - 1);
                        }
                    }
                    if (lossDateToDay && matches) {
                        const exactYearMonth = (!lossDateToYear || recordDate.getFullYear() === parseInt(lossDateToYear)) && 
                                               (!lossDateToMonth || recordDate.getMonth() === (parseInt(lossDateToMonth) - 1));
                        if (exactYearMonth) {
                            matches = recordDate.getDate() <= parseInt(lossDateToDay);
                        }
                    }
                    if (lossDateToHour && matches) {
                        const exactDate = (!lossDateToYear || recordDate.getFullYear() === parseInt(lossDateToYear)) &&
                                          (!lossDateToMonth || recordDate.getMonth() === (parseInt(lossDateToMonth) - 1)) &&
                                          (!lossDateToDay || recordDate.getDate() === parseInt(lossDateToDay));
                        if (exactDate) {
                            matches = recordDate.getHours() <= parseInt(lossDateToHour);
                        }
                    }
                    if (lossDateToMinute && matches) {
                        const exactDateTime = (!lossDateToYear || recordDate.getFullYear() === parseInt(lossDateToYear)) &&
                                              (!lossDateToMonth || recordDate.getMonth() === (parseInt(lossDateToMonth) - 1)) &&
                                              (!lossDateToDay || recordDate.getDate() === parseInt(lossDateToDay)) &&
                                              (!lossDateToHour || recordDate.getHours() === parseInt(lossDateToHour));
                        if (exactDateTime) {
                            matches = recordDate.getMinutes() <= parseInt(lossDateToMinute);
                        }
                    }
                }

                return matches;
            });
        }

        return filtered;
    };

    // Verificar permisos
    if (userRole !== 'Gerente' && userRole !== 'Encargado') {
        return (
            <div className="unauthorized-message">
                <h2>Acceso Denegado</h2>
                <p>Esta función solo está disponible para Gerentes y Encargados.</p>
            </div>
        );
    }

    return (
        <div className="loss-management-container">
            <h3>Gestión de Pérdidas y Mermas</h3>
            
            {/* Sub-pestañas */}
            <div className="sub-tab-navigation flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
                <button
                    className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 flex-1 sm:flex-none ${
                        activeSubTab === 'register' 
                            ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => setActiveSubTab('register')}
                >
                    📝 Registrar Pérdida
                </button>
                <button
                    className={`px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 flex-1 sm:flex-none ${
                        activeSubTab === 'history' 
                            ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => setActiveSubTab('history')}
                >
                    📊 Historial de Pérdidas
                </button>
            </div>

            {/* Mensajes */}
            {message && <div className="message success-message">{message}</div>}
            {error && <div className="message error-message">{error}</div>}

            {/* Modal de confirmación para registrar pérdida */}
            {showConfirmLoss && (
                <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000}}>
                    <div style={{background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '480px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'}}>
                        <h3 style={{marginTop: 0}}>Confirmar registro de pérdida</h3>
                        <p>¿Estás seguro que deseas registrar esta pérdida? Se actualizará el stock del producto seleccionado.</p>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4">
                            <button 
                                onClick={handleCancelLoss} 
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors duration-200"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmRegisterLoss} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors duration-200"
                            >
                                ✓ Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenido de sub-pestañas */}
            <div className="sub-tab-content">
                {/* Registrar Pérdida */}
                {activeSubTab === 'register' && (
                    <div className="register-loss-container form-container">
                        <h4>Registrar Nueva Pérdida</h4>
                        <form onSubmit={handleRegisterLoss}>
                            <div className="form-group">
                                <label htmlFor="product-select">Producto/Insumo Afectado *</label>
                                <Select
                                    id="product-select"
                                    options={productOptions}
                                    value={newLoss.product}
                                    onChange={handleProductChange}
                                    placeholder="Selecciona un producto o insumo..."
                                    isClearable
                                    className="searchable-select"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="quantity">
                                    {newLoss.product && 
                                        products.find(p => p.id === newLoss.product.value)?.unit === 'g' 
                                        ? 'Cantidad Perdida (en kg) *' 
                                        : newLoss.product && products.find(p => p.id === newLoss.product.value)?.unit === 'ml'
                                        ? 'Cantidad Perdida (en litros) *'
                                        : 'Cantidad Perdida *'
                                    }
                                </label>
                                <input
                                    id="quantity"
                                    type="number"
                                    step="0.01"
                                    value={newLoss.quantity}
                                    onChange={(e) => setNewLoss({...newLoss, quantity: e.target.value})}
                                    placeholder={
                                        newLoss.product && products.find(p => p.id === newLoss.product.value)?.unit === 'g' 
                                        ? "Ej: 2.50 (kg)" 
                                        : newLoss.product && products.find(p => p.id === newLoss.product.value)?.unit === 'ml'
                                        ? "Ej: 1.20 (litros)"
                                        : "Ingrese la cantidad"
                                    }
                                    min="0.01"
                                    required
                                />
                                {newLoss.product && (
                                    <small style={{ color: '#666', fontSize: '0.85em' }}>
                                        {products.find(p => p.id === newLoss.product.value)?.unit === 'g' && (
                                            <>ℹ️ Ingrese la cantidad perdida en kilos. Se descontará automáticamente del stock en gramos.</>
                                        )}
                                        {products.find(p => p.id === newLoss.product.value)?.unit === 'ml' && (
                                            <>ℹ️ Ingrese la cantidad perdida en litros. Se descontará automáticamente del stock en mililitros.</>
                                        )}
                                        {products.find(p => p.id === newLoss.product.value)?.unit === 'unidades' && (
                                            <>ℹ️ Ingrese la cantidad de unidades perdidas.</>
                                        )}
                                    </small>
                                )}
                            </div>

                            <div className="form-group">
                                <label htmlFor="category">Motivo de la Pérdida *</label>
                                <select
                                    id="category"
                                    value={newLoss.category}
                                    onChange={(e) => setNewLoss(prev => ({...prev, category: e.target.value}))}
                                    required
                                    disabled={!newLoss.product || !newLoss.product.category}
                                >
                                    <option value="">Selecciona un motivo...</option>
                                    {newLoss.product && newLoss.product.category && 
                                        getLossCategories(newLoss.product.category).map(cat => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Descripción Adicional</label>
                                <textarea
                                    id="description"
                                    value={newLoss.description}
                                    onChange={(e) => setNewLoss({...newLoss, description: e.target.value})}
                                    placeholder="Detalles adicionales sobre la pérdida..."
                                    rows={3}
                                />
                            </div>

                            <div className="button-group mt-6">
                                <button 
                                    type="submit" 
                                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-lg shadow-md hover:from-red-700 hover:to-red-800 hover:shadow-lg transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                >
                                    🔴 Registrar Pérdida
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Historial de Pérdidas */}
                {activeSubTab === 'history' && (
                    <div className="loss-history-container">
                        <h4>Historial de Pérdidas</h4>
                        
                        {/* Filtros de Búsqueda */}
                        <h5>Filtros de Búsqueda</h5>
                        <div className="filters-container" style={{ marginBottom: '1.5em', padding: '1em', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                            {/* Filtro de ID */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>ID:</label>
                                <select 
                                    value={lossIdFilterOp} 
                                    onChange={e => setLossIdFilterOp(e.target.value)}
                                    style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="equals">Es igual</option>
                                    <option value="lt">Es menor que</option>
                                    <option value="lte">Es menor o igual que</option>
                                    <option value="gt">Es mayor que</option>
                                    <option value="gte">Es mayor o igual que</option>
                                </select>
                                <input 
                                    type="number" 
                                    value={lossIdFilter} 
                                    onChange={e => setLossIdFilter(e.target.value)}
                                    placeholder="Ingrese ID..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Producto/Insumo */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>Producto/Insumo:</label>
                                <input 
                                    type="text" 
                                    value={lossProductFilter} 
                                    onChange={e => setLossProductFilter(e.target.value)}
                                    placeholder="Nombre del producto/insumo..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Registrado por */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>Registrado por:</label>
                                <input 
                                    type="text" 
                                    value={lossUserFilter} 
                                    onChange={e => setLossUserFilter(e.target.value)}
                                    placeholder="Nombre del usuario..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Cantidad */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>Cantidad:</label>
                                <select 
                                    value={lossQuantityOp} 
                                    onChange={e => setLossQuantityOp(e.target.value)}
                                    style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="equals">Es igual</option>
                                    <option value="lt">Es menor que</option>
                                    <option value="lte">Es menor o igual que</option>
                                    <option value="gt">Es mayor que</option>
                                    <option value="gte">Es mayor o igual que</option>
                                </select>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={lossQuantityFilter} 
                                    onChange={e => setLossQuantityFilter(e.target.value)}
                                    placeholder="Ingrese cantidad..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Motivo */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>Motivo:</label>
                                <select 
                                    value={lossCategoryFilterOp} 
                                    onChange={e => setLossCategoryFilterOp(e.target.value)}
                                    style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="contains">Contiene</option>
                                    <option value="equals">Es igual</option>
                                </select>
                                <input 
                                    type="text" 
                                    value={lossCategoryFilter} 
                                    onChange={e => setLossCategoryFilter(e.target.value)}
                                    placeholder="Texto del motivo..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Costo Estimado */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>Costo Estimado:</label>
                                <select 
                                    value={lossCostOp} 
                                    onChange={e => setLossCostOp(e.target.value)}
                                    style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="equals">Es igual</option>
                                    <option value="lt">Es menor que</option>
                                    <option value="lte">Es menor o igual que</option>
                                    <option value="gt">Es mayor que</option>
                                    <option value="gte">Es mayor o igual que</option>
                                </select>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={lossCostFilter} 
                                    onChange={e => setLossCostFilter(e.target.value)}
                                    placeholder="Ingrese monto..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Descripción */}
                            <div className="filter-row" style={{ display: 'flex', gap: '1em', marginBottom: '0.8em', alignItems: 'center' }}>
                                <label style={{ minWidth: '100px', fontWeight: 'bold' }}>Descripción:</label>
                                <select 
                                    value={lossDescriptionFilterOp} 
                                    onChange={e => setLossDescriptionFilterOp(e.target.value)}
                                    style={{ padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                >
                                    <option value="contains">Contiene</option>
                                    <option value="equals">Es igual</option>
                                </select>
                                <input 
                                    type="text" 
                                    value={lossDescriptionFilter} 
                                    onChange={e => setLossDescriptionFilter(e.target.value)}
                                    placeholder="Texto de la descripción..."
                                    style={{ flex: 1, padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                />
                            </div>

                            {/* Filtro de Fecha Granular - Desde */}
                            <div className="filter-row" style={{ marginBottom: '0.8em' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5em' }}> Fecha y Hora - Desde:</label>
                                <div style={{ display: 'flex', gap: '0.5em', flexWrap: 'wrap' }}>
                                    <input 
                                        type="number" 
                                        value={lossDateFromYear} 
                                        onChange={e => setLossDateFromYear(e.target.value)}
                                        placeholder="Año"
                                        min="2000"
                                        max="2100"
                                        style={{ width: '80px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateFromMonth} 
                                        onChange={e => setLossDateFromMonth(e.target.value)}
                                        placeholder="Mes"
                                        min="1"
                                        max="12"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateFromDay} 
                                        onChange={e => setLossDateFromDay(e.target.value)}
                                        placeholder="Día"
                                        min="1"
                                        max="31"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateFromHour} 
                                        onChange={e => setLossDateFromHour(e.target.value)}
                                        placeholder="Hora"
                                        min="0"
                                        max="23"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateFromMinute} 
                                        onChange={e => setLossDateFromMinute(e.target.value)}
                                        placeholder="Min"
                                        min="0"
                                        max="59"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                </div>
                            </div>

                            {/* Filtro de Fecha Granular - Hasta */}
                            <div className="filter-row" style={{ marginBottom: '0.8em' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5em' }}> (Opcional) Fecha y Hora - Hasta:</label>
                                <div style={{ display: 'flex', gap: '0.5em', flexWrap: 'wrap' }}>
                                    <input 
                                        type="number" 
                                        value={lossDateToYear} 
                                        onChange={e => setLossDateToYear(e.target.value)}
                                        placeholder="Año"
                                        min="2000"
                                        max="2100"
                                        style={{ width: '80px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateToMonth} 
                                        onChange={e => setLossDateToMonth(e.target.value)}
                                        placeholder="Mes"
                                        min="1"
                                        max="12"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateToDay} 
                                        onChange={e => setLossDateToDay(e.target.value)}
                                        placeholder="Día"
                                        min="1"
                                        max="31"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateToHour} 
                                        onChange={e => setLossDateToHour(e.target.value)}
                                        placeholder="Hora"
                                        min="0"
                                        max="23"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <input 
                                        type="number" 
                                        value={lossDateToMinute} 
                                        onChange={e => setLossDateToMinute(e.target.value)}
                                        placeholder="Min"
                                        min="0"
                                        max="59"
                                        style={{ width: '70px', padding: '0.5em', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                </div>
                            </div>

                            {/* Botón para limpiar filtros */}
                        {
                        //    <button 
                        //        onClick={() => {
                        //            setLossIdFilter('');
                        //            setLossProductFilter('');
                        //            setLossUserFilter('');
                        //            setLossQuantityFilter('');
                        //            setLossCostFilter('');
                        //            setLossDescriptionFilter('');
                        //            setLossCategoryFilter('');
                        //            setLossDateFromYear('');
                        //            setLossDateFromMonth('');
                        //            setLossDateFromDay('');
                        //            setLossDateFromHour('');
                        //            setLossDateFromMinute('');
                        //            setLossDateToYear('');
                        //            setLossDateToMonth('');
                        //            setLossDateToDay('');
                        //            setLossDateToHour('');
                        //            setLossDateToMinute('');
                        //        }}
                        //        className="action-button secondary"
                        //        style={{ marginTop: '0.5em' }}
                        //    >
                        //        Limpiar Filtros
                        //    </button>
                            }
                        </div>

                        {getFilteredLossRecords().length === 0 ? (
                            <p>No hay registros de pérdidas que coincidan con los filtros aplicados.</p>
                        ) : (
                            <div className="loss-records-table-container">
                                <table className="loss-records-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Producto/Insumo</th>
                                            <th>Fecha y Hora</th>
                                            <th>Cantidad</th>
                                            <th>Motivo</th>
                                            <th>Costo Estimado</th>
                                            <th>Descripción</th>
                                            <th>Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getFilteredLossRecords().map(record => (
                                            <tr key={record.id} className="loss-record-row">
                                                <td className="id">
                                                    {record.id}
                                                </td>
                                                <td className="product-name">
                                                    {record.product_name}
                                                </td>
                                                <td className="timestamp">
                                                    <div>
                                                        {new Date(record.timestamp).toLocaleDateString('es-ES')}
                                                    </div>
                                                    <div className="time">
                                                        {new Date(record.timestamp).toLocaleTimeString('es-ES', { 
                                                            hour: '2-digit', minute: '2-digit' 
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="quantity">
                                                    {record.quantity}
                                                </td>
                                                <td className="category">
                                                    {record.category_display}
                                                </td>
                                                <td className="cost">
                                                    ${(parseFloat(record.cost_estimate) || 0).toFixed(2)}
                                                </td>
                                                <td className="description">
                                                    {record.description || 'N/A'}
                                                </td>
                                                <td className="user">
                                                    {record.user_name}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LossManagement;