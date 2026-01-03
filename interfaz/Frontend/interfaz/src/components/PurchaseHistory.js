
import React, { useState } from 'react';
import { formatMovementDate } from '../utils/date';

const PurchaseHistory = ({ purchases, onDeletePurchase, confirmDelete, onCancelDelete, userRole, inventory = [] }) => {
    // Estados para filtros
    const [purchasesIdFilter, setPurchasesIdFilter] = useState('');
    const [purchasesIdFilterOp, setPurchasesIdFilterOp] = useState('equals');
    const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState('');
    const [purchasesSupplierFilterOp, setPurchasesSupplierFilterOp] = useState('contains');
    const [purchasesTotalFilter, setPurchasesTotalFilter] = useState('');
    const [purchasesTotalFilterOp, setPurchasesTotalFilterOp] = useState('equals');
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
    const [purchasesTypeFilter, setPurchasesTypeFilter] = useState([]);
    const [purchasesProductFilter, setPurchasesProductFilter] = useState('');
    const [purchasesQuantityFilter, setPurchasesQuantityFilter] = useState('');
    const [purchasesQuantityFilterOp, setPurchasesQuantityFilterOp] = useState('equals');
    const [purchasesQuantityUnit, setPurchasesQuantityUnit] = useState('Kg');
    
    const parseAnyDate = (dateStr) => {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date;
        } catch (e) {
            return null;
        }
    };
    
    // Normalizar y filtrar compras
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
        
        const supplierName = purchase.supplier_name || purchase.supplier || '';
        const totalAmount = Number(purchase.total_amount ?? purchase.total ?? 0);
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
            type: purchaseType,
            approved_by_name: purchase.approved_by_name,
            original: purchase
        };
    });
    
    let filteredPurchases = normalizedPurchases;

    // 1. Filtro de fechas granular
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
    }
    
    // 2. Filtro de ID
    if (purchasesIdFilter.trim()) {
        filteredPurchases = filteredPurchases.filter(purchase => {
            const purchaseId = Number(purchase.id);
            const filterId = Number(purchasesIdFilter);
            
            switch (purchasesIdFilterOp) {
                case 'equals': return purchaseId === filterId;
                case 'lt': return purchaseId < filterId;
                case 'lte': return purchaseId <= filterId;
                case 'gt': return purchaseId > filterId;
                case 'gte': return purchaseId >= filterId;
                default: return purchaseId === filterId;
            }
        });
    }
    
    // 3. Filtro de proveedor
    if (purchasesSupplierFilter.trim()) {
        filteredPurchases = filteredPurchases.filter(purchase => {
            const supplierName = String(purchase.supplier || '').toLowerCase();
            const filterValue = purchasesSupplierFilter.toLowerCase();
            
            switch (purchasesSupplierFilterOp) {
                case 'equals': return supplierName === filterValue;
                case 'contains': return supplierName.includes(filterValue);
                default: return supplierName.includes(filterValue);
            }
        });
    }
    
    // 4. Filtro de total
    if (purchasesTotalFilter.trim()) {
        filteredPurchases = filteredPurchases.filter(purchase => {
            const purchaseTotal = Number(purchase.total) || 0;
            const filterTotal = Number(purchasesTotalFilter) || 0;
            
            switch (purchasesTotalFilterOp) {
                case 'equals': return purchaseTotal === filterTotal;
                case 'lt': return purchaseTotal < filterTotal;
                case 'lte': return purchaseTotal <= filterTotal;
                case 'gt': return purchaseTotal > filterTotal;
                case 'gte': return purchaseTotal >= filterTotal;
                default: return purchaseTotal === filterTotal;
            }
        });
    }
    
    // 5. Filtro de tipos
    if (purchasesTypeFilter.length > 0) {
        filteredPurchases = filteredPurchases.filter(purchase => 
            purchasesTypeFilter.includes(purchase.type)
        );
    }
    
    // 6. Filtro por nombre de producto/insumo
    if (purchasesProductFilter) {
        filteredPurchases = filteredPurchases.filter(purchase => 
            purchase.items.some(item => 
                String(item.productName || '').toLowerCase().includes(purchasesProductFilter.toLowerCase())
            )
        );
    }
    
    // 7. Filtro por cantidad
    if (purchasesQuantityFilter.trim()) {
        filteredPurchases = filteredPurchases.filter(purchase => {
            return purchase.items.some(item => {
                const productName = item.productName || '';
                let itemQuantity = item.quantity || 0;
                
                const foundProduct = inventory.find(p => 
                    p && p.name && p.name.toLowerCase() === productName.toLowerCase()
                );
                
                if (foundProduct) {
                    const productUnit = foundProduct.unit;
                    
                    if (purchasesQuantityUnit === 'Kg' && productUnit === 'g') {
                    } else if (purchasesQuantityUnit === 'L' && productUnit === 'ml') {
                    } else if (purchasesQuantityUnit === 'U' && (productUnit !== 'g' && productUnit !== 'ml')) {
                    } else {
                        return false;
                    }
                } else {
                    if (purchasesQuantityUnit !== 'U') {
                        return false;
                    }
                }
                
                const filterQuantity = Number(purchasesQuantityFilter);
                
                switch (purchasesQuantityFilterOp) {
                    case 'equals': return itemQuantity === filterQuantity;
                    case 'greater': return itemQuantity > filterQuantity;
                    case 'greaterOrEqual': return itemQuantity >= filterQuantity;
                    case 'less': return itemQuantity < filterQuantity;
                    case 'lessOrEqual': return itemQuantity <= filterQuantity;
                    default: return itemQuantity === filterQuantity;
                }
            });
        });
    }
    
    // Ordenar las compras filtradas por fecha
    const sortedPurchases = [...filteredPurchases].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="purchase-history-container">
            <h3>Historial de Compras</h3>
            
            {/* Filtros de Compras */}
            <div className="purchases-filters" style={{marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
                <h4 style={{marginTop: '0'}}>Filtros de Compras</h4>
                
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
            
            {sortedPurchases.length === 0 ? (
                <p>No hay compras que coincidan con los filtros.</p>
            ) : (
                <div className="history-list">
                    {/* Encabezado de la tabla */}
                    <div className="history-item history-header">
                        <div className="history-field id-col"><strong>ID</strong></div>
                        <div className="history-field"><strong>Proveedor</strong></div>
                        <div className="history-field"><strong>Fecha</strong></div>
                        <div className="history-field items-col"><strong>Productos/Insumos</strong></div>
                        <div className="history-field"><strong>Total</strong></div>
                        <div className="history-field"><strong>Estado</strong></div>
                        <div className="history-field"><strong>Aprobado Por</strong></div>
                        {userRole === 'Gerente' && <div className="history-field actions-col"><strong>Acciones</strong></div>}
                    </div>

                    {/* Filas de datos */}
                    {sortedPurchases.map(purchase => (
                        <div key={purchase.id} className="history-item">
                            <div className="history-field id-col">#{purchase.id}</div>
                            <div className="history-field">{purchase.supplier || 'N/A'}</div>
                            <div className="history-field">{formatMovementDate(purchase.date)}</div>
                            <div className="history-field items-col">
                                <ul className="inner-items-list">
                                    {purchase.items && purchase.items.map((item, index) => (
                                        <li key={index}>
                                            {item.productName} ({item.quantity} x ${item.unitPrice})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="history-field">${purchase.total.toFixed(2)}</div>
                            <div className="history-field">{purchase.status}</div>
                            <div className="history-field">{purchase.approved_by_name || 'N/A'}</div>

                            {userRole === 'Gerente' && (
                                <div className="history-field actions-col">
                                    {confirmDelete === purchase.id ? (
                                        <div className="confirm-delete">
                                            <button 
                                                className="action-button danger small"
                                                onClick={() => onDeletePurchase(purchase.id)}
                                            >
                                                ✓ Confirmar
                                            </button>
                                            <button 
                                                className="action-button secondary small"
                                                onClick={onCancelDelete}
                                            >
                                                ✕ Cancelar
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            className="action-button danger small"
                                            onClick={() => onDeletePurchase(purchase.id)}
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PurchaseHistory;
