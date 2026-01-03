import React, { useState } from 'react';
import Select from 'react-select';
import { formatMovementDate } from '../utils/date';
import api, { updateOrderStatus } from '../services/api';

const safeToFixed = (value, decimals = 2) => {
    const num = parseFloat(value);
    return isNaN(num) ? (0).toFixed(decimals) : num.toFixed(decimals);
};

const Pedidos = ({ orders, setOrders, products }) => {
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [newOrder, setNewOrder] = useState({
        customerName: '',
        fecha_para_la_que_se_quiere_el_pedido: new Date().toISOString().split('T')[0],
        paymentMethods: {
            efectivo: false,
            debito: false,
            credito: false,
            transferencia: false,
        },
        items: [{ productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }],
        notes: ''
    });
    const [message, setMessage] = useState('');

    const [ordersIdFilter, setOrdersIdFilter] = useState('');
    const [ordersIdFilterOp, setOrdersIdFilterOp] = useState('equals');
    const [ordersCustomerFilter, setOrdersCustomerFilter] = useState('');
    const [ordersCustomerFilterOp, setOrdersCustomerFilterOp] = useState('contains');
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
    const [ordersPaymentMethodFilter, setOrdersPaymentMethodFilter] = useState([]);
    const [ordersStatusFilter, setOrdersStatusFilter] = useState([]);
    const [ordersProductFilter, setOrdersProductFilter] = useState('');
    const [ordersUnitsFilter, setOrdersUnitsFilter] = useState('');
    const [ordersUnitsFilterOp, setOrdersUnitsFilterOp] = useState('equals');
    // Estado para controlar qué pedidos tienen abierto el menú de productos
    const [openProducts, setOpenProducts] = useState({});
    // Estado para controlar si los filtros están desplegados
    const [showFilters, setShowFilters] = useState(false);
    
    const toggleProducts = (orderId) => {
        setOpenProducts(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const addItem = () => {
        setNewOrder({
            ...newOrder,
            items: [...newOrder.items, { productId: '', productName: '', quantity: 1, unitPrice: 0, total: 0 }]
        });
    };

    const removeItem = (index) => {
        if (newOrder.items.length > 1) {
            const updatedItems = newOrder.items.filter((_, i) => i !== index);
            setNewOrder({ ...newOrder, items: updatedItems });
        }
    };

    const updateItem = (index, field, value) => {
        const updatedItems = [...newOrder.items];
        const currentItem = { ...updatedItems[index] };
    
        if (field === 'product') {
            const selectedProduct = value;
            currentItem.productId = selectedProduct ? selectedProduct.value : '';
            currentItem.productName = selectedProduct ? selectedProduct.label : '';
            const productData = products.find(p => p.id === currentItem.productId);
            if (productData) {
                currentItem.unitPrice = productData.price;
            }
        } else {
            currentItem[field] = value;
        }
    
        // Recalculate total for the item
        const quantity = parseFloat(currentItem.quantity) || 0;
        const unitPrice = parseFloat(currentItem.unitPrice) || 0;
        currentItem.total = quantity * unitPrice;
    
        updatedItems[index] = currentItem;
        setNewOrder({ ...newOrder, items: updatedItems });
    };

    const handlePaymentMethodChange = (method) => {
        setNewOrder(prevOrder => ({
            ...prevOrder,
            paymentMethods: {
                ...prevOrder.paymentMethods,
                [method]: !prevOrder.paymentMethods[method]
            }
        }));
    };

    const calculateOrderTotal = () => {
        return newOrder.items.reduce((sum, item) => sum + (item.total || 0), 0);
    };

    const handleAddOrder = async (e) => {
        e.preventDefault();
        
        if (!newOrder.customerName.trim()) {
            setMessage('🚫 Error: Debe ingresar el nombre del cliente.');
            return;
        }

        const selectedPaymentMethods = Object.entries(newOrder.paymentMethods)
            .filter(([_, isSelected]) => isSelected)
            .map(([method]) => method);

        if (selectedPaymentMethods.length === 0) {
            setMessage('🚫 Error: Debe seleccionar al menos un método de pago.');
            return;
        }
        
        const validItems = newOrder.items.filter(item => 
            item.productName.trim() && item.quantity > 0 && item.unitPrice > 0
        );
        
        if (validItems.length === 0) {
            setMessage('🚫 Error: Debe seleccionar al menos un producto con cantidad y precio válidos.');
            return;
        }
        
        try {
            const payload = {
                customer_name: newOrder.customerName,
                fecha_para_la_que_se_quiere_el_pedido: newOrder.fecha_para_la_que_se_quiere_el_pedido,
                payment_method: selectedPaymentMethods.join(', '),
                items: validItems.map(i => ({ 
                    product_name: i.productName, 
                    quantity: Number(i.quantity), 
                    unit_price: Number(i.unitPrice), 
                    total: Number(i.total) 
                })),
                notes: newOrder.notes,
                total_amount: calculateOrderTotal(),
            };

            const res = await api.post('/orders/', payload);
            if (res && res.data) {
                const created = res.data;
                const createdNormalized = {
                    id: created.id,
                    fecha_para_la_que_se_quiere_el_pedido: created.fecha_para_la_que_se_quiere_el_pedido,
                    fecha_de_orden_del_pedido: created.fecha_de_orden_del_pedido,
                    customerName: created.customer_name || '',
                    paymentMethod: created.payment_method || '',
                    items: Array.isArray(created.items) ? created.items.map(it => ({ 
                        productName: it.product_name || '', 
                        quantity: it.quantity, 
                        unitPrice: it.unit_price || 0, 
                        total: it.total || 0 
                    })) : [],
                    totalAmount: created.total_amount || 0,
                    status: created.status || 'Pendiente',
                    notes: created.notes || ''
                };

                setOrders(prev => [...prev, createdNormalized]);
                setNewOrder({ 
                    customerName: '', 
                    fecha_para_la_que_se_quiere_el_pedido: new Date().toISOString().split('T')[0],
                    paymentMethods: { efectivo: false, debito: false, credito: false, transferencia: false }, 
                    items: [{ productName: '', quantity: 1, unitPrice: 0, total: 0 }], 
                    notes: '' 
                });
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

    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        try {
            await updateOrderStatus(orderId, newStatus);
            setOrders(orders.map(order => 
                order.id === orderId 
                    ? { ...order, status: newStatus }
                    : order
            ));
            setMessage(`✅ Estado del pedido #${orderId} actualizado a "${newStatus}"`);
        } catch (error) {
            console.error("Error actualizando estado del pedido:", error);
            setMessage("❌ Error al actualizar el estado del pedido. Revisa la consola.");
        }
    };

    const productOptions = products
        .filter(p => p.category === 'Producto')
        .map(p => ({ value: p.id, label: p.name }));

    return (
        <div className="management-container">
            <h2 className="text-3xl font-extrabold mb-4">Gestión de Pedidos de Clientes</h2>
            {message && <p className="message">{message}</p>}
            <div className="flex items-center gap-4 mb-6">
                {!showAddOrder && (
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={() => setShowAddOrder(true)}>
                        Registrar Nuevo Pedido de Cliente
                    </button>
                )}
                {/* Botón para abrir historial de pedidos */}
                {!showAddOrder && window.innerWidth >= 1200 && (
                    <button
                        className="bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold py-2 px-4 rounded shadow hover:from-blue-700 hover:to-blue-500 transition-colors"
                        onClick={() => window.dispatchEvent(new CustomEvent('openPedDialogo'))}
                    >
                         Abrir Historial de Pedidos
                    </button>
                )}
            </div>
            {showAddOrder && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
                        <form onSubmit={handleAddOrder}>
                            <h3 className="text-lg font-bold mb-4">Registrar Pedido de Cliente</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre del cliente</label>
                                    <input 
                                        type="text" 
                                        value={newOrder.customerName} 
                                        onChange={e => setNewOrder({ ...newOrder, customerName: e.target.value })} 
                                        placeholder="Nombre del cliente" 
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        required
                                    />
                                </div>
                                <div>

                                    <label className="block text-sm font-medium text-gray-700">Fecha de Entrega</label>
                                    <input 
                                        type="date" 
                                        value={newOrder.fecha_para_la_que_se_quiere_el_pedido} 
                                        onChange={e => setNewOrder({ ...newOrder, fecha_para_la_que_se_quiere_el_pedido: e.target.value })} 
                                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Métodos de Pago</label>
                                    <div className="mt-2 flex space-x-4">
                                        {Object.keys(newOrder.paymentMethods).map(method => (
                                            <label key={method} className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-5 w-5 text-indigo-600"
                                                    checked={newOrder.paymentMethods[method]}
                                                    onChange={() => handlePaymentMethodChange(method)}
                                                />
                                                <span className="ml-2 text-gray-700">{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <h4 className="text-md font-bold mt-6 mb-2">Productos del Pedido</h4>
                            
                            {newOrder.items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-4 items-center mb-2">
                                    <div className="col-span-6">
                                        <Select
                                            options={productOptions}
                                            value={productOptions.find(opt => opt.value === item.productId)}
                                            onChange={selectedOption => updateItem(index, 'product', selectedOption)}
                                            placeholder="Buscar y seleccionar producto..."
                                            isClearable
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => updateItem(index, 'quantity', e.target.value)}
                                            placeholder="Cant." 
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            min="1"
                                            required 
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={item.unitPrice} 
                                            readOnly 
                                            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 sm:text-sm"
                                            placeholder="Precio" 
                                        />
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <span>${safeToFixed(item.total)}</span>
                                    </div>
                                    <div className="col-span-1">
                                        {newOrder.items.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeItem(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                &#x274C;
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <button type="button" onClick={addItem} className="mt-2 text-indigo-600 hover:text-indigo-900">
                                &#x2795; Agregar Producto
                            </button>
                            
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">Notas adicionales</label>
                                <textarea 
                                    value={newOrder.notes} 
                                    onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} 
                                    placeholder="Notas adicionales del pedido"
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm resize-none"
                                />
                            </div>
                            
                            <div className="mt-4 text-right font-bold text-lg">
                                Total del Pedido: ${safeToFixed(calculateOrderTotal())}
                            </div>
                            
                            <div className="mt-6 flex justify-end space-x-4">
                                <button type="button" className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded" onClick={() => setShowAddOrder(false)}>Cancelar</button>
                                <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Registrar Pedido</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
    
            <h3 className="text-lg font-bold mt-6 mb-4 min-[1200px]:hidden">Historial de Pedidos de Clientes</h3>
            
            {/* Filtros de Pedidos */}
            <div className="bg-white rounded-lg shadow-md mb-5 min-[1200px]:hidden">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="w-full px-4 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                    <h4 className="text-base font-bold text-gray-800">🔍 Filtros de Pedidos</h4>
                    <svg className={`w-6 h-6 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                {showFilters && (
                <div className="p-4 border-t border-gray-200">
                
                {/* Filtro por ID */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">ID del Pedido</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={ordersIdFilterOp} 
                            onChange={e => setOrdersIdFilterOp(e.target.value)}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
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
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                {/* Filtro por Cliente */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cliente</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={ordersCustomerFilterOp} 
                            onChange={e => setOrdersCustomerFilterOp(e.target.value)}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                            <option value="contains">Contiene</option>
                            <option value="equals">Es igual</option>
                        </select>
                        <input 
                            type="text" 
                            value={ordersCustomerFilter} 
                            onChange={e => setOrdersCustomerFilter(e.target.value)} 
                            placeholder="Nombre del cliente..." 
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>

                {/* Filtro por Fecha */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha (granular)</label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <p className="text-xs text-blue-700 italic">
                            💡 <strong>Filtro inteligente:</strong> Si completas solo "Desde", filtra exactamente ese período (ej: Mes 11 = solo noviembre). Si completas "Hasta", filtra como rango.
                        </p>
                    </div>
                    
                    {/* Desde */}
                    <div className="mb-3">
                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Desde (opcional):</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Año</label>
                                <input 
                                    type="number" 
                                    placeholder="2024" 
                                    min="2020" 
                                    max="2030" 
                                    value={ordersDateFromYear} 
                                    onChange={e => setOrdersDateFromYear(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Mes</label>
                                <input 
                                    type="number" 
                                    placeholder="1-12" 
                                    min="1" 
                                    max="12" 
                                    value={ordersDateFromMonth} 
                                    onChange={e => setOrdersDateFromMonth(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Día</label>
                                <input 
                                    type="number" 
                                    placeholder="1-31" 
                                    min="1" 
                                    max="31" 
                                    value={ordersDateFromDay} 
                                    onChange={e => setOrdersDateFromDay(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Hora</label>
                                <input 
                                    type="number" 
                                    placeholder="0-23" 
                                    min="0" 
                                    max="23" 
                                    value={ordersDateFromHour} 
                                    onChange={e => setOrdersDateFromHour(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Min</label>
                                <input 
                                    type="number" 
                                    placeholder="0-59" 
                                    min="0" 
                                    max="59" 
                                    value={ordersDateFromMinute} 
                                    onChange={e => setOrdersDateFromMinute(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Hasta */}
                    <div>
                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Hasta (opcional):</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Año</label>
                                <input 
                                    type="number" 
                                    placeholder="2024" 
                                    min="2020" 
                                    max="2030" 
                                    value={ordersDateToYear} 
                                    onChange={e => setOrdersDateToYear(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Mes</label>
                                <input 
                                    type="number" 
                                    placeholder="1-12" 
                                    min="1" 
                                    max="12" 
                                    value={ordersDateToMonth} 
                                    onChange={e => setOrdersDateToMonth(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Día</label>
                                <input 
                                    type="number" 
                                    placeholder="1-31" 
                                    min="1" 
                                    max="31" 
                                    value={ordersDateToDay} 
                                    onChange={e => setOrdersDateToDay(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Hora</label>
                                <input 
                                    type="number" 
                                    placeholder="0-23" 
                                    min="0" 
                                    max="23" 
                                    value={ordersDateToHour} 
                                    onChange={e => setOrdersDateToHour(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Min</label>
                                <input 
                                    type="number" 
                                    placeholder="0-59" 
                                    min="0" 
                                    max="59" 
                                    value={ordersDateToMinute} 
                                    onChange={e => setOrdersDateToMinute(e.target.value)} 
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Filtro por Métodos de Pago */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Métodos de Pago</label>
                    <div className="flex flex-wrap gap-3">
                        {['debito', 'credito', 'transferencia', 'efectivo'].map(method => (
                            <label key={method} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={ordersPaymentMethodFilter.includes(method)} 
                                    onChange={e => {
                                        if (e.target.checked) {
                                            setOrdersPaymentMethodFilter([...ordersPaymentMethodFilter, method]);
                                        } else {
                                            setOrdersPaymentMethodFilter(ordersPaymentMethodFilter.filter(m => m !== method));
                                        }
                                    }} 
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                {/* Filtro por Estados */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Estados</label>
                    <div className="flex flex-wrap gap-3">
                        {['Pendiente', 'En Preparación', 'Listo', 'Entregado', 'Cancelado'].map(status => (
                            <label key={status} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={ordersStatusFilter.includes(status)} 
                                    onChange={e => {
                                        if (e.target.checked) {
                                            setOrdersStatusFilter([...ordersStatusFilter, status]);
                                        } else {
                                            setOrdersStatusFilter(ordersStatusFilter.filter(s => s !== status));
                                        }
                                    }} 
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{status}</span>
                            </label>
                        ))}
                    </div>
                </div>
                
                {/* Filtro por Producto */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar Producto</label>
                    <input 
                        type="text" 
                        value={ordersProductFilter} 
                        onChange={e => setOrdersProductFilter(e.target.value)} 
                        placeholder="Nombre del producto..." 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                </div>
                
                {/* Filtro por Unidades */}
                <div className="mb-0">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Unidades</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <select 
                            value={ordersUnitsFilterOp} 
                            onChange={e => setOrdersUnitsFilterOp(e.target.value)}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
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
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </div>
                </div>
                )}
            </div>
            
            <ul
                className="list-container grid grid-cols-1 md:grid-cols-2 gap-4 min-[1200px]:hidden"
            >
                {orders.filter(order => {
                    // Filtro por ID
                    if (ordersIdFilter) {
                        const orderId = Number(order.id);
                        const filterValue = Number(ordersIdFilter);
                        if (ordersIdFilterOp === 'equals' && orderId !== filterValue) return false;
                        if (ordersIdFilterOp === 'lt' && orderId >= filterValue) return false;
                        if (ordersIdFilterOp === 'lte' && orderId > filterValue) return false;
                        if (ordersIdFilterOp === 'gt' && orderId <= filterValue) return false;
                        if (ordersIdFilterOp === 'gte' && orderId < filterValue) return false;
                    }
                    
                    // Filtro por cliente
                    if (ordersCustomerFilter) {
                        const customerName = (order.customerName || '').toLowerCase();
                        const filterLower = ordersCustomerFilter.toLowerCase();
                        if (ordersCustomerFilterOp === 'contains' && !customerName.includes(filterLower)) return false;
                        if (ordersCustomerFilterOp === 'equals' && customerName !== filterLower) return false;
                    }
                    
                    // Filtro por fecha granular
                    if (ordersDateFromYear || ordersDateFromMonth || ordersDateFromDay || ordersDateFromHour || ordersDateFromMinute ||
                        ordersDateToYear || ordersDateToMonth || ordersDateToDay || ordersDateToHour || ordersDateToMinute) {
                        const orderDate = new Date(order.fecha_de_orden_del_pedido);
                        
                        // Construir fecha "desde"
                        if (ordersDateFromYear || ordersDateFromMonth || ordersDateFromDay || ordersDateFromHour || ordersDateFromMinute) {
                            const fromYear = ordersDateFromYear ? parseInt(ordersDateFromYear) : null;
                            const fromMonth = ordersDateFromMonth ? parseInt(ordersDateFromMonth) : null;
                            const fromDay = ordersDateFromDay ? parseInt(ordersDateFromDay) : null;
                            const fromHour = ordersDateFromHour ? parseInt(ordersDateFromHour) : null;
                            const fromMinute = ordersDateFromMinute ? parseInt(ordersDateFromMinute) : null;
                            
                            if (fromYear !== null && orderDate.getFullYear() < fromYear) return false;
                            if (fromMonth !== null && orderDate.getMonth() + 1 < fromMonth) return false;
                            if (fromDay !== null && orderDate.getDate() < fromDay) return false;
                            if (fromHour !== null && orderDate.getHours() < fromHour) return false;
                            if (fromMinute !== null && orderDate.getMinutes() < fromMinute) return false;
                        }
                        
                        // Construir fecha "hasta"
                        if (ordersDateToYear || ordersDateToMonth || ordersDateToDay || ordersDateToHour || ordersDateToMinute) {
                            const toYear = ordersDateToYear ? parseInt(ordersDateToYear) : null;
                            const toMonth = ordersDateToMonth ? parseInt(ordersDateToMonth) : null;
                            const toDay = ordersDateToDay ? parseInt(ordersDateToDay) : null;
                            const toHour = ordersDateToHour ? parseInt(ordersDateToHour) : null;
                            const toMinute = ordersDateToMinute ? parseInt(ordersDateToMinute) : null;
                            
                            if (toYear !== null && orderDate.getFullYear() > toYear) return false;
                            if (toMonth !== null && orderDate.getMonth() + 1 > toMonth) return false;
                            if (toDay !== null && orderDate.getDate() > toDay) return false;
                            if (toHour !== null && orderDate.getHours() > toHour) return false;
                            if (toMinute !== null && orderDate.getMinutes() > toMinute) return false;
                        }
                    }
                    
                    // Filtro por método de pago
                    if (ordersPaymentMethodFilter.length > 0) {
                        if (!ordersPaymentMethodFilter.includes(order.paymentMethod)) return false;
                    }
                    
                    // Filtro por estado
                    if (ordersStatusFilter.length > 0) {
                        if (!ordersStatusFilter.includes(order.status)) return false;
                    }
                    
                    // Filtro por producto
                    if (ordersProductFilter) {
                        const hasProduct = order.items.some(item => 
                            (item.productName || '').toLowerCase().includes(ordersProductFilter.toLowerCase())
                        );
                        if (!hasProduct) return false;
                    }
                    
                    // Filtro por unidades
                    if (ordersUnitsFilter) {
                        const filterValue = Number(ordersUnitsFilter);
                        const hasMatchingQuantity = order.items.some(item => {
                            const quantity = Number(item.quantity) || 0;
                            if (ordersUnitsFilterOp === 'equals' && quantity === filterValue) return true;
                            if (ordersUnitsFilterOp === 'greater' && quantity > filterValue) return true;
                            if (ordersUnitsFilterOp === 'greaterOrEqual' && quantity >= filterValue) return true;
                            if (ordersUnitsFilterOp === 'less' && quantity < filterValue) return true;
                            if (ordersUnitsFilterOp === 'lessOrEqual' && quantity <= filterValue) return true;
                            return false;
                        });
                        if (!hasMatchingQuantity) return false;
                    }
                    
                    return true;
                }).map(order => (
                    <li key={order.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow mb-4">
                        {/* Header del pedido */}
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-blue-200">
                            <div className="flex flex-col gap-3">
                                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 break-words">
                                    Pedido #{order.id}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-600 break-words">
                                    Registrado: {formatMovementDate(order.fecha_de_orden_del_pedido)}
                                </p>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold ${
                                        order.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                                        order.status === 'En Preparación' ? 'bg-blue-100 text-blue-800' :
                                        order.status === 'Listo' ? 'bg-green-100 text-green-800' :
                                        order.status === 'Entregado' ? 'bg-gray-100 text-gray-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {order.status}
                                    </span>
                                    <select 
                                        value={order.status} 
                                        onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}
                                        className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium text-xs sm:text-sm"
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Preparación">En Preparación</option>
                                        <option value="Listo">Listo</option>
                                        <option value="Entregado">Entregado</option>
                                        <option value="Cancelado">Cancelado</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* Contenido del pedido */}
                        <div className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                            {/* Cliente y Entrega */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm sm:text-base break-words">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-gray-700">Cliente:</span>
                                    <span className="text-gray-900">{order.customerName}</span>
                                </div>
                                <span className="hidden sm:inline text-gray-400">|</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-gray-700">Entrega:</span>
                                    <span className="text-gray-900">
                                        {order.fecha_para_la_que_se_quiere_el_pedido ? 
                                            new Date(order.fecha_para_la_que_se_quiere_el_pedido).toISOString().split('T')[0].replace(/-/g, '/') 
                                            : 'N/A'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Método de Pago */}
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                                <span className="font-bold text-gray-700">Método de Pago:</span>
                                <span className="font-medium break-words">{order.paymentMethod}</span>
                            </div>
                            
                            {/* Productos */}
                            <div>
                                <button
                                    className="flex items-center gap-2 font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2 text-sm sm:text-base"
                                    onClick={() => toggleProducts(order.id)}
                                    aria-expanded={!!openProducts[order.id]}
                                    aria-controls={`productos-${order.id}`}
                                >
                                    <span>Productos solicitados</span>
                                    <svg className={`w-4 h-4 sm:w-5 sm:h-5 transform transition-transform ${openProducts[order.id] ? 'rotate-90' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                {openProducts[order.id] && (
                                    <ul id={`productos-${order.id}`} className="bg-gray-50 rounded-md p-2 sm:p-3 space-y-1 border border-gray-200">
                                        {order.items.map((item, index) => (
                                            <li key={index} className="text-gray-800 text-xs sm:text-sm break-words">
                                                <span className="font-medium">{item.productName}</span> - {item.quantity || 0} unidades 
                                                × ${safeToFixed(item.unitPrice)} = <span className="font-semibold">${safeToFixed(item.total)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            
                            {/* Total */}
                            <div className="pt-2 sm:pt-3 border-t border-gray-200">
                                <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 break-words">
                                    Total: <span className="text-black">${safeToFixed(order.totalAmount)}</span>
                                </span>
                            </div>
                            
                            {/* Notas */}
                            {order.notes && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 sm:p-3 rounded">
                                    <span className="font-bold text-gray-700 text-sm sm:text-base">Notas:</span>
                                    <p className="text-gray-800 mt-1 text-xs sm:text-sm break-words">{order.notes}</p>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Pedidos;