import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import api from '../services/api';
import PurchaseRequests from './PurchaseRequests';
import PurchaseHistory from './PurchaseHistory';

// Componente híbrido que usa datalist en Firefox/Safari y dropdown personalizado en Chrome/Brave
const SearchableProductInput = ({ value, onChange, inventory, mapBackendUnitToFrontend, isExistingProduct, itemIndex }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Detectar si está corriendo en Chrome o Brave
    const isChromiumBrowser = () => {
        return window.chrome !== undefined || 
               navigator.userAgent.includes('Chrome') || 
               navigator.userAgent.includes('Brave') ||
               navigator.userAgent.includes('Chromium');
    };

    const isChromium = isChromiumBrowser();

    // Generar opciones filtradas para el dropdown personalizado
    useEffect(() => {
        if (isChromium) {
            if (value && value.length > 0) {
                const filtered = inventory.filter(product => 
                    product.name.toLowerCase().includes(value.toLowerCase())
                ).slice(0, 8);
                setFilteredOptions(filtered);
            } else {
                setFilteredOptions(inventory.slice(0, 8));
            }
        }
    }, [value, inventory, isChromium]);

    // Cerrar dropdown al hacer clic fuera (solo para Chromium)
    useEffect(() => {
        if (!isChromium) return;
        
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                inputRef.current && !inputRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChromium]);

    const handleInputChange = (e) => {
        onChange(e.target.value);
        if (isChromium) {
            setIsOpen(true);
        }
    };

    const handleOptionClick = (productName) => {
        onChange(productName);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const getBorderColor = () => {
        if (isExistingProduct(value)) return '#28a745';
        if (value && !isExistingProduct(value)) return '#ffc107';
        return '#ced4da';
    };

    const getStatusMessage = () => {
        if (!value) return null;
        if (isExistingProduct(value)) {
            return <small style={{ color: '#28a745', fontSize: '0.8em' }}>✓ Producto existente - unidad detectada automáticamente</small>;
        }
        return <small style={{ color: '#ffc107', fontSize: '0.8em' }}>⚠ Producto nuevo - debe ingresar manualmente la unidad</small>;
    };

    // Crear un ID único para el datalist
    const datalistId = `product-list-${itemIndex}`;

    return (
        <div className="searchable-product-input-container">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={() => isChromium && setIsOpen(true)}
                placeholder="Escribe para buscar un producto existente o ingresa uno nuevo"
                required
                style={{
                    borderColor: getBorderColor(),
                    width: '100%'
                }}
                className="searchable-product-input"
                list={!isChromium ? datalistId : undefined}
            />
            
            {/* Datalist para Firefox/Safari */}
            {!isChromium && (
                <datalist id={datalistId}>
                    {inventory.map((product, index) => (
                        <option 
                            key={`${product.id}-${index}`} 
                            value={product.name}
                        >
                            {product.name} ({mapBackendUnitToFrontend(product.unit)}) - {product.quantity}
                        </option>
                    ))}
                </datalist>
            )}

            {/* Dropdown personalizado para Chrome/Brave */}
            {isChromium && isOpen && filteredOptions.length > 0 && (
                <div 
                    ref={dropdownRef} 
                    className="searchable-product-dropdown chromium-browser"
                >
                    {filteredOptions.map((product, index) => (
                        <div
                            key={`${product.id}-${index}`}
                            className="searchable-product-option"
                            onClick={() => handleOptionClick(product.name)}
                        >
                            <span className="product-name">
                                {product.name}
                            </span>
                            <span className="product-unit">({mapBackendUnitToFrontend(product.unit)})</span>
                            <span className="product-stock">{product.quantity}</span>
                        </div>
                    ))}
                </div>
            )}
            {getStatusMessage()}
        </div>
    );
};

const PurchaseManagement = ({ userRole, inventory = [], suppliers = [], products = [], purchases = [], reloadPurchases, reloadProducts }) => {
    const [pendingPurchases, setPendingPurchases] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [view, setView] = useState('requests'); // 'requests', 'history', or 'create'
    const [message, setMessage] = useState('');
    const [showAddPurchase, setShowAddPurchase] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // ID de la compra a eliminar (legacy)
    const [showConfirmPurchase, setShowConfirmPurchase] = useState(false); // Confirmación para registrar compra
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false); // Modal para confirmar eliminación
    const [pendingDeleteId, setPendingDeleteId] = useState(null);
    const [newPurchase, setNewPurchase] = useState({
        date: '',
        supplierId: '',
        items: [{ productName: '', quantity: 1, unit: 'u', unitPrice: 0, total: 0 }]
    });

    const productOptions = inventory.map(product => ({
        value: product.name,
        label: product.name
    }));

    const fetchPendingPurchases = async () => {
        try {
            console.log('Fetching pending purchases...');
            const response = await api.get('/purchases/pending-approval/');
            console.log('Pending purchases response:', response.data);
            setPendingPurchases(response.data);
        } catch (error) {
            console.error('Error fetching pending purchases:', error);
            // setMessage('Error al cargar las solicitudes de compra.');
        }
    };

    const fetchPurchaseHistory = async () => {
        try {
            console.log('Fetching purchase history...');
            const response = await api.get('/purchases/history/');
            console.log('Purchase history response:', response.data);
            setPurchaseHistory(response.data);
        } catch (error) {
            console.error('Error fetching purchase history:', error);
            setMessage('Error al cargar el historial de compras.');
        }
    };

    // Función para obtener el ID del producto por nombre
    const getProductIdByName = (inventory, name) => {
        const product = inventory.find(p => p.name === name);
        return product ? product.id : null;
    };

    // Función para verificar si un producto existe en el inventario
    const isExistingProduct = (productName) => {
        return inventory.some(p => p.name === productName);
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
            items: [...newPurchase.items, { productName: '', quantity: 1, unit: 'u', unitPrice: 0, total: 0 }]
        });
    };

    // Función para eliminar un item de la compra
    const removeItem = (index) => {
        if (newPurchase.items.length > 1) {
            const updatedItems = newPurchase.items.filter((_, i) => i !== index);
            setNewPurchase({ ...newPurchase, items: updatedItems });
        }
    };

    // Función para mapear unidades del backend al frontend
    const mapBackendUnitToFrontend = (backendUnit) => {
        switch (backendUnit) {
            case 'g':
                return 'kg'; // Convertir gramos a kilos para compras
            case 'ml':
                return 'l'; // Convertir mililitros a litros para compras
            case 'unidades':
                return 'u';
            default:
                return 'u'; // Por defecto unidades
        }
    };

    // Función para actualizar un item
    const updateItem = (index, field, value) => {
        const updatedItems = [...newPurchase.items];
        updatedItems[index] = { ...updatedItems[index], [field]: value };

        if (field === 'productName') {
            const product = inventory.find(p => p.name === value);
            if (product) {
                // Auto-completar precio y detectar unidad automáticamente
                updatedItems[index].unitPrice = product.price || 0;
                updatedItems[index].unit = mapBackendUnitToFrontend(product.unit);
            } else if (value === '') {
                // Si se borra el nombre del producto, resetear valores
                updatedItems[index].unitPrice = 0;
                updatedItems[index].unit = 'u';
            }
            // Si no es un producto existente pero tiene texto, mantener valores actuales
            // para que el usuario pueda ingresar manualmente
        }

        // Recalcular el total del item
        if (field === 'quantity' || field === 'unitPrice' || field === 'productName') {
            const quantity = updatedItems[index].quantity || 0;
            const unitPrice = updatedItems[index].unitPrice || 0;
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

        // Validaciones (las mismas que antes)
        if (!newPurchase.date) {
            setMessage('Por favor, ingrese una fecha.');
            return;
        }

        if (!newPurchase.supplierId) {
            setMessage('Por favor, seleccione un proveedor.');
            return;
        }

        // Validar que todos los items tengan producto y cantidad
        const hasInvalidItems = newPurchase.items.some(item => 
            !item.productName || item.quantity <= 0
        );

        if (hasInvalidItems) {
            setMessage('Por favor, complete todos los productos y cantidades.');
            return;
        }

        // Mostrar modal de confirmación (más visible)
        setShowConfirmPurchase(true);
    };

    // Confirmar registro de compra (ejecuta la petición)
    const confirmAddPurchase = async () => {
        setShowConfirmPurchase(false);
        try {
            const purchaseData = {
                date: newPurchase.date,
                supplier_id: parseInt(newPurchase.supplierId),
                items: newPurchase.items.map(item => ({
                    product_id: getProductIdByName(inventory, item.productName),
                    productName: item.productName,
                    quantity: parseFloat(item.quantity),
                    unit: item.unit,
                    unitPrice: parseFloat(item.unitPrice),
                    total: parseFloat(item.total)
                })),
                total_amount: calculatePurchaseTotal(),
            };

            console.log('Enviando datos de compra:', purchaseData);
            const response = await api.post('/purchases/', purchaseData);
            console.log('Respuesta del servidor:', response.data);

            setMessage(userRole === 'Gerente' ? 
                'Compra registrada y completada con éxito.' : 
                'Solicitud de compra enviada. Esperando aprobación del gerente.'
            );

            // Limpiar el formulario
            setNewPurchase({
                date: '',
                supplierId: '',
                items: [{ productName: '', quantity: 1, unit: 'u', unitPrice: 0, total: 0 }]
            });

            // Recargar las compras
            if (userRole === 'Gerente') {
                fetchPurchaseHistory();
            } else {
                fetchPendingPurchases();
            }
            if (reloadProducts) {
                reloadProducts();
            }
        } catch (error) {
            console.error('Error al registrar la compra:', error);
            setMessage('Error al registrar la compra. Por favor, intente nuevamente.');
        }
    };

    // Función para cancelar la confirmación de compra
    const handleCancelPurchase = () => {
        setShowConfirmPurchase(false);
        setMessage('');
    };

    // Función para iniciar confirmación de eliminación (abre modal)
    const handleDeletePurchase = (purchaseId) => {
        setPendingDeleteId(purchaseId);
        setShowConfirmDeleteModal(true);
    };

    // Función que confirma y ejecuta la eliminación
    const confirmDeletePurchase = async () => {
        if (!pendingDeleteId) return;
        try {
            await api.delete(`/purchases/${pendingDeleteId}/`);
            // Actualizar la lista de historial
            setPurchaseHistory(prev => prev.filter(p => p.id !== pendingDeleteId));
            setPendingDeleteId(null);
            setShowConfirmDeleteModal(false);
            setMessage('✅ Compra eliminada del historial exitosamente.');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error al eliminar la compra:', error);
            setMessage('Error al eliminar la compra.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    // Cancelar diálogo de eliminación
    const handleCancelDeleteModal = () => {
        setPendingDeleteId(null);
        setShowConfirmDeleteModal(false);
        setMessage('');
    };

    useEffect(() => {
        // Establecer la vista inicial basada en el rol
        if (userRole === 'Encargado') {
            setView('create');
        } else {
            setView('requests');
        }
    }, [userRole]);

    useEffect(() => {
        if (userRole === 'Gerente') {
            fetchPendingPurchases();
        }
        fetchPurchaseHistory();
    }, [userRole]);

    const handleApprove = async (purchaseId) => {
        try {
            console.log('Approving purchase:', purchaseId);
            await api.post(`/purchases/${purchaseId}/approve/`);
            console.log('Purchase approved successfully');
            setMessage('Compra aprobada con éxito.');
            // Actualizar la lista de compras pendientes (la compra aprobada ya no debería aparecer)
            setPendingPurchases(prev => {
                const filtered = prev.filter(p => p.id !== purchaseId);
                console.log('Updated pending purchases:', filtered);
                return filtered;
            });
            // Recargar el historial para mostrar la compra aprobada
            fetchPurchaseHistory();
            // Limpiar el mensaje después de 3 segundos
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error approving purchase:', error);
            setMessage('Error al aprobar la compra.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleReject = async (purchaseId) => {
        try {
            console.log('Rejecting purchase:', purchaseId);
            await api.post(`/purchases/${purchaseId}/reject/`);
            console.log('Purchase rejected successfully');
            setMessage('Compra rechazada y eliminada con éxito.');
            // Actualizar la lista de compras pendientes (la compra rechazada ya no debería aparecer)
            setPendingPurchases(prev => {
                const filtered = prev.filter(p => p.id !== purchaseId);
                console.log('Updated pending purchases after rejection:', filtered);
                return filtered;
            });
            // Limpiar el mensaje después de 3 segundos
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error rejecting purchase:', error);
            setMessage('Error al rechazar la compra.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="purchase-management-container">
            <h2>Gestión de Compras</h2>
            {message && <p className="message">{message}</p>}

            {/* Modal de confirmación para registrar compra */}
            {showConfirmPurchase && (
                <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000}}>
                    <div style={{background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '480px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'}}>
                        <h3 style={{marginTop: 0}}>Confirmar registro de compra</h3>
                        <p>¿Estás seguro que deseas {userRole === 'Gerente' ? 'registrar esta compra' : 'enviar esta solicitud de compra'}?</p>
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px'}}>
                            <button onClick={confirmAddPurchase} className="action-button primary">Confirmar</button>
                            <button onClick={handleCancelPurchase} className="action-button secondary">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmación para eliminar compra del historial */}
            {showConfirmDeleteModal && (
                <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000}}>
                    <div style={{background: '#fff', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '480px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)'}}>
                        <h3 style={{marginTop: 0}}>Confirmar eliminación</h3>
                        <p>¿Estás seguro que deseas eliminar esta compra del historial? Esta acción no se puede deshacer.</p>
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px'}}>
                            <button onClick={confirmDeletePurchase} className="action-button primary">Eliminar</button>
                            <button onClick={handleCancelDeleteModal} className="action-button secondary">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="tab-navigation">
                <button
                    className={`tab-button ${view === 'create' ? 'active' : ''}`}
                    onClick={() => setView('create')}
                >
                    {userRole === 'Encargado' ? 'Solicitar Compra' : 'Crear Compra'}
                </button>
                {userRole === 'Gerente' && (
                    <button
                        className={`tab-button ${view === 'requests' ? 'active' : ''}`}
                        onClick={() => setView('requests')}
                    >
                        Solicitudes Pendientes
                    </button>
                )}
                <button
                    className={`tab-button ${view === 'history' ? 'active' : ''}`}
                    onClick={() => setView('history')}
                >
                    Historial de Compras
                </button>
            </div>

            {view === 'create' ? (
                <div className="purchase-form">
                    <h3>{userRole === 'Encargado' ? 'Solicitar Nueva Compra' : 'Registrar Nueva Compra'}</h3>
                    <form onSubmit={handleAddPurchase}>
                        <div className="form-group">
                            <label>Fecha:</label>
                            <input
                                type="date"
                                value={newPurchase.date}
                                onChange={(e) => setNewPurchase({ ...newPurchase, date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Proveedor:</label>
                            <select
                                value={newPurchase.supplierId}
                                onChange={(e) => setNewPurchase({ ...newPurchase, supplierId: e.target.value })}
                                required
                            >
                                <option value="">Seleccionar proveedor</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="items-section">
                            <h4>Productos</h4>
                            {newPurchase.items.map((item, index) => (
                                <div key={index} className="item-row">
                                    <div className="form-group">
                                        <label>Producto/Insumo:</label>
                                        <SearchableProductInput
                                            value={item.productName}
                                            onChange={(value) => updateItem(index, 'productName', value)}
                                            inventory={inventory}
                                            mapBackendUnitToFrontend={mapBackendUnitToFrontend}
                                            isExistingProduct={isExistingProduct}
                                            itemIndex={index}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Cantidad:</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Unidad:</label>
                                        <select
                                            value={item.unit}
                                            onChange={e => updateItem(index, 'unit', e.target.value)}
                                            disabled={isExistingProduct(item.productName)}
                                            title={isExistingProduct(item.productName) ? 
                                                'La unidad se detecta automáticamente para productos existentes' : 
                                                'Selecciona la unidad manualmente para productos nuevos'}
                                        >
                                            <option value="u">Unidades</option>
                                            <option value="kg">Kilos (kg)</option>
                                            <option value="l">Litros (l)</option>
                                        </select>
                                        {isExistingProduct(item.productName) && (
                                            <small style={{ color: '#666', fontSize: '0.8em' }}>
                                                ✓ Unidad detectada automáticamente
                                            </small>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Precio Unitario:</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.unitPrice}
                                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Total:</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.total}
                                            readOnly
                                        />
                                    </div>

                                    {newPurchase.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            className="remove-item-button"
                                        >
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button type="button" onClick={addItem} className="add-item-button">
                                Agregar Producto
                            </button>
                        </div>

                        <div className="total-section">
                            <h4>Total de la Compra: ${calculatePurchaseTotal().toFixed(2)}</h4>
                        </div>

                        <button type="submit" className="submit-button">
                            {userRole === 'Encargado' ? 'Enviar Solicitud' : 'Registrar Compra'}
                        </button>
                    </form>
                </div>
            ) : view === 'requests' ? (
                <PurchaseRequests
                    purchases={pendingPurchases}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    userRole={userRole}
                />
            ) : (
                <PurchaseHistory 
                    purchases={purchaseHistory} 
                    onDeletePurchase={handleDeletePurchase}
                    confirmDelete={confirmDelete}
                    onCancelDelete={handleCancelDeleteModal}
                    userRole={userRole}
                    inventory={inventory}
                />
            )}
        </div>
    );
};

export default PurchaseManagement;
