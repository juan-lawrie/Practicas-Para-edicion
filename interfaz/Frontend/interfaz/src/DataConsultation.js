import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { formatMovementDate } from './utils/date';

// DataConsultation: componente extracto para evitar remounts por cambios en App
// Recibe como props los estados y funciones que necesita para no depender de clausuras
export default function DataConsultation(props) {
    const {
        getInMemoryToken,
        api,
        loadSales,
        loadCashMovements,
        inventory = [],
        suppliers = [],
        purchases = [],
        orders = [],
        cashMovements = [],
        sales = [],
        headerTranslationMap = {},
        safeToFixed = (v) => (Number(v)||0).toFixed(2)
    } = props;

    // mount/unmount side-effects intentionally silent in production UI
    useEffect(() => { return () => {}; }, []);

    const [selectedQuery, setSelectedQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    // Filtros para la consulta de stock (filtros independientes)
    const [stockIdFilter, setStockIdFilter] = useState('');
    const [stockIdFilterOp, setStockIdFilterOp] = useState('equals');
    const [stockNameFilter, setStockNameFilter] = useState('');
    const [stockQuantityFilter, setStockQuantityFilter] = useState('');
    const [stockQuantityOp, setStockQuantityOp] = useState('equals');
    const [stockQuantityUnit, setStockQuantityUnit] = useState('Kg');
    const [stockPriceFilter, setStockPriceFilter] = useState('');
    const [stockPriceOp, setStockPriceOp] = useState('equals');
    const [stockTypeFilter, setStockTypeFilter] = useState(''); // 'Producto' | 'Insumo'
    const [stockStatusFilter, setStockStatusFilter] = useState([]); // array de statuses seleccionados
    
    // Filtros para la consulta de ventas (filtros independientes)
    const [salesIdFilter, setSalesIdFilter] = useState('');
    const [salesIdFilterOp, setSalesIdFilterOp] = useState('equals');
    const [salesProductFilter, setSalesProductFilter] = useState('');
    const [salesUserFilter, setSalesUserFilter] = useState('');
    const [salesTotalFilter, setSalesTotalFilter] = useState('');
    const [salesTotalOp, setSalesTotalOp] = useState('equals');
    const [salesQuantityFilter, setSalesQuantityFilter] = useState('');
    const [salesQuantityOp, setSalesQuantityOp] = useState('equals');
    const [salesDateFromYear, setSalesDateFromYear] = useState('');
    const [salesDateFromMonth, setSalesDateFromMonth] = useState('');
    const [salesDateFromDay, setSalesDateFromDay] = useState('');
    const [salesDateFromHour, setSalesDateFromHour] = useState('');
    const [salesDateFromMinute, setSalesDateFromMinute] = useState('');
    const [salesDateToYear, setSalesDateToYear] = useState('');
    const [salesDateToMonth, setSalesDateToMonth] = useState('');
    const [salesDateToDay, setSalesDateToDay] = useState('');
    const [salesDateToHour, setSalesDateToHour] = useState('');
    const [salesDateToMinute, setSalesDateToMinute] = useState('');
    
    // Filtros independientes para movimientos de caja
    const [cashIdFilter, setCashIdFilter] = useState('');
    const [cashIdFilterOp, setCashIdFilterOp] = useState('equals');
    const [cashAmountFilter, setCashAmountFilter] = useState('');
    const [cashAmountFilterOp, setCashAmountFilterOp] = useState('equals');
    const [cashDescriptionFilter, setCashDescriptionFilter] = useState('');
    const [cashDescriptionFilterOp, setCashDescriptionFilterOp] = useState('contains');
    const [cashUserFilter, setCashUserFilter] = useState('');
    const [cashUserFilterOp, setCashUserFilterOp] = useState('contains');
    // Filtros de fecha granular
    const [cashDateFromYear, setCashDateFromYear] = useState('');
    const [cashDateFromMonth, setCashDateFromMonth] = useState('');
    const [cashDateFromDay, setCashDateFromDay] = useState('');
    const [cashDateFromHour, setCashDateFromHour] = useState('');
    const [cashDateFromMinute, setCashDateFromMinute] = useState('');
    const [cashDateToYear, setCashDateToYear] = useState('');
    const [cashDateToMonth, setCashDateToMonth] = useState('');
    const [cashDateToDay, setCashDateToDay] = useState('');
    const [cashDateToHour, setCashDateToHour] = useState('');
    const [cashDateToMinute, setCashDateToMinute] = useState('');
    const [cashTypeFilter, setCashTypeFilter] = useState(''); // Entrada/Salida
    const [cashPaymentMethodFilter, setCashPaymentMethodFilter] = useState([]); // Array de métodos seleccionados
    const [cashSortOrder, setCashSortOrder] = useState('desc'); // 'desc' = descendente (más nuevos primero), 'asc' = ascendente
    
    // Filtros independientes para pedidos
    const [ordersIdFilter, setOrdersIdFilter] = useState('');
    const [ordersIdFilterOp, setOrdersIdFilterOp] = useState('equals');
    const [ordersCustomerFilter, setOrdersCustomerFilter] = useState('');
    const [ordersCustomerFilterOp, setOrdersCustomerFilterOp] = useState('contains');
    // Filtros de fecha granular
    const [ordersDateFromYear, setOrdersDateFromYear] = useState('');
    const [ordersDateFromMonth, setOrdersDateFromMonth] = useState('');
    const [ordersDateFromDay, setOrdersDateFromDay] = useState('');
    const [ordersDateFromHour, setOrdersDateFromHour] = useState('');
    const [ordersDateFromMinute, setOrdersDateFromMinute] = useState('');
    const [ordersDateToYear, setOrdersDateToYear] = useState('');
    const [ordersDateToMonth, setOrdersDateToMonth] = useState('');
    const [ordersDateToDay, setOrdersDateToDay] = useState('');
    const [ordersDateToHour, setOrdersDateToHour] = useState('');
    const [ordersDateToMinute, setOrdersDateToMinute] = useState('');
    const [ordersPaymentMethodFilter, setOrdersPaymentMethodFilter] = useState([]); // Array de métodos seleccionados como en movimientos de caja
    const [ordersStatusFilter, setOrdersStatusFilter] = useState([]); // Array de estados seleccionados: En Preparación, Listo, Entregado, Cancelado
    const [ordersProductFilter, setOrdersProductFilter] = useState(''); // Búsqueda por nombre de producto
    const [ordersUnitsFilter, setOrdersUnitsFilter] = useState(''); // Filtro por unidades/cantidad
    const [ordersUnitsFilterOp, setOrdersUnitsFilterOp] = useState('equals'); // Operador para unidades
    
    // Filtros independientes para compras
    const [purchasesIdFilter, setPurchasesIdFilter] = useState('');
    const [purchasesIdFilterOp, setPurchasesIdFilterOp] = useState('equals');
    const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState('');
    const [purchasesSupplierFilterOp, setPurchasesSupplierFilterOp] = useState('contains');
    const [purchasesTotalFilter, setPurchasesTotalFilter] = useState('');
    const [purchasesTotalFilterOp, setPurchasesTotalFilterOp] = useState('equals');
    // Filtros de fecha granular
    const [purchasesDateFromYear, setPurchasesDateFromYear] = useState('');
    const [purchasesDateFromMonth, setPurchasesDateFromMonth] = useState('');
    const [purchasesDateFromDay, setPurchasesDateFromDay] = useState('');
    const [purchasesDateFromHour, setPurchasesDateFromHour] = useState('');
    const [purchasesDateFromMinute, setPurchasesDateFromMinute] = useState('');
    const [purchasesDateToYear, setPurchasesDateToYear] = useState('');
    const [purchasesDateToMonth, setPurchasesDateToMonth] = useState('');
    const [purchasesDateToDay, setPurchasesDateToDay] = useState('');
    const [purchasesDateToHour, setPurchasesDateToHour] = useState('');
    const [purchasesDateToMinute, setPurchasesDateToMinute] = useState('');
    const [purchasesTypeFilter, setPurchasesTypeFilter] = useState([]); // Array de tipos: Producto, Insumo, Mixto
    const [purchasesProductFilter, setPurchasesProductFilter] = useState(''); // Búsqueda por nombre de producto/insumo
    const [purchasesQuantityFilter, setPurchasesQuantityFilter] = useState(''); // Filtro por cantidad
    const [purchasesQuantityFilterOp, setPurchasesQuantityFilterOp] = useState('equals'); // Operador para cantidad
    const [purchasesQuantityUnit, setPurchasesQuantityUnit] = useState('Kg'); // Unidad para cantidad
    
    // Filtros independientes para proveedores
    const [suppliersIdFilter, setSuppliersIdFilter] = useState('');
    const [suppliersIdFilterOp, setSuppliersIdFilterOp] = useState('equals');
    const [suppliersNameFilter, setSuppliersNameFilter] = useState('');
    const [suppliersNameFilterOp, setSuppliersNameFilterOp] = useState('contains');
    const [suppliersCuitFilter, setSuppliersCuitFilter] = useState('');
    const [suppliersCuitFilterOp, setSuppliersCuitFilterOp] = useState('contains');
    const [suppliersPhoneFilter, setSuppliersPhoneFilter] = useState('');
    const [suppliersPhoneFilterOp, setSuppliersPhoneFilterOp] = useState('contains');
    const [suppliersAddressFilter, setSuppliersAddressFilter] = useState('');
    const [suppliersAddressFilterOp, setSuppliersAddressFilterOp] = useState('contains');
    const [suppliersProductFilter, setSuppliersProductFilter] = useState('');
    const [suppliersProductFilterOp, setSuppliersProductFilterOp] = useState('contains');
    
    const [queryResultsState, _setQueryResultsState] = useState(null);
    const queryResults = queryResultsState;
    const lastQueryResultsRef = React.useRef(null);
    const isRunningQueryRef = React.useRef(false);

    const setQueryResults = (val) => {
        _setQueryResultsState(val);
        lastQueryResultsRef.current = val;
    };

    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // No verbose logging on queryResults changes in normal operation
    useEffect(() => {}, [queryResults]);

    const loadActiveQuery = async () => {
        try {
            const token = getInMemoryToken && getInMemoryToken();
            if (!token) return;
            if (isRunningQueryRef.current) return;
            setIsLoading(true);
            setMessage('');
            const response = await api.get('/user-queries/active_query/');
            if (response.data) {
                setSelectedQuery(response.data.query_type);
                setStartDate(response.data.start_date || '');
                setEndDate(response.data.end_date || '');
                if (!queryResults) setQueryResults(response.data.results_data);
                setMessage('');
            }
        } catch (error) {
            if (error.response?.status === 404) {
                // No hay consulta guardada
            } else {
                // Error cargando consulta activa
            }
        } finally { setIsLoading(false); }
    };

    const saveQueryToBackend = async (queryType, sDate, eDate, results) => {
        const payload = { query_type: queryType, start_date: sDate || null, end_date: eDate || null, results_data: results };
        try {
            const listResp = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
            const items = Array.isArray(listResp.data) ? listResp.data : (listResp.data?.results || []);
            if (items && items.length > 0) {
                const existing = items[0];
                const id = existing.id;
                try { const patchResp = await api.patch(`/user-queries/${id}/`, payload); if (patchResp?.data) return; } catch (patchErr) { /* Error parchando consulta existente, fallback a POST */ }
            }
            const postResp = await api.post('/user-queries/', payload);
            if (postResp?.data) return;
        } catch (error) {
            // Advertencia al guardar consulta, intentando recuperación
            try {
                const listResp2 = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
                const items2 = Array.isArray(listResp2.data) ? listResp2.data : (listResp2.data?.results || []);
                if (items2 && items2.length > 0) {
                    const existing = items2[0]; const id = existing.id; const patchResp2 = await api.patch(`/user-queries/${id}/`, payload); if (patchResp2?.data) return;
                }
            } catch (recErr) { /* Error intentando recuperar/actualizar consulta después de fallo */ }
            // Error final guardando consulta
        }
    };

    const clearActiveQuery = async () => { try { await api.post('/user-queries/clear_active_query/'); /* Consulta activa limpiada */ } catch (error) { /* Error limpiando consulta */ } };

    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;

        // Handle YYYY-MM-DD from date picker to avoid timezone issues
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            // Creates date at 00:00:00 in the local timezone
            return new Date(year, month - 1, day);
        }

        // Handle DD/MM/YYYY
        if (typeof dateStr === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        }

        // Handle full ISO strings from backend (or other formats)
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDateForDisplay = (dateStr) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const executeStockQuery = async () => {
        // Verificación de fechas: solo requerida si no hay filtros específicos
        const hasSpecificFilters = stockIdFilter || stockNameFilter || stockQuantityFilter || stockPriceFilter || stockTypeFilter || stockStatusFilter.length > 0;
        
        if (!hasSpecificFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese una fecha de inicio y una de fin o use filtros específicos.');
            return;
        }

        // Formatear unidades correctamente - convertir de unidades base a unidades de visualización
        const formatStockWithUnit = (stock, unit) => {
            const stockNum = parseFloat(stock) || 0;
            
            if (!unit || unit === 'u' || unit === 'unidades' || unit === 'Unidades') {
                return `${stockNum}U`;
            } else if (unit === 'g' || unit === 'gramos') {
                // Convertir gramos a kilogramos
                const kg = (stockNum / 1000).toFixed(3);
                return `${parseFloat(kg)}Kg`;
            } else if (unit === 'ml' || unit === 'mililitros') {
                // Convertir mililitros a litros
                const liters = (stockNum / 1000).toFixed(3);
                return `${parseFloat(liters)}L`;
            }
            return `${stockNum}${unit}`;
        };

        // Aplicar filtros independientes
        let filteredInventory = [...(inventory || [])];

        // 1. Filtro por ID con operadores lógicos
        if (stockIdFilter) {
            const filterValue = parseInt(stockIdFilter);
            if (!isNaN(filterValue)) {
                filteredInventory = filteredInventory.filter(item => {
                    const itemId = parseInt(item.id);
                    switch (stockIdFilterOp) {
                        case 'equals': return itemId === filterValue;
                        case 'greater': return itemId > filterValue;
                        case 'greaterOrEqual': return itemId >= filterValue;
                        case 'less': return itemId < filterValue;
                        case 'lessOrEqual': return itemId <= filterValue;
                        default: return true;
                    }
                });
            }
        }

        // 2. Filtro por Nombre
        if (stockNameFilter) {
            filteredInventory = filteredInventory.filter(item => 
                String(item.name || '').toLowerCase().includes(stockNameFilter.toLowerCase())
            );
        }

        // 3. Filtro por Cantidad/Stock
        if (stockQuantityFilter) {
            filteredInventory = filteredInventory.filter(item => {
                const itemQuantity = parseFloat(item.stock) || 0;
                const filterQuantity = parseFloat(stockQuantityFilter) || 0;
                const itemUnit = (item.unit || 'u').toLowerCase();
                const filterUnit = stockQuantityUnit.toLowerCase();
                
                // Convertir a la misma unidad para comparar
                let normalizedItemQuantity = itemQuantity;
                let normalizedFilterQuantity = filterQuantity;
                
                // Si las unidades no coinciden, convertir
                if (itemUnit !== filterUnit) {
                    // Convertir item a unidad de filtro
                    if (filterUnit === 'kg' && itemUnit === 'g') {
                        normalizedItemQuantity = itemQuantity / 1000;
                    } else if (filterUnit === 'l' && itemUnit === 'ml') {
                        normalizedItemQuantity = itemQuantity / 1000;
                    } else if (filterUnit === 'u' && (itemUnit === 'unidades' || itemUnit === '')) {
                        normalizedItemQuantity = itemQuantity;
                    } else {
                        // Unidades incompatibles, no filtrar este item
                        return false;
                    }
                }
                
                switch (stockQuantityOp) {
                    case 'equals': return Math.abs(normalizedItemQuantity - normalizedFilterQuantity) < 0.001;
                    case 'gt': return normalizedItemQuantity > normalizedFilterQuantity;
                    case 'gte': return normalizedItemQuantity >= normalizedFilterQuantity;
                    case 'lt': return normalizedItemQuantity < normalizedFilterQuantity;
                    case 'lte': return normalizedItemQuantity <= normalizedFilterQuantity;
                    default: return normalizedItemQuantity === normalizedFilterQuantity;
                }
            });
        }

        // 4. Filtro por Precio
        if (stockPriceFilter) {
            filteredInventory = filteredInventory.filter(item => {
                const itemPrice = parseFloat(item.price || item.unit_price || 0);
                const filterPrice = parseFloat(stockPriceFilter) || 0;
                
                switch (stockPriceOp) {
                    case 'equals': return Math.abs(itemPrice - filterPrice) < 0.01;
                    case 'gt': return itemPrice > filterPrice;
                    case 'gte': return itemPrice >= filterPrice;
                    case 'lt': return itemPrice < filterPrice;
                    case 'lte': return itemPrice <= filterPrice;
                    default: return itemPrice === filterPrice;
                }
            });
        }

        // 5. Filtro por Tipo
        if (stockTypeFilter) {
            filteredInventory = filteredInventory.filter(item => 
                (item.type || item.category || '').toLowerCase() === stockTypeFilter.toLowerCase()
            );
        }

        // 6. Filtro por Estado (múltiple)
        if (stockStatusFilter.length > 0) {
            filteredInventory = filteredInventory.filter(item => {
                const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
                const stock = parseFloat(item.stock) || 0;
                const itemStatus = stock < threshold ? 'Stock Bajo' : stock < (threshold * 2) ? 'Stock Medio' : 'Stock Alto';
                return stockStatusFilter.includes(itemStatus);
            });
        }

        // Calcular totales después de aplicar filtros
        const computeTotals = (itemsList) => {
            const totals = { productos: { kg: 0, l: 0, u: 0 }, insumos: { kg: 0, l: 0, u: 0 } };
            
            itemsList.forEach(item => {
                const stockNum = parseFloat(item.stock) || 0;
                const category = (item.type || item.category || '').toLowerCase();
                const unit = (item.unit || 'u').toLowerCase();
                
                if (category === 'producto') {
                    if (unit === 'g') {
                        totals.productos.kg += stockNum / 1000;
                    } else if (unit === 'ml') {
                        totals.productos.l += stockNum / 1000;
                    } else {
                        totals.productos.u += stockNum;
                    }
                } else if (category === 'insumo') {
                    if (unit === 'g') {
                        totals.insumos.kg += stockNum / 1000;
                    } else if (unit === 'ml') {
                        totals.insumos.l += stockNum / 1000;
                    } else {
                        totals.insumos.u += stockNum;
                    }
                }
            });
            
            const formatTotal = (value, unitSymbol) => {
                if (value === 0) return null;
                return `${value.toFixed(2)}${unitSymbol}`;
            };
            
            const productTotals = [
                formatTotal(totals.productos.kg, 'Kg'),
                formatTotal(totals.productos.l, 'L'),
                formatTotal(totals.productos.u, 'U')
            ].filter(Boolean);
            
            const insumoTotals = [
                formatTotal(totals.insumos.kg, 'Kg'),
                formatTotal(totals.insumos.l, 'L'),
                formatTotal(totals.insumos.u, 'U')
            ].filter(Boolean);
            
            return {
                productos: productTotals.length > 0 ? productTotals.join(' + ') : '0',
                insumos: insumoTotals.length > 0 ? insumoTotals.join(' + ') : '0'
            };
        };

        const stockTotals = computeTotals(filteredInventory);

        const productos = filteredInventory.filter(item => (item.type || item.category || '').toLowerCase() === 'producto');
        const insumos = filteredInventory.filter(item => (item.type || item.category || '').toLowerCase() === 'insumo');

        const results = {
            title: 'Estado del Stock',
            summary: {
                totalProducts: productos.length,
                totalInsumos: insumos.length,
                lowStockItems: filteredInventory.filter(item => {
                    const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
                    return (parseFloat(item.stock) || 0) < threshold;
                }).length,
                totalStock: `Productos: ${stockTotals.productos} | Insumos: ${stockTotals.insumos}`
            },
            data: filteredInventory.map(item => ({
                id: item.id,
                name: item.name,
                stock: formatStockWithUnit(item.stock, item.unit),
                type: item.type || item.category,
                price: item.price,
                status: (() => {
                    const threshold = item.low_stock_threshold || item.lowStockThreshold || 10;
                    const stock = parseFloat(item.stock) || 0;
                    return stock < threshold ? 'Stock Bajo' : stock < (threshold * 2) ? 'Stock Medio' : 'Stock Alto';
                })()
            }))
        };
        
        setQueryResults(results);
        return results;
    };

    const executeSuppliersQuery = async () => {
        // Verificación: Si no hay filtros específicos, mostrar todos los proveedores
        const hasFilters = suppliersIdFilter.trim() || suppliersNameFilter.trim() || suppliersCuitFilter.trim() || 
                          suppliersPhoneFilter.trim() || suppliersAddressFilter.trim() || suppliersProductFilter.trim();

        // Aplicar filtros independientes
        let filteredSuppliers = suppliers;

        // 1. Filtro de ID (independiente)
        if (suppliersIdFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const supplierId = Number(supplier.id);
                const filterId = Number(suppliersIdFilter);
                
                switch (suppliersIdFilterOp) {
                    case 'equals':
                        return supplierId === filterId;
                    case 'lt':
                        return supplierId < filterId;
                    case 'lte':
                        return supplierId <= filterId;
                    case 'gt':
                        return supplierId > filterId;
                    case 'gte':
                        return supplierId >= filterId;
                    default:
                        return supplierId === filterId;
                }
            });
        }

        // 2. Filtro de nombre (independiente)
        if (suppliersNameFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const name = String(supplier.name || '').toLowerCase();
                const filterValue = suppliersNameFilter.toLowerCase();
                
                switch (suppliersNameFilterOp) {
                    case 'equals':
                        return name === filterValue;
                    case 'contains':
                        return name.includes(filterValue);
                    default:
                        return name.includes(filterValue);
                }
            });
        }

        // 3. Filtro de CUIT (independiente)
        if (suppliersCuitFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const cuit = String(supplier.cuit || '').toLowerCase();
                const filterValue = suppliersCuitFilter.toLowerCase();
                
                switch (suppliersCuitFilterOp) {
                    case 'equals':
                        return cuit === filterValue;
                    case 'contains':
                        return cuit.includes(filterValue);
                    default:
                        return cuit.includes(filterValue);
                }
            });
        }

        // 4. Filtro de teléfono (independiente)
        if (suppliersPhoneFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const phone = String(supplier.phone || '').toLowerCase();
                const filterValue = suppliersPhoneFilter.toLowerCase();
                
                switch (suppliersPhoneFilterOp) {
                    case 'equals':
                        return phone === filterValue;
                    case 'contains':
                        return phone.includes(filterValue);
                    default:
                        return phone.includes(filterValue);
                }
            });
        }

        // 5. Filtro de dirección (independiente)
        if (suppliersAddressFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const address = String(supplier.address || '').toLowerCase();
                const filterValue = suppliersAddressFilter.toLowerCase();
                
                switch (suppliersAddressFilterOp) {
                    case 'equals':
                        return address === filterValue;
                    case 'contains':
                        return address.includes(filterValue);
                    default:
                        return address.includes(filterValue);
                }
            });
        }

        // 6. Filtro de producto/insumo (independiente)
        if (suppliersProductFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const filterValue = suppliersProductFilter.toLowerCase().trim();
                
                // Si products es un array, buscar en cada elemento
                if (Array.isArray(supplier.products)) {
                    return supplier.products.some(product => {
                        const productName = String(product.name || product.productName || product || '').toLowerCase().trim();
                        
                        switch (suppliersProductFilterOp) {
                            case 'equals':
                                return productName === filterValue;
                            case 'contains':
                                return productName.includes(filterValue);
                            default:
                                return productName.includes(filterValue);
                        }
                    });
                } else {
                    // Si products es un string, dividir por comas y buscar en cada producto
                    const productsStr = String(supplier.products || '');
                    const productList = productsStr.split(',').map(p => p.toLowerCase().trim());
                    
                    switch (suppliersProductFilterOp) {
                        case 'equals':
                            // Buscar coincidencia exacta en alguno de los productos
                            return productList.some(product => product === filterValue);
                        case 'contains':
                            // Buscar si algún producto contiene el texto
                            return productList.some(product => product.includes(filterValue));
                        default:
                            return productList.some(product => product.includes(filterValue));
                    }
                }
            });
        }

        const results = { 
            title: 'Información de Proveedores', 
            summary: { 
                totalSuppliers: filteredSuppliers.length,
                activeSuppliers: filteredSuppliers.length,
                filtersApplied: hasFilters ? 'Sí' : 'No'
            }, 
            data: filteredSuppliers.map(supplier => ({
                id: supplier.id,
                name: supplier.name,
                cuit: supplier.cuit,
                phone: supplier.phone,
                address: supplier.address,
                products: Array.isArray(supplier.products) 
                    ? supplier.products.map(p => p.name || p.productName || p || '').filter(Boolean).join(', ')
                    : (supplier.products || '')
            }))
        };
        
        setQueryResults(results);
        return results;
    };

    const executeSalesQuery = async () => {
        // Verificación de fechas: solo requerida si no hay filtros específicos
        const hasGranularFilters = salesDateFromYear || salesDateFromMonth || salesDateFromDay || salesDateFromHour || salesDateFromMinute || salesDateToYear || salesDateToMonth || salesDateToDay || salesDateToHour || salesDateToMinute;
        const hasOtherFilters = salesIdFilter || salesProductFilter || salesUserFilter || salesTotalFilter || salesQuantityFilter;
        
        if (!hasGranularFilters && !hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese una fecha de inicio y una de fin o use filtros específicos.');
            return;
        }

        let allSales = Array.isArray(sales) ? sales : [];
        if ((!Array.isArray(allSales) || allSales.length === 0)) {
            try { 
                const loaded = await loadSales(); 
                allSales = Array.isArray(loaded) && loaded.length > 0 ? loaded : (Array.isArray(sales) ? sales : []); 
            } catch (e) { 
                allSales = Array.isArray(sales) ? sales : []; 
            }
        }
        
        const rows = [];
        for (const s of allSales) {
            const date = s.timestamp || s.created_at || s.date || '';
            let itemsArr = [];
            if (Array.isArray(s.sale_items) && s.sale_items.length > 0) {
                itemsArr = s.sale_items.map(it => ({ 
                    product: it.product_name || it.product || it.name || '', 
                    quantity: Number(it.quantity ?? it.qty ?? 0)||0, 
                    unitPrice: Number(it.price ?? it.unit_price ?? 0)||0, 
                    total: (it.total !== undefined && it.total !== null) ? Number(it.total) : ((Number(it.quantity)||0)*(Number(it.price)||0)) 
                }));
            } else if (Array.isArray(s.items) && s.items.length > 0) {
                itemsArr = s.items.map(it => ({ 
                    product: it.product_name || it.productName || it.product || it.name || '', 
                    quantity: Number(it.quantity ?? it.qty ?? 0)||0, 
                    unitPrice: Number(it.price ?? it.unitPrice ?? it.unit_price ?? 0)||0, 
                    total: (it.total !== undefined && it.total !== null) ? Number(it.total) : ((Number(it.quantity)||0)*(Number(it.price)||0)) 
                }));
            }
            // Fallback: si la venta no tiene items detallados
            if (itemsArr.length === 0) {
                if (s.product) {
                    itemsArr = [{ product: s.product, quantity: s.quantity || 1, total: s.total || s.amount || 0 }];
                } else if (s.total_amount !== undefined || s.total !== undefined || s.amount !== undefined) {
                    const totalVal = Number(s.total_amount ?? s.total ?? s.amount ?? 0) || 0;
                    itemsArr = [{ product: s.product_name || s.product || 'Venta (sin items detallados)', quantity: 1, total: totalVal }];
                }
            }
            const saleUser = s.user || s.user_username || s.user_name || (s.user && s.user.username) || (s.user && s.user.name) || 'Sistema';
            for (const it of itemsArr) { 
                rows.push({ id: s.id ?? null, date, product: it.product, quantity: it.quantity, total: it.total, user: saleUser }); 
            }
        }
        
        // Aplicar filtros independientes
        let filteredSales = rows;
        
        // 1. Filtro por ID con operadores lógicos
        if (salesIdFilter) {
            const filterValue = parseInt(salesIdFilter);
            if (!isNaN(filterValue)) {
                filteredSales = filteredSales.filter(sale => {
                    const saleId = parseInt(sale.id);
                    switch (salesIdFilterOp) {
                        case 'equals': return saleId === filterValue;
                        case 'greater': return saleId > filterValue;
                        case 'greaterOrEqual': return saleId >= filterValue;
                        case 'less': return saleId < filterValue;
                        case 'lessOrEqual': return saleId <= filterValue;
                        default: return true;
                    }
                });
            }
        }
        
        // 2. Filtro por fechas granular (independiente)
        if (hasGranularFilters) {
            filteredSales = filteredSales.filter(sale => {
                const saleDate = parseAnyDate(sale.date);
                if (!saleDate) return false;
                
                // Determinar si hay algún filtro "hasta" definido
                const hasToFilters = salesDateToYear || salesDateToMonth || salesDateToDay || salesDateToHour || salesDateToMinute;
                
                let matches = true;
                
                // Filtros "desde"
                if (salesDateFromYear && matches) {
                    if (hasToFilters) {
                        matches = saleDate.getFullYear() >= parseInt(salesDateFromYear);
                    } else {
                        matches = saleDate.getFullYear() === parseInt(salesDateFromYear);
                    }
                }
                
                if (salesDateFromMonth && matches) {
                    if (hasToFilters) {
                        if (salesDateFromYear) {
                            const yearMatches = saleDate.getFullYear() > parseInt(salesDateFromYear);
                            const yearExact = saleDate.getFullYear() === parseInt(salesDateFromYear);
                            matches = yearMatches || (yearExact && saleDate.getMonth() >= (parseInt(salesDateFromMonth) - 1));
                        } else {
                            matches = saleDate.getMonth() >= (parseInt(salesDateFromMonth) - 1);
                        }
                    } else {
                        const yearMatches = !salesDateFromYear || saleDate.getFullYear() === parseInt(salesDateFromYear);
                        matches = yearMatches && saleDate.getMonth() === (parseInt(salesDateFromMonth) - 1);
                    }
                }
                
                if (salesDateFromDay && matches) {
                    if (hasToFilters) {
                        const yearMatch = !salesDateFromYear || saleDate.getFullYear() >= parseInt(salesDateFromYear);
                        const monthMatch = !salesDateFromMonth || saleDate.getMonth() >= (parseInt(salesDateFromMonth) - 1);
                        if (salesDateFromYear && salesDateFromMonth) {
                            const exactYearMonth = saleDate.getFullYear() === parseInt(salesDateFromYear) && 
                                                   saleDate.getMonth() === (parseInt(salesDateFromMonth) - 1);
                            matches = (!exactYearMonth) || (exactYearMonth && saleDate.getDate() >= parseInt(salesDateFromDay));
                        } else {
                            matches = yearMatch && monthMatch && saleDate.getDate() >= parseInt(salesDateFromDay);
                        }
                    } else {
                        const yearMatches = !salesDateFromYear || saleDate.getFullYear() === parseInt(salesDateFromYear);
                        const monthMatches = !salesDateFromMonth || saleDate.getMonth() === (parseInt(salesDateFromMonth) - 1);
                        matches = yearMatches && monthMatches && saleDate.getDate() === parseInt(salesDateFromDay);
                    }
                }
                
                if (salesDateFromHour && matches) {
                    const yearMatches = !salesDateFromYear || saleDate.getFullYear() === parseInt(salesDateFromYear);
                    const monthMatches = !salesDateFromMonth || saleDate.getMonth() === (parseInt(salesDateFromMonth) - 1);
                    const dayMatches = !salesDateFromDay || saleDate.getDate() === parseInt(salesDateFromDay);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches) {
                            matches = saleDate.getHours() >= parseInt(salesDateFromHour);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && saleDate.getHours() === parseInt(salesDateFromHour);
                    }
                }
                
                if (salesDateFromMinute && matches) {
                    const yearMatches = !salesDateFromYear || saleDate.getFullYear() === parseInt(salesDateFromYear);
                    const monthMatches = !salesDateFromMonth || saleDate.getMonth() === (parseInt(salesDateFromMonth) - 1);
                    const dayMatches = !salesDateFromDay || saleDate.getDate() === parseInt(salesDateFromDay);
                    const hourMatches = !salesDateFromHour || saleDate.getHours() === parseInt(salesDateFromHour);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches && hourMatches) {
                            matches = saleDate.getMinutes() >= parseInt(salesDateFromMinute);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && hourMatches && saleDate.getMinutes() === parseInt(salesDateFromMinute);
                    }
                }
                
                // Filtros "hasta" (solo se aplican si hay filtros "hasta" definidos)
                if (hasToFilters) {
                    if (salesDateToYear && matches) {
                        matches = saleDate.getFullYear() <= parseInt(salesDateToYear);
                    }
                    if (salesDateToMonth && matches) {
                        if (salesDateToYear) {
                            const yearMatches = saleDate.getFullYear() < parseInt(salesDateToYear);
                            const yearExact = saleDate.getFullYear() === parseInt(salesDateToYear);
                            matches = yearMatches || (yearExact && saleDate.getMonth() <= (parseInt(salesDateToMonth) - 1));
                        } else {
                            matches = saleDate.getMonth() <= (parseInt(salesDateToMonth) - 1);
                        }
                    }
                    if (salesDateToDay && matches) {
                        const exactYearMonth = (!salesDateToYear || saleDate.getFullYear() === parseInt(salesDateToYear)) && 
                                               (!salesDateToMonth || saleDate.getMonth() === (parseInt(salesDateToMonth) - 1));
                        if (exactYearMonth) {
                            matches = saleDate.getDate() <= parseInt(salesDateToDay);
                        }
                    }
                    if (salesDateToHour && matches) {
                        const exactDate = (!salesDateToYear || saleDate.getFullYear() === parseInt(salesDateToYear)) &&
                                          (!salesDateToMonth || saleDate.getMonth() === (parseInt(salesDateToMonth) - 1)) &&
                                          (!salesDateToDay || saleDate.getDate() === parseInt(salesDateToDay));
                        if (exactDate) {
                            matches = saleDate.getHours() <= parseInt(salesDateToHour);
                        }
                    }
                    if (salesDateToMinute && matches) {
                        const exactDateTime = (!salesDateToYear || saleDate.getFullYear() === parseInt(salesDateToYear)) &&
                                              (!salesDateToMonth || saleDate.getMonth() === (parseInt(salesDateToMonth) - 1)) &&
                                              (!salesDateToDay || saleDate.getDate() === parseInt(salesDateToDay)) &&
                                              (!salesDateToHour || saleDate.getHours() === parseInt(salesDateToHour));
                        if (exactDateTime) {
                            matches = saleDate.getMinutes() <= parseInt(salesDateToMinute);
                        }
                    }
                }
                
                return matches;
            });
        }
        // Filtro por fechas estándar (startDate/endDate) - solo si no hay filtros granulares
        else if (startDate && endDate && !hasOtherFilters) {
            filteredSales = filteredSales.filter(sale => {
                const saleDate = parseAnyDate(sale.date) || null;
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                }
                if (!saleDate || !start || !end) return false;
                return saleDate >= start && saleDate <= end;
            });
        }
        
        // 3. Filtro por Producto
        if (salesProductFilter) {
            filteredSales = filteredSales.filter(sale => 
                String(sale.product || '').toLowerCase().includes(salesProductFilter.toLowerCase())
            );
        }
        
        // 4. Filtro por Usuario
        if (salesUserFilter) {
            filteredSales = filteredSales.filter(sale => 
                String(sale.user || '').toLowerCase().includes(salesUserFilter.toLowerCase())
            );
        }
        
        // 5. Filtro por Total
        if (salesTotalFilter) {
            filteredSales = filteredSales.filter(sale => {
                const saleTotal = Number(sale.total) || 0;
                const filterTotal = Number(salesTotalFilter) || 0;
                
                switch (salesTotalOp) {
                    case 'equals': return saleTotal === filterTotal;
                    case 'gt': return saleTotal > filterTotal;
                    case 'gte': return saleTotal >= filterTotal;
                    case 'lt': return saleTotal < filterTotal;
                    case 'lte': return saleTotal <= filterTotal;
                    default: return saleTotal === filterTotal;
                }
            });
        }
        
        // 6. Filtro por Cantidad
        if (salesQuantityFilter) {
            filteredSales = filteredSales.filter(sale => {
                const saleQuantity = Number(sale.quantity) || 0;
                const filterQuantity = Number(salesQuantityFilter) || 0;
                
                switch (salesQuantityOp) {
                    case 'equals': return saleQuantity === filterQuantity;
                    case 'gt': return saleQuantity > filterQuantity;
                    case 'gte': return saleQuantity >= filterQuantity;
                    case 'lt': return saleQuantity < filterQuantity;
                    case 'lte': return saleQuantity <= filterQuantity;
                    default: return saleQuantity === filterQuantity;
                }
            });
        }
        
        const results = { 
            title: 'Reporte de Ventas', 
            summary: { 
                totalSales: filteredSales.length, 
                totalRevenue: filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0),
                period: hasGranularFilters 
                    ? `Filtro personalizado por fechas` 
                    : startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredSales.map(r=>({ id: r.id, date: r.date, product: r.product, quantity: r.quantity, total: r.total, user: r.user })) 
        };
        
        setQueryResults(results);
        return results;
    };

    const executePurchasesQuery = async () => {
        // Verificación de fechas: solo requerida si no hay filtros granulares ni otros filtros específicos
        const hasGranularFilters = purchasesDateFromYear || purchasesDateFromMonth || purchasesDateFromDay || purchasesDateFromHour || purchasesDateFromMinute || purchasesDateToYear || purchasesDateToMonth || purchasesDateToDay || purchasesDateToHour || purchasesDateToMinute;
        const hasOtherFilters = purchasesIdFilter.trim() || purchasesSupplierFilter.trim() || purchasesTotalFilter.trim() || purchasesTypeFilter.length > 0 || purchasesProductFilter.trim();
        
        if (!hasGranularFilters && !hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese una fecha de inicio y una de fin o use filtros específicos.');
            return;
        }

        // Primero normalizar las compras para asegurar valores consistentes
        const normalizedPurchases = purchases.map(purchase => {
            const itemsArray = Array.isArray(purchase.items) ? purchase.items.map(it => { 
                const productName = it.productName || it.product_name || it.product || it.name || ''; 
                const quantity = it.quantity ?? it.qty ?? 0; 
                const unitPrice = it.unitPrice ?? it.unit_price ?? it.price ?? 0; 
                const total = it.total ?? it.totalAmount ?? ((quantity ?? 0) * (unitPrice ?? 0)); 
                let category = it.category || it.type || it.productCategory || it.product_category || ''; 
                if ((!category || String(category).trim() === '') && productName) { 
                    try { 
                        const found = (inventory || []).find(p => p && p.name && String(p.name).toLowerCase() === String(productName).toLowerCase()); 
                        if (found && (found.type || found.category)) { 
                            category = found.type || found.category || ''; 
                        } 
                    } catch (e) { } 
                } 
                return { productName, quantity, unitPrice, total, category }; 
            }) : [];
            
            const supplierName = purchase.supplierName || purchase.supplier || '';
            const totalAmount = Number(purchase.totalAmount ?? purchase.total_amount ?? purchase.total ?? 0);
            const detectedTypes = Array.from(new Set(itemsArray.map(i => (i.category || '').toString().toLowerCase()).filter(Boolean)));
            let purchaseType = 'Producto'; 
            if (detectedTypes.length === 0) {
                purchaseType = 'Producto';
            } else if (detectedTypes.length === 1) {
                purchaseType = detectedTypes[0].includes('insumo') ? 'Insumo' : (detectedTypes[0].includes('producto') ? 'Producto' : 'Producto');
            } else {
                purchaseType = 'Mixto';
            }
            
            return { 
                id: purchase.id, 
                date: purchase.created_at || purchase.date, 
                supplier: supplierName, 
                items: itemsArray, 
                total: totalAmount, 
                status: purchase.status || 'Completada', 
                type: purchaseType 
            };
        });

        // Aplicar filtros independientes
        let filteredPurchases = normalizedPurchases;

        // 1. Filtro de fechas granular (independiente)
        if (purchasesDateFromYear || purchasesDateFromMonth || purchasesDateFromDay || purchasesDateFromHour || purchasesDateFromMinute || purchasesDateToYear || purchasesDateToMonth || purchasesDateToDay || purchasesDateToHour || purchasesDateToMinute) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseDate = parseAnyDate(purchase.date);
                if (!purchaseDate) return false;
                
                let matches = true;
                
                // Filtros "desde" - usar >= para rangos, o === para valores exactos si no hay "hasta"
                if (purchasesDateFromYear) {
                    if (purchasesDateToYear) {
                        matches = matches && purchaseDate.getFullYear() >= parseInt(purchasesDateFromYear);
                    } else {
                        matches = matches && purchaseDate.getFullYear() === parseInt(purchasesDateFromYear);
                    }
                }
                if (purchasesDateFromMonth) {
                    if (purchasesDateToMonth) {
                        matches = matches && purchaseDate.getMonth() >= (parseInt(purchasesDateFromMonth) - 1);
                    } else {
                        matches = matches && purchaseDate.getMonth() === (parseInt(purchasesDateFromMonth) - 1);
                    }
                }
                if (purchasesDateFromDay) {
                    if (purchasesDateToDay) {
                        matches = matches && purchaseDate.getDate() >= parseInt(purchasesDateFromDay);
                    } else {
                        matches = matches && purchaseDate.getDate() === parseInt(purchasesDateFromDay);
                    }
                }
                if (purchasesDateFromHour) {
                    if (purchasesDateToHour) {
                        matches = matches && purchaseDate.getHours() >= parseInt(purchasesDateFromHour);
                    } else {
                        matches = matches && purchaseDate.getHours() === parseInt(purchasesDateFromHour);
                    }
                }
                if (purchasesDateFromMinute) {
                    if (purchasesDateToMinute) {
                        matches = matches && purchaseDate.getMinutes() >= parseInt(purchasesDateFromMinute);
                    } else {
                        matches = matches && purchaseDate.getMinutes() === parseInt(purchasesDateFromMinute);
                    }
                }
                
                // Filtros "hasta" - siempre usar <=
                if (purchasesDateToYear) {
                    matches = matches && purchaseDate.getFullYear() <= parseInt(purchasesDateToYear);
                }
                if (purchasesDateToMonth) {
                    matches = matches && purchaseDate.getMonth() <= (parseInt(purchasesDateToMonth) - 1);
                }
                if (purchasesDateToDay) {
                    matches = matches && purchaseDate.getDate() <= parseInt(purchasesDateToDay);
                }
                if (purchasesDateToHour) {
                    matches = matches && purchaseDate.getHours() <= parseInt(purchasesDateToHour);
                }
                if (purchasesDateToMinute) {
                    matches = matches && purchaseDate.getMinutes() <= parseInt(purchasesDateToMinute);
                }
                
                return matches;
            });
        } else if (startDate && endDate) {
            // Filtros de fecha estándar (startDate/endDate)
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseDate = parseAnyDate(purchase.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                }
                if (!purchaseDate || !start || !end) return false;
                return purchaseDate >= start && purchaseDate <= end;
            });
        }
        
        // 2. Filtro de ID (independiente)
        if (purchasesIdFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseId = Number(purchase.id);
                const filterId = Number(purchasesIdFilter);
                
                switch (purchasesIdFilterOp) {
                    case 'equals':
                        return purchaseId === filterId;
                    case 'lt':
                        return purchaseId < filterId;
                    case 'lte':
                        return purchaseId <= filterId;
                    case 'gt':
                        return purchaseId > filterId;
                    case 'gte':
                        return purchaseId >= filterId;
                    default:
                        return purchaseId === filterId;
                }
            });
        }
        
        // 3. Filtro de proveedor (independiente)
        if (purchasesSupplierFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const supplierName = String(purchase.supplier || '').toLowerCase();
                const filterValue = purchasesSupplierFilter.toLowerCase();
                
                switch (purchasesSupplierFilterOp) {
                    case 'equals':
                        return supplierName === filterValue;
                    case 'contains':
                        return supplierName.includes(filterValue);
                    default:
                        return supplierName.includes(filterValue);
                }
            });
        }
        
        // 4. Filtro de total (independiente)
        if (purchasesTotalFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const purchaseTotal = Number(purchase.total) || 0;
                const filterTotal = Number(purchasesTotalFilter) || 0;
                
                switch (purchasesTotalFilterOp) {
                    case 'equals':
                        return purchaseTotal === filterTotal;
                    case 'lt':
                        return purchaseTotal < filterTotal;
                    case 'lte':
                        return purchaseTotal <= filterTotal;
                    case 'gt':
                        return purchaseTotal > filterTotal;
                    case 'gte':
                        return purchaseTotal >= filterTotal;
                    default:
                        return purchaseTotal === filterTotal;
                }
            });
        }
        
        // 5. Filtro de tipos (Producto/Insumo) (independiente)
        if (purchasesTypeFilter.length > 0) {
            filteredPurchases = filteredPurchases.filter(purchase => 
                purchasesTypeFilter.includes(purchase.type)
            );
        }
        
        // 6. Filtro por nombre de producto/insumo (independiente)
        if (purchasesProductFilter) {
            filteredPurchases = filteredPurchases.filter(purchase => 
                purchase.items.some(item => 
                    String(item.productName || '').toLowerCase().includes(purchasesProductFilter.toLowerCase())
                )
            );
        }
        
        // 7. Filtro por cantidad (independiente)
        if (purchasesQuantityFilter.trim()) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                return purchase.items.some(item => {
                    const productName = item.productName || '';
                    let itemQuantity = item.quantity || 0;
                    
                    // Buscar el producto en inventory para obtener su unidad
                    const foundProduct = inventory.find(p => 
                        p && p.name && p.name.toLowerCase() === productName.toLowerCase()
                    );
                    
                    if (foundProduct) {
                        const productUnit = foundProduct.unit;
                        
                        // Convertir la cantidad del item a la unidad seleccionada en el filtro
                        if (purchasesQuantityUnit === 'Kg' && productUnit === 'g') {
                            // itemQuantity ya está en Kg (así se almacenan las compras)
                        } else if (purchasesQuantityUnit === 'L' && productUnit === 'ml') {
                            // itemQuantity ya está en L (así se almacenan las compras)
                        } else if (purchasesQuantityUnit === 'U' && (productUnit !== 'g' && productUnit !== 'ml')) {
                            // itemQuantity ya está en unidades
                        } else {
                            // No coincide la unidad del producto con la unidad del filtro
                            return false;
                        }
                    } else {
                        // Si no se encuentra el producto, asumir unidades
                        if (purchasesQuantityUnit !== 'U') {
                            return false;
                        }
                    }
                    
                    const filterQuantity = Number(purchasesQuantityFilter);
                    
                    switch (purchasesQuantityFilterOp) {
                        case 'equals':
                            return itemQuantity === filterQuantity;
                        case 'greater':
                            return itemQuantity > filterQuantity;
                        case 'greaterOrEqual':
                            return itemQuantity >= filterQuantity;
                        case 'less':
                            return itemQuantity < filterQuantity;
                        case 'lessOrEqual':
                            return itemQuantity <= filterQuantity;
                        default:
                            return itemQuantity === filterQuantity;
                    }
                });
            });
        }
        
        const results = { 
            title: 'Reporte de Compras', 
            summary: { 
                totalPurchases: filteredPurchases.length, 
                totalAmount: filteredPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0),
                byType: {
                    Producto: filteredPurchases.filter(p => p.type === 'Producto').length,
                    Insumo: filteredPurchases.filter(p => p.type === 'Insumo').length
                },
                period: (purchasesDateFromYear || purchasesDateToYear) 
                    ? `Filtro personalizado por fechas` 
                    : startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredPurchases.map(p => ({
                id: p.id, 
                date: p.date, 
                supplier: p.supplier, 
                total: p.total, 
                type: p.type,
                items: p.items
            }))
        };
        setQueryResults(results);
        return results;
    };

    const executeOrdersQuery = async () => {
        // Verificación de fechas: solo requerida si no hay filtros específicos
        const hasGranularFilters = ordersDateFromYear || ordersDateFromMonth || ordersDateFromDay || ordersDateFromHour || ordersDateFromMinute || ordersDateToYear || ordersDateToMonth || ordersDateToDay || ordersDateToHour || ordersDateToMinute;
        const hasOtherFilters = ordersIdFilter.trim() || ordersCustomerFilter.trim() || ordersPaymentMethodFilter.length > 0 || ordersStatusFilter.length > 0 || ordersProductFilter.trim() || ordersUnitsFilter.trim();
        
        if (!hasGranularFilters && !hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese una fecha de inicio y una de fin o use filtros específicos.');
            return;
        }

        // Primero normalizar los pedidos para asegurar valores consistentes de status
        const normalizedOrders = orders.map(order => {
            // Normalizar status: mantener los estados específicos que maneja el sistema
            let normalizedStatus = order.status || 'Pendiente';
            const statusLower = normalizedStatus.toLowerCase();
            
            // Mantener los estados específicos del sistema
            if (statusLower.includes('preparación') || statusLower.includes('preparacion')) {
                normalizedStatus = 'En Preparación';
            } else if (statusLower.includes('listo') || statusLower === 'ready') {
                normalizedStatus = 'Listo';
            } else if (statusLower.includes('entregado') || statusLower.includes('delivered') || statusLower.includes('enviado')) {
                normalizedStatus = 'Entregado';
            } else if (statusLower.includes('cancelado') || statusLower.includes('cancelled')) {
                normalizedStatus = 'Cancelado';
            } else if (statusLower.includes('pendiente') || statusLower === 'pending') {
                normalizedStatus = 'Pendiente';
            } else {
                // Si no reconocemos el status, mantener el original pero logearlo
                console.warn(`Status no reconocido en pedido ${order.id}: "${order.status}"`);
            }
            
            return { ...order, status: normalizedStatus };
        });

        // Aplicar filtros independientes
        let filteredOrders = normalizedOrders;

        // 1. Filtro de fechas granular (independiente)
        if (ordersDateFromYear || ordersDateFromMonth || ordersDateFromDay || ordersDateFromHour || ordersDateFromMinute || ordersDateToYear || ordersDateToMonth || ordersDateToDay || ordersDateToHour || ordersDateToMinute) {
            filteredOrders = filteredOrders.filter(order => {
                const orderDate = parseAnyDate(order.created_at || order.date);
                if (!orderDate) return false;
                
                // Determinar si hay algún filtro "hasta" definido
                const hasToFilters = ordersDateToYear || ordersDateToMonth || ordersDateToDay || ordersDateToHour || ordersDateToMinute;
                
                let matches = true;
                
                // Filtros exactos si no hay "hasta", filtros de rango si hay "hasta"
                if (ordersDateFromYear && matches) {
                    if (hasToFilters) {
                        matches = orderDate.getFullYear() >= parseInt(ordersDateFromYear);
                    } else {
                        matches = orderDate.getFullYear() === parseInt(ordersDateFromYear);
                    }
                }
                
                if (ordersDateFromMonth && matches) {
                    if (hasToFilters) {
                        if (ordersDateFromYear) {
                            const yearMatches = orderDate.getFullYear() > parseInt(ordersDateFromYear);
                            const yearExact = orderDate.getFullYear() === parseInt(ordersDateFromYear);
                            matches = yearMatches || (yearExact && orderDate.getMonth() >= (parseInt(ordersDateFromMonth) - 1));
                        } else {
                            matches = orderDate.getMonth() >= (parseInt(ordersDateFromMonth) - 1);
                        }
                    } else {
                        const yearMatches = !ordersDateFromYear || orderDate.getFullYear() === parseInt(ordersDateFromYear);
                        matches = yearMatches && orderDate.getMonth() === (parseInt(ordersDateFromMonth) - 1);
                    }
                }
                
                if (ordersDateFromDay && matches) {
                    if (hasToFilters) {
                        const yearMatch = !ordersDateFromYear || orderDate.getFullYear() >= parseInt(ordersDateFromYear);
                        const monthMatch = !ordersDateFromMonth || orderDate.getMonth() >= (parseInt(ordersDateFromMonth) - 1);
                        if (ordersDateFromYear && ordersDateFromMonth) {
                            const exactYearMonth = orderDate.getFullYear() === parseInt(ordersDateFromYear) && 
                                                   orderDate.getMonth() === (parseInt(ordersDateFromMonth) - 1);
                            matches = (!exactYearMonth) || (exactYearMonth && orderDate.getDate() >= parseInt(ordersDateFromDay));
                        } else {
                            matches = yearMatch && monthMatch && orderDate.getDate() >= parseInt(ordersDateFromDay);
                        }
                    } else {
                        const yearMatches = !ordersDateFromYear || orderDate.getFullYear() === parseInt(ordersDateFromYear);
                        const monthMatches = !ordersDateFromMonth || orderDate.getMonth() === (parseInt(ordersDateFromMonth) - 1);
                        matches = yearMatches && monthMatches && orderDate.getDate() === parseInt(ordersDateFromDay);
                    }
                }
                
                if (ordersDateFromHour && matches) {
                    const yearMatches = !ordersDateFromYear || orderDate.getFullYear() === parseInt(ordersDateFromYear);
                    const monthMatches = !ordersDateFromMonth || orderDate.getMonth() === (parseInt(ordersDateFromMonth) - 1);
                    const dayMatches = !ordersDateFromDay || orderDate.getDate() === parseInt(ordersDateFromDay);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches) {
                            matches = orderDate.getHours() >= parseInt(ordersDateFromHour);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && orderDate.getHours() === parseInt(ordersDateFromHour);
                    }
                }
                
                if (ordersDateFromMinute && matches) {
                    const yearMatches = !ordersDateFromYear || orderDate.getFullYear() === parseInt(ordersDateFromYear);
                    const monthMatches = !ordersDateFromMonth || orderDate.getMonth() === (parseInt(ordersDateFromMonth) - 1);
                    const dayMatches = !ordersDateFromDay || orderDate.getDate() === parseInt(ordersDateFromDay);
                    const hourMatches = !ordersDateFromHour || orderDate.getHours() === parseInt(ordersDateFromHour);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches && hourMatches) {
                            matches = orderDate.getMinutes() >= parseInt(ordersDateFromMinute);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && hourMatches && orderDate.getMinutes() === parseInt(ordersDateFromMinute);
                    }
                }
                
                // Filtros "hasta" (solo se aplican si hay filtros "hasta" definidos)
                if (hasToFilters) {
                    if (ordersDateToYear && matches) {
                        matches = orderDate.getFullYear() <= parseInt(ordersDateToYear);
                    }
                    if (ordersDateToMonth && matches) {
                        if (ordersDateToYear) {
                            const yearMatches = orderDate.getFullYear() < parseInt(ordersDateToYear);
                            const yearExact = orderDate.getFullYear() === parseInt(ordersDateToYear);
                            matches = yearMatches || (yearExact && orderDate.getMonth() <= (parseInt(ordersDateToMonth) - 1));
                        } else {
                            matches = orderDate.getMonth() <= (parseInt(ordersDateToMonth) - 1);
                        }
                    }
                    if (ordersDateToDay && matches) {
                        const exactYearMonth = (!ordersDateToYear || orderDate.getFullYear() === parseInt(ordersDateToYear)) && 
                                               (!ordersDateToMonth || orderDate.getMonth() === (parseInt(ordersDateToMonth) - 1));
                        if (exactYearMonth) {
                            matches = orderDate.getDate() <= parseInt(ordersDateToDay);
                        }
                    }
                    if (ordersDateToHour && matches) {
                        const exactDate = (!ordersDateToYear || orderDate.getFullYear() === parseInt(ordersDateToYear)) &&
                                          (!ordersDateToMonth || orderDate.getMonth() === (parseInt(ordersDateToMonth) - 1)) &&
                                          (!ordersDateToDay || orderDate.getDate() === parseInt(ordersDateToDay));
                        if (exactDate) {
                            matches = orderDate.getHours() <= parseInt(ordersDateToHour);
                        }
                    }
                    if (ordersDateToMinute && matches) {
                        const exactDateTime = (!ordersDateToYear || orderDate.getFullYear() === parseInt(ordersDateToYear)) &&
                                              (!ordersDateToMonth || orderDate.getMonth() === (parseInt(ordersDateToMonth) - 1)) &&
                                              (!ordersDateToDay || orderDate.getDate() === parseInt(ordersDateToDay)) &&
                                              (!ordersDateToHour || orderDate.getHours() === parseInt(ordersDateToHour));
                        if (exactDateTime) {
                            matches = orderDate.getMinutes() <= parseInt(ordersDateToMinute);
                        }
                    }
                }
                
                return matches;
            });
        } else if (startDate && endDate) {
            // Filtro por fechas estándar (startDate/endDate) - solo si no hay filtros granulares
            filteredOrders = filteredOrders.filter(order => {
                const orderDate = parseAnyDate(order.created_at || order.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                }
                if (!orderDate || !start || !end) return false;
                return orderDate >= start && orderDate <= end;
            });
        }
        
        // 2. Filtro de ID (independiente)
        if (ordersIdFilter.trim()) {
            filteredOrders = filteredOrders.filter(order => {
                const orderId = Number(order.id);
                const filterId = Number(ordersIdFilter);
                
                switch (ordersIdFilterOp) {
                    case 'equals':
                        return orderId === filterId;
                    case 'lt':
                        return orderId < filterId;
                    case 'lte':
                        return orderId <= filterId;
                    case 'gt':
                        return orderId > filterId;
                    case 'gte':
                        return orderId >= filterId;
                    default:
                        return orderId === filterId;
                }
            });
        }
        
        // 3. Filtro de cliente (independiente)
        if (ordersCustomerFilter.trim()) {
            filteredOrders = filteredOrders.filter(order => {
                const customerName = String(order.customerName || order.customer_name || '').toLowerCase();
                const filterValue = ordersCustomerFilter.toLowerCase();
                
                switch (ordersCustomerFilterOp) {
                    case 'equals':
                        return customerName === filterValue;
                    case 'contains':
                        return customerName.includes(filterValue);
                    default:
                        return customerName.includes(filterValue);
                }
            });
        }
        
        // Filtro por método de pago (múltiple selección)
        if (ordersPaymentMethodFilter.length > 0) {
            filteredOrders = filteredOrders.filter(order => {
                const paymentMethod = (order.paymentMethod || order.payment_method || '').toLowerCase();
                // Verificar si alguno de los métodos seleccionados está en el método de pago
                return ordersPaymentMethodFilter.some(method => {
                    const methodLower = method.toLowerCase();
                    return paymentMethod.includes(methodLower);
                });
            });
        }
        
        // Filtro por estado (múltiple selección)
        if (ordersStatusFilter.length > 0) {
            filteredOrders = filteredOrders.filter(order => {
                return ordersStatusFilter.includes(order.status);
            });
        }
        
        // 4. Filtro por nombre de producto (independiente)
        if (ordersProductFilter.trim()) {
            filteredOrders = filteredOrders.filter(order => {
                const itemsArray = Array.isArray(order.items) ? order.items : [];
                const filterValue = ordersProductFilter.toLowerCase();
                
                // Buscar en todos los productos del pedido
                return itemsArray.some(item => {
                    const productName = String(item.productName || item.product_name || item.product || '').toLowerCase();
                    return productName.includes(filterValue);
                });
            });
        }
        
        // 5. Filtro por unidades/cantidad (independiente)
        if (ordersUnitsFilter.trim()) {
            const filterValue = parseFloat(ordersUnitsFilter);
            if (!isNaN(filterValue)) {
                filteredOrders = filteredOrders.filter(order => {
                    const itemsArray = Array.isArray(order.items) ? order.items : [];
                    
                    // Buscar items que cumplan con el filtro de cantidad
                    return itemsArray.some(item => {
                        const quantity = parseFloat(item.quantity || 0);
                        
                        switch (ordersUnitsFilterOp) {
                            case 'equals':
                                return quantity === filterValue;
                            case 'greater':
                                return quantity > filterValue;
                            case 'greaterOrEqual':
                                return quantity >= filterValue;
                            case 'less':
                                return quantity < filterValue;
                            case 'lessOrEqual':
                                return quantity <= filterValue;
                            default:
                                return quantity === filterValue;
                        }
                    });
                });
            }
        }

        const results = { 
            title: 'Reporte de Pedidos', 
            summary: { 
                totalOrders: filteredOrders.length, 
                pendingOrders: filteredOrders.filter(o => o.status === 'Pendiente').length, 
                inPreparationOrders: filteredOrders.filter(o => o.status === 'En Preparación').length,
                readyOrders: filteredOrders.filter(o => o.status === 'Listo').length,
                deliveredOrders: filteredOrders.filter(o => o.status === 'Entregado').length,
                canceledOrders: filteredOrders.filter(o => o.status === 'Cancelado').length,
                period: (ordersDateFromYear || ordersDateToYear) 
                    ? `Filtro personalizado por fechas` 
                    : startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredOrders.map(order => { 
                let itemsArray = Array.isArray(order.items) ? order.items : [];
                
                // Aplicar filtros a nivel de items si están activos
                if (ordersProductFilter.trim() || ordersUnitsFilter.trim()) {
                    itemsArray = itemsArray.filter(item => {
                        let matches = true;
                        
                        // Filtro de producto
                        if (ordersProductFilter.trim()) {
                            const productName = String(item.productName || item.product_name || item.product || '').toLowerCase();
                            const filterValue = ordersProductFilter.toLowerCase();
                            matches = matches && productName.includes(filterValue);
                        }
                        
                        // Filtro de unidades
                        if (ordersUnitsFilter.trim()) {
                            const filterValue = parseFloat(ordersUnitsFilter);
                            if (!isNaN(filterValue)) {
                                const quantity = parseFloat(item.quantity || 0);
                                
                                switch (ordersUnitsFilterOp) {
                                    case 'equals':
                                        matches = matches && quantity === filterValue;
                                        break;
                                    case 'greater':
                                        matches = matches && quantity > filterValue;
                                        break;
                                    case 'greaterOrEqual':
                                        matches = matches && quantity >= filterValue;
                                        break;
                                    case 'less':
                                        matches = matches && quantity < filterValue;
                                        break;
                                    case 'lessOrEqual':
                                        matches = matches && quantity <= filterValue;
                                        break;
                                }
                            }
                        }
                        
                        return matches;
                    });
                }
                
                const productsList = itemsArray.map(it => it.productName || it.product_name || it.product || '').filter(Boolean); 
                const unitsList = itemsArray.map(it => (it.quantity !== undefined && it.quantity !== null) ? String(it.quantity) : '').filter(Boolean); 
                return { 
                    id: order.id, 
                    date: order.created_at || order.date, 
                    customerName: order.customerName || order.customer_name || '', 
                    paymentMethod: order.paymentMethod || order.payment_method || '', 
                    status: order.status,
                    items: itemsArray, 
                    products: productsList.join(', '), 
                    units: unitsList.join(', '), 
                    customer_name: order.customerName || order.customer_name || '', 
                    payment_method: order.paymentMethod || order.payment_method || '' 
                }; 
            }) 
        };
        setQueryResults(results);
        return results;
    };

    const executeCashMovementsQuery = async () => {
        // Verificación de fechas: solo requerida si no hay filtros específicos
        const hasGranularFilters = cashDateFromYear || cashDateFromMonth || cashDateFromDay || cashDateFromHour || cashDateFromMinute || cashDateToYear || cashDateToMonth || cashDateToDay || cashDateToHour || cashDateToMinute;
        const hasOtherFilters = cashIdFilter.trim() || cashAmountFilter.trim() || cashDescriptionFilter.trim() || cashUserFilter.trim() || cashTypeFilter || cashPaymentMethodFilter.length > 0;
        
        if (!hasGranularFilters && !hasOtherFilters && (!startDate || !endDate)) {
            setMessage('Por favor, ingrese una fecha de inicio y una de fin o use filtros específicos.');
            return;
        }

        let movementsToProcess = cashMovements;
        if (!movementsToProcess || movementsToProcess.length === 0) {
            try {
                const freshMovements = await loadCashMovements();
                movementsToProcess = freshMovements;
            } catch (e) {
                // No se pudo recargar movimientos desde backend
                movementsToProcess = [];
            }
        }

        const normalized = (movementsToProcess || []).map(m => {
            const rawDate = m.date || m.timestamp || m.created_at || m.date_iso || '';
            let type = (m.type || '').toString();
            const tLower = type.toLowerCase();
            if (tLower.startsWith('e') || tLower.includes('entrada') || tLower === 'in') type = 'Entrada';
            else if (tLower.startsWith('s') || tLower.includes('salida') || tLower === 'out') type = 'Salida';
            else type = m.type || type;
            const amount = (() => { const a = m.amount; const num = typeof a === 'number' ? a : parseFloat(a); return isNaN(num) ? 0 : num; })();
            return { id: m.id, date: rawDate, type, amount, description: m.description || '', user: m.user || (m.user_username || m.user_name) || 'Sistema', payment_method: m.payment_method || '', _raw: m };
        });

        // Aplicar filtros independientes
        let filteredMovements = normalized;

        // 1. Filtro de fechas granular (independiente)
        if (cashDateFromYear || cashDateFromMonth || cashDateFromDay || cashDateFromHour || cashDateFromMinute || cashDateToYear || cashDateToMonth || cashDateToDay || cashDateToHour || cashDateToMinute) {
            filteredMovements = filteredMovements.filter(movement => {
                const movementDate = parseAnyDate(movement.date);
                if (!movementDate) return false;
                
                // Determinar si hay algún filtro "hasta" definido
                const hasToFilters = cashDateToYear || cashDateToMonth || cashDateToDay || cashDateToHour || cashDateToMinute;
                
                let matches = true;
                
                // Filtros exactos si no hay "hasta", filtros de rango si hay "hasta"
                if (cashDateFromYear && matches) {
                    if (hasToFilters) {
                        matches = movementDate.getFullYear() >= parseInt(cashDateFromYear);
                    } else {
                        matches = movementDate.getFullYear() === parseInt(cashDateFromYear);
                    }
                }
                
                if (cashDateFromMonth && matches) {
                    if (hasToFilters) {
                        if (cashDateFromYear) {
                            const yearMatches = movementDate.getFullYear() > parseInt(cashDateFromYear);
                            const yearExact = movementDate.getFullYear() === parseInt(cashDateFromYear);
                            matches = yearMatches || (yearExact && movementDate.getMonth() >= (parseInt(cashDateFromMonth) - 1));
                        } else {
                            matches = movementDate.getMonth() >= (parseInt(cashDateFromMonth) - 1);
                        }
                    } else {
                        const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                        matches = yearMatches && movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                    }
                }
                
                if (cashDateFromDay && matches) {
                    if (hasToFilters) {
                        const yearMatch = !cashDateFromYear || movementDate.getFullYear() >= parseInt(cashDateFromYear);
                        const monthMatch = !cashDateFromMonth || movementDate.getMonth() >= (parseInt(cashDateFromMonth) - 1);
                        if (cashDateFromYear && cashDateFromMonth) {
                            const exactYearMonth = movementDate.getFullYear() === parseInt(cashDateFromYear) && 
                                                   movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                            matches = (!exactYearMonth) || (exactYearMonth && movementDate.getDate() >= parseInt(cashDateFromDay));
                        } else {
                            matches = yearMatch && monthMatch && movementDate.getDate() >= parseInt(cashDateFromDay);
                        }
                    } else {
                        const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                        const monthMatches = !cashDateFromMonth || movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                        matches = yearMatches && monthMatches && movementDate.getDate() === parseInt(cashDateFromDay);
                    }
                }
                
                if (cashDateFromHour && matches) {
                    const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                    const monthMatches = !cashDateFromMonth || movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                    const dayMatches = !cashDateFromDay || movementDate.getDate() === parseInt(cashDateFromDay);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches) {
                            matches = movementDate.getHours() >= parseInt(cashDateFromHour);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && movementDate.getHours() === parseInt(cashDateFromHour);
                    }
                }
                
                if (cashDateFromMinute && matches) {
                    const yearMatches = !cashDateFromYear || movementDate.getFullYear() === parseInt(cashDateFromYear);
                    const monthMatches = !cashDateFromMonth || movementDate.getMonth() === (parseInt(cashDateFromMonth) - 1);
                    const dayMatches = !cashDateFromDay || movementDate.getDate() === parseInt(cashDateFromDay);
                    const hourMatches = !cashDateFromHour || movementDate.getHours() === parseInt(cashDateFromHour);
                    
                    if (hasToFilters) {
                        if (yearMatches && monthMatches && dayMatches && hourMatches) {
                            matches = movementDate.getMinutes() >= parseInt(cashDateFromMinute);
                        }
                    } else {
                        matches = yearMatches && monthMatches && dayMatches && hourMatches && movementDate.getMinutes() === parseInt(cashDateFromMinute);
                    }
                }
                
                // Filtros "hasta" (solo se aplican si hay filtros "hasta" definidos)
                if (hasToFilters) {
                    if (cashDateToYear && matches) {
                        matches = movementDate.getFullYear() <= parseInt(cashDateToYear);
                    }
                    if (cashDateToMonth && matches) {
                        if (cashDateToYear) {
                            const yearMatches = movementDate.getFullYear() < parseInt(cashDateToYear);
                            const yearExact = movementDate.getFullYear() === parseInt(cashDateToYear);
                            matches = yearMatches || (yearExact && movementDate.getMonth() <= (parseInt(cashDateToMonth) - 1));
                        } else {
                            matches = movementDate.getMonth() <= (parseInt(cashDateToMonth) - 1);
                        }
                    }
                    if (cashDateToDay && matches) {
                        const exactYearMonth = (!cashDateToYear || movementDate.getFullYear() === parseInt(cashDateToYear)) && 
                                               (!cashDateToMonth || movementDate.getMonth() === (parseInt(cashDateToMonth) - 1));
                        if (exactYearMonth) {
                            matches = movementDate.getDate() <= parseInt(cashDateToDay);
                        }
                    }
                    if (cashDateToHour && matches) {
                        const exactDate = (!cashDateToYear || movementDate.getFullYear() === parseInt(cashDateToYear)) &&
                                          (!cashDateToMonth || movementDate.getMonth() === (parseInt(cashDateToMonth) - 1)) &&
                                          (!cashDateToDay || movementDate.getDate() === parseInt(cashDateToDay));
                        if (exactDate) {
                            matches = movementDate.getHours() <= parseInt(cashDateToHour);
                        }
                    }
                    if (cashDateToMinute && matches) {
                        const exactDateTime = (!cashDateToYear || movementDate.getFullYear() === parseInt(cashDateToYear)) &&
                                              (!cashDateToMonth || movementDate.getMonth() === (parseInt(cashDateToMonth) - 1)) &&
                                              (!cashDateToDay || movementDate.getDate() === parseInt(cashDateToDay)) &&
                                              (!cashDateToHour || movementDate.getHours() === parseInt(cashDateToHour));
                        if (exactDateTime) {
                            matches = movementDate.getMinutes() <= parseInt(cashDateToMinute);
                        }
                    }
                }
                
                return matches;
            });
        } else if (startDate && endDate) {
            // Filtro por fechas estándar (startDate/endDate) - solo si no hay filtros granulares
            filteredMovements = filteredMovements.filter(movement => {
                const movementDate = parseAnyDate(movement.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                }
                if (!movementDate || !start || !end) return false;
                return movementDate >= start && movementDate <= end;
            });
        }
        
        // 2. Filtro de ID (independiente)
        if (cashIdFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const movementId = Number(movement.id);
                const filterId = Number(cashIdFilter);
                
                switch (cashIdFilterOp) {
                    case 'equals':
                        return movementId === filterId;
                    case 'lt':
                        return movementId < filterId;
                    case 'lte':
                        return movementId <= filterId;
                    case 'gt':
                        return movementId > filterId;
                    case 'gte':
                        return movementId >= filterId;
                    default:
                        return movementId === filterId;
                }
            });
        }
        
        // 3. Filtro de monto (independiente)
        if (cashAmountFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const movementAmount = Number(movement.amount) || 0;
                const filterAmount = Number(cashAmountFilter) || 0;
                
                switch (cashAmountFilterOp) {
                    case 'equals':
                        return movementAmount === filterAmount;
                    case 'lt':
                        return movementAmount < filterAmount;
                    case 'lte':
                        return movementAmount <= filterAmount;
                    case 'gt':
                        return movementAmount > filterAmount;
                    case 'gte':
                        return movementAmount >= filterAmount;
                    default:
                        return movementAmount === filterAmount;
                }
            });
        }
        
        // 4. Filtro de descripción (independiente)
        if (cashDescriptionFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const description = String(movement.description || '').toLowerCase();
                const filterValue = cashDescriptionFilter.toLowerCase();
                
                switch (cashDescriptionFilterOp) {
                    case 'equals':
                        return description === filterValue;
                    case 'contains':
                        return description.includes(filterValue);
                    default:
                        return description.includes(filterValue);
                }
            });
        }
        
        // 5. Filtro de usuario (independiente)
        if (cashUserFilter.trim()) {
            filteredMovements = filteredMovements.filter(movement => {
                const user = String(movement.user || '').toLowerCase();
                const filterValue = cashUserFilter.toLowerCase();
                
                switch (cashUserFilterOp) {
                    case 'equals':
                        return user === filterValue;
                    case 'contains':
                        return user.includes(filterValue);
                    default:
                        return user.includes(filterValue);
                }
            });
        }
        
        // Filtro por tipo (Entrada/Salida)
        if (cashTypeFilter) {
            filteredMovements = filteredMovements.filter(movement => movement.type === cashTypeFilter);
        }
        
        // Filtro por método de pago (múltiple selección)
        if (cashPaymentMethodFilter.length > 0) {
            filteredMovements = filteredMovements.filter(movement => {
                const description = (movement.description || '').toLowerCase();
                // Verificar si alguno de los métodos seleccionados está en la descripción
                return cashPaymentMethodFilter.some(method => {
                    const methodLower = method.toLowerCase();
                    return description.includes(methodLower) || (movement.payment_method || '').toLowerCase().includes(methodLower);
                });
            });
        }

        // Ordenar los movimientos por fecha
        filteredMovements.sort((a, b) => {
            const dateA = parseAnyDate(a.date);
            const dateB = parseAnyDate(b.date);
            
            if (!dateA || !dateB) {
                // Si alguna fecha no es válida, mantener el orden original
                return 0;
            }
            
            if (cashSortOrder === 'desc') {
                // Descendente: más nuevos primero (fechas más recientes primero)
                return dateB.getTime() - dateA.getTime();
            } else {
                // Ascendente: más antiguos primero (fechas más antiguas primero)
                return dateA.getTime() - dateB.getTime();
            }
        });

        const totalIncome = filteredMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : 0), 0);
        const totalExpenses = filteredMovements.reduce((sum, m) => sum + (m.type === 'Salida' ? m.amount : 0), 0);
        const results = { 
            title: 'Reporte de Movimientos de Caja', 
            summary: { 
                totalMovements: filteredMovements.length, 
                totalIncome: safeToFixed(totalIncome), 
                totalExpenses: safeToFixed(totalExpenses),
                period: (cashDateFromYear || cashDateToYear) 
                    ? `Filtro personalizado por fechas` 
                    : startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos'
            }, 
            data: filteredMovements.map(movement => ({ id: movement.id, date: movement.date, type: movement.type, amount: movement.amount, description: movement.description, user: movement.user, payment_method: movement.payment_method })) 
        };
        
        setQueryResults(results);
        return results;
    };

    const exportData = async () => {
        if (!queryResults) { setMessage('🚫 Error: No hay datos para exportar.'); return; }
        try {
            const token = getInMemoryToken && getInMemoryToken();
            const response = await fetch('/api/export-data/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : undefined }, body: JSON.stringify({ query_type: selectedQuery, data: queryResults.data, summary: queryResults.summary }) });
            if (!response.ok) { setMessage('🚫 Error al exportar PDF.'); return; }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${selectedQuery}_reporte.pdf`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url); setMessage('✅ PDF exportado correctamente.');
        } catch (error) { setMessage('🚫 Error al exportar PDF.'); }
    };

    const executeQuery = async () => {
        if (!selectedQuery) { setMessage('🚫 Debe seleccionar un tipo de consulta.'); return; }
        if (startDate && endDate) { const start = parseAnyDate(startDate); const end = parseAnyDate(endDate); if (start > end) { setMessage('🚫 Error: La fecha de inicio no puede ser posterior a la fecha de fin.'); return; } }
        setMessage(''); setIsLoading(true); isRunningQueryRef.current = true;
        try {
            let results = null;
            switch (selectedQuery) {
                case 'stock': results = await executeStockQuery(); break;
                case 'proveedores': results = await executeSuppliersQuery(); break;
                case 'ventas': results = await executeSalesQuery(); break;
                case 'compras': results = await executePurchasesQuery(); break;
                case 'pedidos': results = await executeOrdersQuery(); break;
                case 'movimientos_caja': results = await executeCashMovementsQuery(); break;
                default: setMessage('🚫 Error: Tipo de consulta no válido.'); return;
            }
            if (results) {
                setQueryResults(results);
                try { await saveQueryToBackend(selectedQuery, startDate, endDate, results); } catch (e) { /* No se pudo guardar la consulta en backend, pero los resultados se muestran localmente */ }
                setQueryResults(results);
            }
        } catch (error) { setMessage('🚫 Error ejecutando la consulta: ' + (error.message || error)); }
        finally { setIsLoading(false); isRunningQueryRef.current = false; }
    };

    return (
        <div className="management-container">
            <h2>Consultar Datos</h2>
            {message && <p className="message">{message}</p>}
            <div className="query-form">
                <h3>Seleccionar Consulta</h3>
                <select value={selectedQuery} onChange={e => setSelectedQuery(e.target.value)} className="query-select">
                    <option value="">Seleccionar tipo de consulta</option>
                    <option value="stock">Estado de Stock</option>
                    <option value="proveedores">Información de Proveedores</option>
                    <option value="ventas">Reporte de Ventas</option>
                    <option value="compras">Reporte de Compras</option>
                    <option value="pedidos">Reporte de Pedidos</option>
                    <option value="movimientos_caja">Movimientos de Caja</option>
                </select>
                <div className="date-filters">
                    <div className="date-input">
                        <label>Fecha de inicio:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="date-input">
                        <label>Fecha de fin:</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                </div>
                {selectedQuery === 'stock' && (
                    <div className="stock-filters">
                        <h4>Filtros de Stock</h4>
                        
                        {/* Filtro por ID */}
                        <div className="filter-row">
                            <label>ID del Producto:</label>
                            <select value={stockIdFilterOp} 
                                    onChange={e => setStockIdFilterOp(e.target.value)}
                                    style={{padding: '8px', marginLeft: '10px', marginRight: '5px'}}>
                                <option value="equals">=</option>
                                <option value="greater">&gt;</option>
                                <option value="greaterOrEqual">&gt;=</option>
                                <option value="less">&lt;</option>
                                <option value="lessOrEqual">&lt;=</option>
                            </select>
                            <input type="text" value={stockIdFilter} 
                                   onChange={e => setStockIdFilter(e.target.value)} 
                                   placeholder="ID del producto" 
                                   style={{flex: 1, padding: '8px'}} />
                        </div>

                        {/* Filtro por Nombre */}
                        <div className="filter-row">
                            <label>Nombre del Producto / Insumo:</label>
                            <input type="text" value={stockNameFilter}
                                   onChange={e => setStockNameFilter(e.target.value)}
                                   placeholder="Buscar por nombre..." 
                                   style={{flex: 1, padding: '8px', marginLeft: '10px'}} />
                        </div>

                        {/* Filtro por Cantidad/Stock */}
                        <div className="filter-row">
                            <label>Cantidad en Stock:</label>
                            <select value={stockQuantityOp} onChange={e => setStockQuantityOp(e.target.value)} style={{minWidth: '80px'}}>
                                <option value="equals">Es igual</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                            </select>
                            <input type="number" value={stockQuantityFilter}
                                   onChange={e => setStockQuantityFilter(e.target.value)}
                                   placeholder="Cantidad..." 
                                   style={{width: '120px', padding: '8px', marginLeft: '10px'}} />
                            <select value={stockQuantityUnit} onChange={e => setStockQuantityUnit(e.target.value)} style={{minWidth: '60px', marginLeft: '10px'}}>
                                <option value="Kg">Kg</option>
                                <option value="L">L</option>
                                <option value="U">U</option>
                            </select>
                        </div>

                        {/* Filtro por Precio */}
                        <div className="filter-row">
                            <label>Precio:</label>
                            <select value={stockPriceOp} onChange={e => setStockPriceOp(e.target.value)} style={{minWidth: '80px'}}>
                                <option value="equals">Es igual</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                            </select>
                            <input type="number" value={stockPriceFilter}
                                   onChange={e => setStockPriceFilter(e.target.value)}
                                   placeholder="Precio..." 
                                   step="0.01"
                                   style={{flex: 1, padding: '8px', marginLeft: '10px'}} />
                        </div>

                        {/* Filtro por Tipo */}
                        <div className="filter-row">
                            <label>Tipo de Producto:</label>
                            <select value={stockTypeFilter} onChange={e => setStockTypeFilter(e.target.value)} style={{flex: 1, padding: '8px', marginLeft: '10px'}}>
                                <option value="">-- Todos los tipos --</option>
                                <option value="Producto">Producto</option>
                                <option value="Insumo">Insumo</option>
                            </select>
                        </div>

                        {/* Filtro por Estado (checkboxes múltiples) */}
                        <div className="filter-row">
                            <label>Estado del Stock:</label>
                            <div className="status-checkboxes" style={{display: 'flex', gap: '15px', marginLeft: '10px', flexWrap: 'wrap'}}>
                                <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                    <input type="checkbox" 
                                           checked={stockStatusFilter.includes('Stock Alto')} 
                                           onChange={e => {
                                               const checked = e.target.checked;
                                               setStockStatusFilter(prev => checked ? Array.from(new Set([...prev, 'Stock Alto'])) : prev.filter(x => x !== 'Stock Alto'))
                                           }} />
                                    Stock Alto
                                </label>
                                <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                    <input type="checkbox" 
                                           checked={stockStatusFilter.includes('Stock Medio')} 
                                           onChange={e => {
                                               const checked = e.target.checked;
                                               setStockStatusFilter(prev => checked ? Array.from(new Set([...prev, 'Stock Medio'])) : prev.filter(x => x !== 'Stock Medio'))
                                           }} />
                                    Stock Medio
                                </label>
                                <label style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                    <input type="checkbox" 
                                           checked={stockStatusFilter.includes('Stock Bajo')} 
                                           onChange={e => {
                                               const checked = e.target.checked;
                                               setStockStatusFilter(prev => checked ? Array.from(new Set([...prev, 'Stock Bajo'])) : prev.filter(x => x !== 'Stock Bajo'))
                                           }} />
                                    Stock Bajo
                                </label>
                            </div>
                        </div>
                    </div>
                )}
                
                {selectedQuery === 'ventas' && (
                    <div className="sales-filters">
                        <h4>Filtros de Ventas</h4>
                        
                        {/* Filtro por ID */}
                        <div className="filter-row">
                            <label>ID de Venta:</label>
                            <select value={salesIdFilterOp} 
                                    onChange={e => setSalesIdFilterOp(e.target.value)}
                                    style={{padding: '8px', marginLeft: '10px', marginRight: '5px'}}>
                                <option value="equals">=</option>
                                <option value="greater">&gt;</option>
                                <option value="greaterOrEqual">&gt;=</option>
                                <option value="less">&lt;</option>
                                <option value="lessOrEqual">&lt;=</option>
                            </select>
                            <input type="text" value={salesIdFilter} 
                                   onChange={e => setSalesIdFilter(e.target.value)} 
                                   placeholder="ID de la venta" 
                                   style={{flex: 1, padding: '8px'}} />
                        </div>

                        {/* Filtro por fechas granular */}
                        <div className="filter-row"> 
                         { // <label>Filtro por fechas (opcional):</label> 
                         }
                            <div className="granular-date-filters">
                                <p style={{margin: '0 0 10px', fontSize: '14px', color: '#6c757d', fontStyle: 'italic'}}>
                                    💡 <strong>Filtro inteligente:</strong> Puedes filtrar por cualquier combinación de componentes de fecha.
                                </p>
                                <h5>Desde:</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={salesDateFromYear} onChange={e => setSalesDateFromYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={salesDateFromMonth} onChange={e => setSalesDateFromMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={salesDateFromDay} onChange={e => setSalesDateFromDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={salesDateFromHour} onChange={e => setSalesDateFromHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={salesDateFromMinute} onChange={e => setSalesDateFromMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                                
                                <h5>Hasta (opcional):</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={salesDateToYear} onChange={e => setSalesDateToYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={salesDateToMonth} onChange={e => setSalesDateToMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={salesDateToDay} onChange={e => setSalesDateToDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={salesDateToHour} onChange={e => setSalesDateToHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={salesDateToMinute} onChange={e => setSalesDateToMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                            </div>
                        </div>

                        {/* Filtro por Producto */}
                        <div className="filter-row">
                            <label>Producto:</label>
                            <input type="text" value={salesProductFilter}
                                   onChange={e => setSalesProductFilter(e.target.value)}
                                   placeholder="Buscar por nombre de producto..." 
                                   style={{flex: 1, padding: '8px', marginLeft: '10px'}} />
                        </div>

                        {/* Filtro por Usuario */}
                        <div className="filter-row">
                            <label>Usuario:</label>
                            <input type="text" value={salesUserFilter}
                                   onChange={e => setSalesUserFilter(e.target.value)}
                                   placeholder="Buscar por usuario..." 
                                   style={{flex: 1, padding: '8px', marginLeft: '10px'}} />
                        </div>

                        {/* Filtro por Total */}
                        <div className="filter-row">
                            <label>Total:</label>
                            <select value={salesTotalOp} onChange={e => setSalesTotalOp(e.target.value)} style={{minWidth: '80px'}}>
                                <option value="equals">Es igual</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                            </select>
                            <input type="number" value={salesTotalFilter}
                                   onChange={e => setSalesTotalFilter(e.target.value)}
                                   placeholder="Monto total..." 
                                   style={{flex: 1, padding: '8px', marginLeft: '10px'}} />
                        </div>

                        {/* Filtro por Cantidad */}
                        <div className="filter-row">
                            <label>Cantidad:</label>
                            <select value={salesQuantityOp} onChange={e => setSalesQuantityOp(e.target.value)} style={{minWidth: '80px'}}>
                                <option value="equals">Es igual</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                            </select>
                            <input type="number" value={salesQuantityFilter}
                                   onChange={e => setSalesQuantityFilter(e.target.value)}
                                   placeholder="Cantidad vendida..." 
                                   style={{flex: 1, padding: '8px', marginLeft: '10px'}} />
                        </div>
                    </div>
                )}
                
                {selectedQuery === 'movimientos_caja' && (
                    <div className="cash-filters">
                        <h4>Filtros de Movimientos de Caja</h4>
                        
                        {/* Filtro de ID */}
                        <div className="filter-row">
                            <label>ID:</label>
                            <select value={cashIdFilterOp} onChange={e => setCashIdFilterOp(e.target.value)}>
                                <option value="equals">Es igual</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                            </select>
                            <input 
                                type="number" 
                                value={cashIdFilter} 
                                onChange={e => setCashIdFilter(e.target.value)} 
                                placeholder="ID del movimiento..." 
                            />
                        </div>

                        {/* Filtro de Monto */}
                        <div className="filter-row">
                            <label>Monto:</label>
                            <select value={cashAmountFilterOp} onChange={e => setCashAmountFilterOp(e.target.value)}>
                                <option value="equals">Es igual</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                            </select>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={cashAmountFilter} 
                                onChange={e => setCashAmountFilter(e.target.value)} 
                                placeholder="Monto del movimiento..." 
                            />
                        </div>

                        {/* Filtro de Descripción */}
                        <div className="filter-row">
                            <label>Descripción:</label>
                            <select value={cashDescriptionFilterOp} onChange={e => setCashDescriptionFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={cashDescriptionFilter} 
                                onChange={e => setCashDescriptionFilter(e.target.value)} 
                                placeholder="Descripción del movimiento..." 
                            />
                        </div>

                        {/* Filtro de Usuario */}
                        <div className="filter-row">
                            <label>Usuario:</label>
                            <select value={cashUserFilterOp} onChange={e => setCashUserFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={cashUserFilter} 
                                onChange={e => setCashUserFilter(e.target.value)} 
                                placeholder="Nombre del usuario..." 
                            />
                        </div>

                        {/* Filtros de fecha granular */}
                        <div className="filter-row">
                            <label>Fecha (granular):</label>
                            <div className="granular-date-filters">
                                <p style={{margin: '0 0 10px', fontSize: '14px', color: '#6c757d', fontStyle: 'italic'}}>
                                    💡 <strong>Filtro inteligente:</strong> Si completas solo "Desde", filtra exactamente ese período (ej: Mes 11 = solo noviembre). Si completas "Hasta", filtra como rango.
                                </p>
                                <h5>Desde:</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={cashDateFromYear} onChange={e => setCashDateFromYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={cashDateFromMonth} onChange={e => setCashDateFromMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={cashDateFromDay} onChange={e => setCashDateFromDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={cashDateFromHour} onChange={e => setCashDateFromHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={cashDateFromMinute} onChange={e => setCashDateFromMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                                
                                <h5>Hasta (opcional):</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={cashDateToYear} onChange={e => setCashDateToYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={cashDateToMonth} onChange={e => setCashDateToMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={cashDateToDay} onChange={e => setCashDateToDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={cashDateToHour} onChange={e => setCashDateToHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={cashDateToMinute} onChange={e => setCashDateToMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                            </div>
                        </div>
                        
                        {/* Filtro de Tipo (Entrada/Salida) */}
                        <div className="filter-row">
                            <label>Tipo:</label>
                            <select value={cashTypeFilter} onChange={e => setCashTypeFilter(e.target.value)}>
                                <option value="">-- Todos --</option>
                                <option value="Entrada">Entrada</option>
                                <option value="Salida">Salida</option>
                            </select>
                        </div>
                        
                        {/* Filtro de Método de Pago (múltiple selección) */}
                        <div className="filter-row">
                            <label>Métodos de Pago:</label>
                            <div className="payment-method-checkboxes">
                                {['debito', 'credito', 'transferencia', 'efectivo'].map(method => (
                                    <label key={method}>
                                        <input 
                                            type="checkbox" 
                                            checked={cashPaymentMethodFilter.includes(method)} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setCashPaymentMethodFilter(prev => 
                                                    checked 
                                                        ? Array.from(new Set([...prev, method])) 
                                                        : prev.filter(x => x !== method)
                                                );
                                            }} 
                                        />
                                        {method.charAt(0).toUpperCase() + method.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        {/* Ordenamiento */}
                        <div className="filter-row">
                            <label>Ordenar por fecha:</label>
                            <select value={cashSortOrder} onChange={e => setCashSortOrder(e.target.value)} style={{minWidth: '150px'}}>
                                <option value="desc">Más recientes primero</option>
                                <option value="asc">Más antiguos primero</option>
                            </select>
                        </div>
                    </div>
                )}
                
                {selectedQuery === 'pedidos' && (
                    <div className="orders-filters">
                        <h4>Filtros de Pedidos</h4>
                        
                        {/* Filtro de ID */}
                        <div className="filter-row">
                            <label>ID:</label>
                            <select value={ordersIdFilterOp} onChange={e => setOrdersIdFilterOp(e.target.value)}>
                                <option value="equals">Es igual</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                            </select>
                            <input 
                                type="number" 
                                value={ordersIdFilter} 
                                onChange={e => setOrdersIdFilter(e.target.value)} 
                                placeholder="ID del pedido..." 
                            />
                        </div>

                        {/* Filtro de Cliente */}
                        <div className="filter-row">
                            <label>Cliente:</label>
                            <select value={ordersCustomerFilterOp} onChange={e => setOrdersCustomerFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={ordersCustomerFilter} 
                                onChange={e => setOrdersCustomerFilter(e.target.value)} 
                                placeholder="Nombre del cliente..." 
                            />
                        </div>

                        {/* Filtros de fecha granular */}
                        <div className="filter-row">
                            <label>Fecha (granular):</label>
                            <div className="granular-date-filters">
                                <p style={{margin: '0 0 10px', fontSize: '14px', color: '#6c757d', fontStyle: 'italic'}}>
                                    💡 <strong>Filtro inteligente:</strong> Si completas solo "Desde", filtra exactamente ese período (ej: Mes 11 = solo noviembre). Si completas "Hasta", filtra como rango.
                                </p>
                                <h5>Desde:</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={ordersDateFromYear} onChange={e => setOrdersDateFromYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={ordersDateFromMonth} onChange={e => setOrdersDateFromMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={ordersDateFromDay} onChange={e => setOrdersDateFromDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={ordersDateFromHour} onChange={e => setOrdersDateFromHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={ordersDateFromMinute} onChange={e => setOrdersDateFromMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                                
                                <h5>Hasta (opcional):</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={ordersDateToYear} onChange={e => setOrdersDateToYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={ordersDateToMonth} onChange={e => setOrdersDateToMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={ordersDateToDay} onChange={e => setOrdersDateToDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={ordersDateToHour} onChange={e => setOrdersDateToHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={ordersDateToMinute} onChange={e => setOrdersDateToMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                            </div>
                        </div>
                        
                        {/* Filtro de Método de Pago (múltiple selección) */}
                        <div className="filter-row">
                            <label>Métodos de Pago:</label>
                            <div className="payment-method-checkboxes">
                                {['debito', 'credito', 'transferencia', 'efectivo'].map(method => (
                                    <label key={method}>
                                        <input 
                                            type="checkbox" 
                                            checked={ordersPaymentMethodFilter.includes(method)} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setOrdersPaymentMethodFilter(prev => 
                                                    checked 
                                                        ? Array.from(new Set([...prev, method])) 
                                                        : prev.filter(x => x !== method)
                                                );
                                            }} 
                                        />
                                        {method.charAt(0).toUpperCase() + method.slice(1)}
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        {/* Filtro de Estado (múltiple selección) */}
                        <div className="filter-row">
                            <label>Estados:</label>
                            <div className="status-checkboxes">
                                {['Pendiente', 'En Preparación', 'Listo', 'Entregado', 'Cancelado'].map(status => (
                                    <label key={status}>
                                        <input 
                                            type="checkbox" 
                                            checked={ordersStatusFilter.includes(status)} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setOrdersStatusFilter(prev => 
                                                    checked 
                                                        ? Array.from(new Set([...prev, status])) 
                                                        : prev.filter(x => x !== status)
                                                );
                            }} 
                                        />
                                        {status}
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        {/* Filtro de búsqueda por nombre de Producto */}
                        <div className="filter-row">
                            <label>Buscar Producto:</label>
                            <input 
                                type="text" 
                                value={ordersProductFilter} 
                                onChange={e => setOrdersProductFilter(e.target.value)} 
                                placeholder="Nombre del producto..." 
                                style={{flex: 1, padding: '8px', marginLeft: '10px'}}
                            />
                        </div>
                        
                        {/* Filtro por Unidades/Cantidad */}
                        <div className="filter-row">
                            <label>Unidades:</label>
                            <select value={ordersUnitsFilterOp} 
                                    onChange={e => setOrdersUnitsFilterOp(e.target.value)}
                                    style={{padding: '8px', marginLeft: '10px', marginRight: '5px'}}>
                                <option value="equals">=</option>
                                <option value="greater">&gt;</option>
                                <option value="greaterOrEqual">&gt;=</option>
                                <option value="less">&lt;</option>
                                <option value="lessOrEqual">&lt;=</option>
                            </select>
                            <input 
                                type="number" 
                                value={ordersUnitsFilter} 
                                onChange={e => setOrdersUnitsFilter(e.target.value)} 
                                placeholder="Cantidad..." 
                                style={{flex: 1, padding: '8px'}}
                            />
                        </div>
                    </div>
                )}
                
                {selectedQuery === 'compras' && (
                    <div className="purchases-filters">
                        <h4>Filtros de Compras</h4>
                        
                        {/* Filtro de ID */}
                        <div className="filter-row">
                            <label>ID:</label>
                            <select value={purchasesIdFilterOp} onChange={e => setPurchasesIdFilterOp(e.target.value)}>
                                <option value="equals">Es igual</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                            </select>
                            <input 
                                type="number" 
                                value={purchasesIdFilter} 
                                onChange={e => setPurchasesIdFilter(e.target.value)} 
                                placeholder="ID de compra..." 
                            />
                        </div>

                        {/* Filtro de Proveedor */}
                        <div className="filter-row">
                            <label>Proveedor:</label>
                            <select value={purchasesSupplierFilterOp} onChange={e => setPurchasesSupplierFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={purchasesSupplierFilter} 
                                onChange={e => setPurchasesSupplierFilter(e.target.value)} 
                                placeholder="Nombre del proveedor..." 
                            />
                        </div>

                        {/* Filtro de Total */}
                        <div className="filter-row">
                            <label>Total:</label>
                            <select value={purchasesTotalFilterOp} onChange={e => setPurchasesTotalFilterOp(e.target.value)}>
                                <option value="equals">Es igual</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                            </select>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={purchasesTotalFilter} 
                                onChange={e => setPurchasesTotalFilter(e.target.value)} 
                                placeholder="Monto total..." 
                            />
                        </div>

                        {/* Filtros de fecha granular */}
                        <div className="filter-row">
                            <label>Fecha (granular):</label>
                            <div className="granular-date-filters">
                                <p style={{margin: '0 0 10px', fontSize: '14px', color: '#6c757d', fontStyle: 'italic'}}>
                                    💡 <strong>Filtro flexible:</strong> Cada campo funciona independientemente. Ej: Solo "Mes 11" = todas las compras de noviembre. "Año 2024 + Mes 11" = solo noviembre 2024. Combina los que necesites.
                                </p>
                                <h5>Desde (opcional):</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={purchasesDateFromYear} onChange={e => setPurchasesDateFromYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={purchasesDateFromMonth} onChange={e => setPurchasesDateFromMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={purchasesDateFromDay} onChange={e => setPurchasesDateFromDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={purchasesDateFromHour} onChange={e => setPurchasesDateFromHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={purchasesDateFromMinute} onChange={e => setPurchasesDateFromMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                                
                                <h5>Hasta (opcional):</h5>
                                <div className="date-components" style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Año:</label>
                                    <input type="number" placeholder="Ej: 2024" min="2020" max="2030" 
                                           value={purchasesDateToYear} onChange={e => setPurchasesDateToYear(e.target.value)} 
                                           style={{padding: '6px 8px', width: '80px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Mes:</label>
                                    <input type="number" placeholder="1-12" min="1" max="12" 
                                           value={purchasesDateToMonth} onChange={e => setPurchasesDateToMonth(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '35px', fontWeight: '500'}}>Día:</label>
                                    <input type="number" placeholder="1-31" min="1" max="31" 
                                           value={purchasesDateToDay} onChange={e => setPurchasesDateToDay(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '40px', fontWeight: '500'}}>Hora:</label>
                                    <input type="number" placeholder="0-23" min="0" max="23" 
                                           value={purchasesDateToHour} onChange={e => setPurchasesDateToHour(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                    <label style={{margin: '0', minWidth: '30px', fontWeight: '500'}}>Min:</label>
                                    <input type="number" placeholder="0-59" min="0" max="59" 
                                           value={purchasesDateToMinute} onChange={e => setPurchasesDateToMinute(e.target.value)} 
                                           style={{padding: '6px 8px', width: '60px', margin: '0'}} />
                                </div>
                            </div>
                        </div>
                        
                        {/* Filtro de Tipos (Producto/Insumo) */}
                        <div className="filter-row">
                            <label>Tipos:</label>
                            <div className="type-checkboxes" style={{display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px'}}>
                                {['Producto', 'Insumo'].map(type => (
                                    <label key={type} style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                        <input 
                                            type="checkbox" 
                                            checked={purchasesTypeFilter.includes(type)} 
                                            onChange={e => {
                                                const checked = e.target.checked;
                                                setPurchasesTypeFilter(prev => 
                                                    checked 
                                                        ? Array.from(new Set([...prev, type])) 
                                                        : prev.filter(x => x !== type)
                                                );
                                            }} 
                                        />
                                        {type}
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        {/* Filtro de búsqueda por nombre de Producto/Insumo */}
                        <div className="filter-row">
                            <label>Buscar Producto/Insumo:</label>
                            <input 
                                type="text" 
                                value={purchasesProductFilter} 
                                onChange={e => setPurchasesProductFilter(e.target.value)} 
                                placeholder="Nombre del producto o insumo..." 
                                style={{flex: 1, padding: '8px', marginLeft: '10px'}}
                            />
                        </div>
                        
                        {/* Filtro de cantidad */}
                        <div className="filter-row">
                            <label>Cantidad:</label>
                            <select value={purchasesQuantityFilterOp} 
                                    onChange={e => setPurchasesQuantityFilterOp(e.target.value)}
                                    style={{padding: '8px', marginLeft: '10px', marginRight: '5px', minWidth: '80px'}}>
                                <option value="equals">=</option>
                                <option value="greater">&gt;</option>
                                <option value="greaterOrEqual">&gt;=</option>
                                <option value="less">&lt;</option>
                                <option value="lessOrEqual">&lt;=</option>
                            </select>
                            <input 
                                type="number" 
                                value={purchasesQuantityFilter} 
                                onChange={e => setPurchasesQuantityFilter(e.target.value)} 
                                placeholder="Cantidad..." 
                                style={{width: '120px', padding: '8px'}}
                            />
                            <select value={purchasesQuantityUnit} 
                                    onChange={e => setPurchasesQuantityUnit(e.target.value)} 
                                    style={{minWidth: '60px', marginLeft: '10px', padding: '8px'}}>
                                <option value="Kg">Kg</option>
                                <option value="L">L</option>
                                <option value="U">U</option>
                            </select>
                        </div>
                    </div>
                )}
                
                {selectedQuery === 'proveedores' && (
                    <div className="suppliers-filters">
                        <h4>Filtros de Proveedores</h4>
                        
                        {/* Filtro de ID */}
                        <div className="filter-row">
                            <label>ID:</label>
                            <select value={suppliersIdFilterOp} onChange={e => setSuppliersIdFilterOp(e.target.value)}>
                                <option value="equals">Es igual</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                            </select>
                            <input 
                                type="number" 
                                value={suppliersIdFilter} 
                                onChange={e => setSuppliersIdFilter(e.target.value)} 
                                placeholder="ID del proveedor..." 
                            />
                        </div>

                        {/* Filtro de Nombre */}
                        <div className="filter-row">
                            <label>Nombre:</label>
                            <select value={suppliersNameFilterOp} onChange={e => setSuppliersNameFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersNameFilter} 
                                onChange={e => setSuppliersNameFilter(e.target.value)} 
                                placeholder="Nombre del proveedor..." 
                            />
                        </div>

                        {/* Filtro de CUIT */}
                        <div className="filter-row">
                            <label>CUIT:</label>
                            <select value={suppliersCuitFilterOp} onChange={e => setSuppliersCuitFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersCuitFilter} 
                                onChange={e => setSuppliersCuitFilter(e.target.value)} 
                                placeholder="CUIT del proveedor..." 
                            />
                        </div>

                        {/* Filtro de Teléfono */}
                        <div className="filter-row">
                            <label>Teléfono:</label>
                            <select value={suppliersPhoneFilterOp} onChange={e => setSuppliersPhoneFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersPhoneFilter} 
                                onChange={e => setSuppliersPhoneFilter(e.target.value)} 
                                placeholder="Teléfono del proveedor..." 
                            />
                        </div>

                        {/* Filtro de Dirección */}
                        <div className="filter-row">
                            <label>Dirección:</label>
                            <select value={suppliersAddressFilterOp} onChange={e => setSuppliersAddressFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersAddressFilter} 
                                onChange={e => setSuppliersAddressFilter(e.target.value)} 
                                placeholder="Dirección del proveedor..." 
                            />
                        </div>

                        {/* Filtro de Producto/Insumo */}
                        <div className="filter-row">
                            <label>Producto/Insumo:</label>
                            <select value={suppliersProductFilterOp} onChange={e => setSuppliersProductFilterOp(e.target.value)}>
                                <option value="contains">Contiene</option>
                                <option value="equals">Es igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersProductFilter} 
                                onChange={e => setSuppliersProductFilter(e.target.value)} 
                                placeholder="Producto o insumo..." 
                            />
                        </div>
                    </div>
                )}
                
                <div className="query-actions">
                    <button onClick={executeQuery} className="action-button primary">Ejecutar Consulta</button>
                    <button onClick={exportData} className="action-button secondary" id='Exportar-datos' disabled={!queryResults}>Exportar Datos</button>
                </div>
            </div>
            {queryResults && (
                <div className="query-results">
                    <h3>{queryResults.title}</h3>
                    <div className="results-summary">
                        {Object.entries(queryResults.summary).map(([key, value]) => {
                            // Manejo especial para objetos anidados como byType
                            if (key === 'byType' && typeof value === 'object' && value !== null) {
                                return (
                                    <div key={key} className="summary-item">
                                        <strong>Por Tipo:</strong>
                                        <div style={{marginLeft: '15px', marginTop: '5px'}}>
                                            {Object.entries(value).map(([typeKey, typeValue]) => (
                                                <div key={typeKey} style={{fontSize: '14px'}}>
                                                    • {typeKey}: {typeof typeValue === 'number' ? typeValue.toLocaleString() : typeValue}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            
                            return (
                                <div key={key} className="summary-item">
                                    <strong>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {
                                        typeof value === 'number' ? value.toLocaleString() : value
                                    }
                                </div>
                            );
                        })}
                    </div>
                    <div className="results-table">
                        {queryResults.data && queryResults.data.length > 0 ? (
                            (() => {
                                const renderCellValue = (value, key) => {
                                    if (value === null || value === undefined) return '';
                                    // Formatear columnas de fecha de forma consistente
                                    if (key === 'date') {
                                        try { return formatMovementDate(value); } catch (e) { /* fallback below */ }
                                    }
                                    if (Array.isArray(value)) {
                                        if (value.length === 0) return '';
                                        if (value.every(v => v === null || ['string','number','boolean'].includes(typeof v))) return value.filter(v => v !== null && v !== undefined).join(', ');
                                        return value.map(item => {
                                            if (item === null || item === undefined) return '';
                                            if (typeof item === 'string' || typeof item === 'number') return String(item);
                                            const name = item.productName || item.product_name || item.product || item.name || item.productName;
                                            const qty = item.quantity ?? item.cantidad ?? item.qty ?? '';
                                            const unit = item.unitPrice ?? item.unit_price ?? item.price ?? '';
                                            const total = item.total ?? item.totalAmount ?? item.total_amount ?? '';
                                            const parts = [];
                                            if (name) parts.push(String(name));
                                            if (qty !== '') parts.push(String(qty));
                                            if (unit !== '') parts.push(`x ${safeToFixed(unit)}`);
                                            if (total !== '') parts.push(`= ${safeToFixed(total)}`);
                                            return parts.join(' ');
                                        }).filter(Boolean).join('; ');
                                    }
                                    if (typeof value === 'object') {
                                        const name = value.productName || value.product_name || value.name;
                                        if (name) {
                                            const qty = value.quantity ?? value.cantidad ?? value.qty ?? '';
                                            const unit = value.unitPrice ?? value.unit_price ?? value.price ?? '';
                                            const total = value.total ?? value.totalAmount ?? value.total_amount ?? '';
                                            const parts = [String(name)];
                                            if (qty !== '') parts.push(String(qty));
                                            if (unit !== '') parts.push(`x ${safeToFixed(unit)}`);
                                            if (total !== '') parts.push(`= ${safeToFixed(total)}`);
                                            return parts.join(' ');
                                        }
                                        try { return JSON.stringify(value); } catch (e) { return String(value); }
                                    }
                                    return String(value);
                                };
                                const sample = queryResults.data[0] || {};
                                if (sample.customerName || sample.customer_name) {
                                    const cols = ['id','date','customerName','paymentMethod','status','products','units'];
                                    return (
                                        <table>
                                            <thead><tr>{cols.map(key=> <th key={key}>{headerTranslationMap[key] || key}</th>)}</tr></thead>
                                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{renderCellValue(row[k] ?? row[k === 'products' ? 'items' : k], k)}</td>))}</tr>))}</tbody>
                                        </table>
                                    );
                                }
                                if (selectedQuery === 'ventas' || (sample.product && sample.quantity !== undefined && sample.total !== undefined)) {
                                    const cols = ['id','date','product','quantity','total','user'];
                                    return (
                                        <table>
                                            <thead><tr>{cols.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{renderCellValue(row[k], k)}</td>))}</tr>))}</tbody>
                                        </table>
                                    );
                                }
                                if (selectedQuery === 'movimientos_caja') {
                                    const cols = ['id', 'date', 'type', 'amount', 'payment_method', 'description', 'user'];
                                    return (
                                        <table>
                                            <thead><tr>{cols.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{renderCellValue(row[k], k)}</td>))}</tr>))}</tbody>
                                        </table>
                                    );
                                }
                if (selectedQuery === 'compras') {
                    const cols = ['id', 'date', 'supplier', 'type', 'items', 'total'];
                    const renderCompraItems = (items) => {
                        if (Array.isArray(items)) {
                            return items.map(item => {
                                if (typeof item === 'object' && item.productName) {
                                    const productName = item.productName || item.product_name || item.name || '';
                                    const quantity = item.quantity || 0;
                                    
                                    if (!productName) return '';
                                    
                                    // Buscar el producto en inventory para obtener su unidad
                                    const foundProduct = inventory.find(p => 
                                        p && p.name && p.name.toLowerCase() === productName.toLowerCase()
                                    );
                                    
                                    if (foundProduct && quantity > 0) {
                                        const unit = foundProduct.unit;
                                        if (unit === 'g') {
                                            return `${productName} ${quantity}Kg`;
                                        } else if (unit === 'ml') {
                                            return `${productName} ${quantity}L`;
                                        } else {
                                            return `${productName} ${quantity}U`;
                                        }
                                    } else if (quantity > 0) {
                                        return `${productName} ${quantity}U`;
                                    } else {
                                        return productName;
                                    }
                                } else {
                                    return String(item || '');
                                }
                            }).filter(Boolean).join(', ');
                        }
                        return String(items || '');
                    };
                    return (
                        <table>
                            <thead><tr>{cols.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{k === 'items' ? renderCompraItems(row[k]) : renderCellValue(row[k], k)}</td>))}</tr>))}</tbody>
                        </table>
                    );
                }                                const keys = Object.keys(sample);
                                return (
                                    <table>
                                        <thead><tr>{keys.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                                        <tbody>{queryResults.data.map((row, rIdx) => (<tr key={rIdx}>{keys.map((k, cIdx) => (<td key={cIdx}>{renderCellValue(row[k], k)}</td>))}</tr>))}</tbody>
                                    </table>
                                );
                            })()
                        ) : (
                            <p>No hay datos que mostrar para los criterios seleccionados.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}