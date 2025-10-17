import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import api from '../services/api';
import PurchaseRequests from './PurchaseRequests';
import PurchaseHistory from './PurchaseHistory';

const PurchaseManagement = ({ userRole, inventory = [], suppliers = [], products = [], purchases = [], reloadPurchases }) => {
    const [pendingPurchases, setPendingPurchases] = useState([]);
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [view, setView] = useState('requests'); // 'requests', 'history', or 'create'
    const [message, setMessage] = useState('');
    const [showAddPurchase, setShowAddPurchase] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // ID de la compra a eliminar
    const [newPurchase, setNewPurchase] = useState({
        date: '',
        supplierId: '',
        items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
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
            const quantity = field === 'quantity' ? value : updatedItems[index].quantity;
            const unitPrice = field === 'unitPrice' ? value : updatedItems[index].unitPrice;
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
        
        // Validaciones
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
        
        try {
            // Buscar el ID del producto por nombre
            const productId = getProductIdByName(inventory, newPurchase.items[0].productName);
            if (!productId) {
                setMessage('Producto no encontrado en el inventario.');
                return;
            }
            
            // Preparar los datos para enviar al backend
            const purchaseData = {
                date: newPurchase.date,
                supplier_id: parseInt(newPurchase.supplierId),
                items: newPurchase.items.map(item => ({
                    product_id: getProductIdByName(inventory, item.productName),
                    productName: item.productName,
                    quantity: parseInt(item.quantity),
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
                items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }]
            });
            
            // Recargar las compras
            if (userRole === 'Gerente') {
                fetchPurchaseHistory();
            } else {
                fetchPendingPurchases();
            }
            
        } catch (error) {
            console.error('Error al registrar la compra:', error);
            setMessage('Error al registrar la compra. Por favor, intente nuevamente.');
        }
    };

    // Función para eliminar una compra del historial
    const handleDeletePurchase = async (purchaseId) => {
        if (confirmDelete === purchaseId) {
            try {
                await api.delete(`/purchases/${purchaseId}/`);
                // Actualizar la lista de historial
                setPurchaseHistory(prev => prev.filter(p => p.id !== purchaseId));
                setConfirmDelete(null);
                setMessage('✅ Compra eliminada del historial exitosamente.');
                setTimeout(() => setMessage(''), 3000);
            } catch (error) {
                console.error('Error al eliminar la compra:', error);
                setMessage('Error al eliminar la compra.');
                setTimeout(() => setMessage(''), 3000);
            }
        } else {
            setConfirmDelete(purchaseId);
            setMessage('⚠️ ¿Estás seguro de que deseas eliminar esta compra del historial? Haz clic nuevamente en "Eliminar" para confirmar.');
            setTimeout(() => setMessage(''), 5000);
        }
    };

    // Función para cancelar la eliminación
    const handleCancelDelete = () => {
        setConfirmDelete(null);
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
                                        <label>Producto:</label>
                                        <Select
                                            options={productOptions}
                                            value={productOptions.find(option => option.value === item.productName)}
                                            onChange={selectedOption => updateItem(index, 'productName', selectedOption ? selectedOption.value : '')}
                                            placeholder="Buscar y seleccionar producto..."
                                            isClearable
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Cantidad:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                                            required
                                        />
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
                    onCancelDelete={handleCancelDelete}
                    userRole={userRole}
                />
            )}
        </div>
    );
};

export default PurchaseManagement;