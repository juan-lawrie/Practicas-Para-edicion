import React, { useState, useEffect } from 'react';
import { api } from './services/api';

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
                console.log('No hay ninguna consulta guardada para este usuario.');
            } else {
                console.warn('Error cargando consulta activa (no se limpiarán resultados):', error?.response?.data || error?.message || error);
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
                try { const patchResp = await api.patch(`/user-queries/${id}/`, payload); if (patchResp?.data) return; } catch (patchErr) { console.warn('⚠️ Error parchando consulta existente, fallback a POST', patchErr?.message || patchErr); }
            }
            const postResp = await api.post('/user-queries/', payload);
            if (postResp?.data) return;
        } catch (error) {
            console.warn('Advertencia al guardar consulta, intentando recuperación:', error?.response?.data || error?.message || error);
            try {
                const listResp2 = await api.get(`/user-queries/?query_type=${encodeURIComponent(queryType)}`);
                const items2 = Array.isArray(listResp2.data) ? listResp2.data : (listResp2.data?.results || []);
                if (items2 && items2.length > 0) {
                    const existing = items2[0]; const id = existing.id; const patchResp2 = await api.patch(`/user-queries/${id}/`, payload); if (patchResp2?.data) return;
                }
            } catch (recErr) { console.error('Error intentando recuperar/actualizar consulta después de fallo:', recErr?.message || recErr); }
            console.error('Error final guardando consulta (no creada ni actualizada).');
        }
    };

    const clearActiveQuery = async () => { try { await api.post('/user-queries/clear_active_query/'); console.log('🧹 Consulta activa limpiada del backend'); } catch (error) { console.error('Error limpiando consulta:', error?.response?.data || error?.message); } };

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
        if (!startDate || !endDate) {
            setMessage('Por favor, ingrese una fecha de inicio y una de fin.');
            return; // Detiene la ejecución si faltan fechas
    }
        const lowStockItems = inventory.filter(item => item.stock < 10);
        const results = {
            title: 'Estado del Stock',
            summary: { totalProducts: inventory.length, lowStockItems: lowStockItems.length, totalStock: inventory.reduce((s,i)=>s+(i.stock||0),0) },
            data: inventory.map(item => ({ id: item.id, name: item.name, stock: item.stock, type: item.type, price: item.price, status: item.stock < 10 ? 'Stock Bajo' : item.stock < 20 ? 'Stock Medio' : 'Stock Alto' }))
        };
        return results;
    };

    const executeSuppliersQuery = async () => ({ title: 'Información de Proveedores', summary: { totalSuppliers: suppliers.length, activeSuppliers: suppliers.length }, data: suppliers.map(s=>({ id: s.id, name: s.name, cuit: s.cuit, phone: s.phone, address: s.address, products: s.products })) });

    const executeSalesQuery = async () => {
        if (!startDate || !endDate) {
        setMessage('Por favor, ingrese una fecha de inicio y una de fin.');
        return; // Detiene la ejecución si faltan fechas
    }

        let allSales = Array.isArray(sales) ? sales : [];
        if ((!Array.isArray(allSales) || allSales.length === 0)) {
            try { const loaded = await loadSales(); allSales = Array.isArray(loaded) && loaded.length > 0 ? loaded : (Array.isArray(sales) ? sales : []); } catch (e) { console.debug('⚠️ No se pudieron cargar ventas desde backend en executeSalesQuery:', e && e.message); allSales = Array.isArray(sales) ? sales : []; }
        }
        const rows = [];
        for (const s of allSales) {
            const date = s.timestamp || s.created_at || s.date || '';
            let itemsArr = [];
            if (Array.isArray(s.sale_items) && s.sale_items.length > 0) {
                itemsArr = s.sale_items.map(it => ({ product: it.product_name || it.product || it.name || '', quantity: Number(it.quantity ?? it.qty ?? 0)||0, unitPrice: Number(it.price ?? it.unit_price ?? 0)||0, total: (it.total !== undefined && it.total !== null) ? Number(it.total) : ((Number(it.quantity)||0)*(Number(it.price)||0)) }));
            } else if (Array.isArray(s.items) && s.items.length > 0) {
                itemsArr = s.items.map(it => ({ product: it.product_name || it.productName || it.product || it.name || '', quantity: Number(it.quantity ?? it.qty ?? 0)||0, unitPrice: Number(it.price ?? it.unitPrice ?? it.unit_price ?? 0)||0, total: (it.total !== undefined && it.total !== null) ? Number(it.total) : ((Number(it.quantity)||0)*(Number(it.price)||0)) }));
            }
            // Fallback: si la venta no tiene items detallados (ventas antiguas), pero sí tiene total_amount
            // o campos equivalentes, incluir una fila representativa para que no se pierda en el reporte.
            if (itemsArr.length === 0) {
                if (s.product) {
                    itemsArr = [{ product: s.product, quantity: s.quantity || 1, total: s.total || s.amount || 0 }];
                } else if (s.total_amount !== undefined || s.total !== undefined || s.amount !== undefined) {
                    const totalVal = Number(s.total_amount ?? s.total ?? s.amount ?? 0) || 0;
                    itemsArr = [{ product: s.product_name || s.product || 'Venta (sin items detallados)', quantity: 1, total: totalVal }];
                }
            }
            const saleUser = s.user || s.user_username || s.user_name || (s.user && s.user.username) || (s.user && s.user.name) || 'Sistema';
            for (const it of itemsArr) { rows.push({ id: s.id ?? null, date, product: it.product, quantity: it.quantity, total: it.total, user: saleUser }); }
        }
        const filteredSales = rows.filter(sale => {
            if (startDate && endDate) {
                const saleDate = parseAnyDate(sale.date) || null;
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (end) {
                    end.setHours(23, 59, 59, 999);
                }
                if (!saleDate || !start || !end) return false;
                return saleDate >= start && saleDate <= end;
            }
            return true;
        });
        const results = { title: 'Reporte de Ventas', summary: { totalSales: filteredSales.length, totalRevenue: filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0), period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos' }, data: filteredSales.map(r=>({ id: r.id, date: r.date, product: r.product, quantity: r.quantity, total: r.total, user: r.user })) };
        return results;
    };

    const executePurchasesQuery = async () => {
        if (!startDate || !endDate) {
        setMessage('Por favor, ingrese una fecha de inicio y una de fin.');
        return; // Detiene la ejecución si faltan fechas
    }

        const filteredPurchases = purchases.filter(purchase => {
            if (startDate && endDate) {
                const purchaseDate = parseAnyDate(purchase.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (!purchaseDate || !start || !end) return false;
                return purchaseDate >= start && purchaseDate <= end;
            }
            return true;
        });
        const normalized = filteredPurchases.map(purchase => {
            const itemsArray = Array.isArray(purchase.items) ? purchase.items.map(it => { const productName = it.productName || it.product_name || it.product || it.name || ''; const quantity = it.quantity ?? it.qty ?? 0; const unitPrice = it.unitPrice ?? it.unit_price ?? it.price ?? 0; const total = it.total ?? it.totalAmount ?? ((quantity ?? 0) * (unitPrice ?? 0)); let category = it.category || it.type || it.productCategory || it.product_category || ''; if ((!category || String(category).trim() === '') && productName) { try { const found = (inventory || []).find(p => p && p.name && String(p.name).toLowerCase() === String(productName).toLowerCase()); if (found && (found.type || found.category)) { category = found.type || found.category || ''; } } catch (e) { } } return { productName, quantity, unitPrice, total, category }; }) : [];
            const supplierName = purchase.supplierName || purchase.supplier || '';
            const totalAmount = Number(purchase.totalAmount ?? purchase.total_amount ?? purchase.total ?? 0);
            const itemsNames = itemsArray.map(i => i.productName).filter(Boolean).join(', ');
            const detectedTypes = Array.from(new Set(itemsArray.map(i => (i.category || '').toString().toLowerCase()).filter(Boolean)));
            let purchaseType = 'Producto'; if (detectedTypes.length === 0) purchaseType = 'Producto'; else if (detectedTypes.length === 1) purchaseType = detectedTypes[0].includes('insumo') ? 'Insumo' : (detectedTypes[0].includes('producto') ? 'Producto' : 'Producto'); else purchaseType = 'Mixto';
            return { id: purchase.id, date: purchase.date, supplier: supplierName, items: itemsNames, total: totalAmount, status: purchase.status || 'Completada', type: purchaseType };
        });
        const results = { title: 'Reporte de Compras', summary: { totalPurchases: normalized.length, totalAmount: normalized.reduce((sum, p) => sum + (Number(p.total) || 0), 0), period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos' }, data: normalized };
        setQueryResults(results);
        return results;
    };

    const executeOrdersQuery = async () => {

        if (!startDate || !endDate) {
        setMessage('Por favor, ingrese una fecha de inicio y una de fin.');
        return; // Detiene la ejecución si faltan fechas
    }

        const filteredOrders = orders.filter(order => {
            if (startDate && endDate) {
                const orderDate = parseAnyDate(order.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);
                if (!orderDate || !start || !end) return false;
                return orderDate >= start && orderDate <= end;
            
            }
            return true;
            
        });
        const results = { title: 'Reporte de Pedidos', summary: { totalOrders: filteredOrders.length, pendingOrders: filteredOrders.filter(o => o.status === 'Pendiente').length, sentOrders: filteredOrders.filter(o => o.status === 'Enviado').length, period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos' }, data: filteredOrders.map(order => { const itemsArray = Array.isArray(order.items) ? order.items : []; const productsList = itemsArray.map(it => it.productName || it.product_name || it.product || '').filter(Boolean); const unitsList = itemsArray.map(it => (it.quantity !== undefined && it.quantity !== null) ? String(it.quantity) : '').filter(Boolean); return { id: order.id, date: order.date, customerName: order.customerName || order.customer_name || '', paymentMethod: order.paymentMethod || order.payment_method || '', status: order.status, items: itemsArray, products: productsList.join(', '), units: unitsList.join(', '), customer_name: order.customerName || order.customer_name || '', payment_method: order.paymentMethod || order.payment_method || '' }; }) };
        setQueryResults(results);
        return results;
        
    };

    const executeCashMovementsQuery = async () => {

        
        
        let movementsToProcess = cashMovements;
        if (!movementsToProcess || movementsToProcess.length === 0) {
            try {
                const freshMovements = await loadCashMovements();
                movementsToProcess = freshMovements;
            } catch (e) {
                console.warn('⚠️ No se pudo recargar movimientos desde backend:', e && e.message);
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

        const filteredMovements = normalized.filter(movement => {
            if (startDate && endDate) {
                const movementDate = parseAnyDate(movement.date);
                const start = parseAnyDate(startDate);
                const end = parseAnyDate(endDate);

                if (end) {
                    end.setHours(23, 59, 59, 999);
                }

                if (!movementDate || !start || !end) return false;
                return movementDate >= start && movementDate <= end;
            }
            if (!startDate || !endDate) {
                setMessage('Por favor, ingrese una fecha de inicio y una de fin.');
                return; // Detiene la ejecución si faltan fechas
        }
        });

        const totalIncome = filteredMovements.reduce((sum, m) => sum + (m.type === 'Entrada' ? m.amount : 0), 0);
        const totalExpenses = filteredMovements.reduce((sum, m) => sum + (m.type === 'Salida' ? m.amount : 0), 0);
        const results = { title: 'Reporte de Movimientos de Caja', summary: { totalMovements: filteredMovements.length, totalIncome: safeToFixed(totalIncome), totalExpenses: safeToFixed(totalExpenses), period: startDate && endDate ? `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}` : 'Todos los períodos' }, data: filteredMovements.map(movement => ({ id: movement.id, date: movement.date, type: movement.type, amount: movement.amount, description: movement.description, user: movement.user, payment_method: movement.payment_method })) };
        
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
                try { await saveQueryToBackend(selectedQuery, startDate, endDate, results); } catch (e) { console.warn('Advertencia: no se pudo guardar la consulta en backend, pero los resultados se muestran localmente.', e?.message || e); }
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
                <div className="query-actions">
                    <button onClick={executeQuery} className="action-button primary">Ejecutar Consulta</button>
                    <button onClick={exportData} className="action-button secondary" disabled={!queryResults}>Exportar Datos</button>
                </div>
            </div>
            {queryResults && (
                <div className="query-results">
                    <h3>{queryResults.title}</h3>
                    <div className="results-summary">
                        {Object.entries(queryResults.summary).map(([key, value]) => (
                            <div key={key} className="summary-item">
                                <strong>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {value}
                            </div>
                        ))}
                    </div>
                    <div className="results-table">
                        {queryResults.data && queryResults.data.length > 0 ? (
                            (() => {
                                const renderCellValue = (value) => {
                                    if (value === null || value === undefined) return '';
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
                                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{renderCellValue(row[k] ?? row[k === 'products' ? 'items' : k])}</td>))}</tr>))}</tbody>
                                        </table>
                                    );
                                }
                                if (selectedQuery === 'ventas' || (sample.product && sample.quantity !== undefined && sample.total !== undefined)) {
                                    const cols = ['id','date','product','quantity','total','user'];
                                    return (
                                        <table>
                                            <thead><tr>{cols.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{renderCellValue(row[k])}</td>))}</tr>))}</tbody>
                                        </table>
                                    );
                                }
                                if (selectedQuery === 'movimientos_caja') {
                                    const cols = ['id', 'date', 'type', 'amount', 'payment_method', 'description', 'user'];
                                    return (
                                        <table>
                                            <thead><tr>{cols.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/_/g, ' ').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                                            <tbody>{queryResults.data.map((row, index) => (<tr key={index}>{cols.map((k, ci) => (<td key={ci}>{renderCellValue(row[k])}</td>))}</tr>))}</tbody>
                                        </table>
                                    );
                                }
                                const keys = Object.keys(sample);
                                return (
                                    <table>
                                        <thead><tr>{keys.map(key=> <th key={key}>{headerTranslationMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</th>)}</tr></thead>
                                        <tbody>{queryResults.data.map((row, rIdx) => (<tr key={rIdx}>{keys.map((k, cIdx) => (<td key={cIdx}>{renderCellValue(row[k])}</td>))}</tr>))}</tbody>
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