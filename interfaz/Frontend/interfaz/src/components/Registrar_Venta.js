import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Registrar_Venta = ({ products, loadProducts, loadCashMovements }) => {
    const [cartItems, setCartItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentMethods, setPaymentMethods] = useState([
        { method: 'efectivo', amount: '' }
    ]);
    const [message, setMessage] = useState('');
    const [showMobileTicket, setShowMobileTicket] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [showProductsModal, setShowProductsModal] = useState(false);
    
    // Estados de filtros
    const [stockComparator, setStockComparator] = useState('');
    const [stockValue, setStockValue] = useState('');
    const [priceComparator, setPriceComparator] = useState('');
    const [priceValue, setPriceValue] = useState('');

    // Estados para drag del modal
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [modalPosition, setModalPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 300 });

    // Detectar cambios en el tamaño de la ventana
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Effect para manejar drag del modal
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                setModalPosition(prev => ({
                    x: prev.x + dx,
                    y: prev.y + dy
                }));
                setDragStart({ x: e.clientX, y: e.clientY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);

    // Función para comparar valores según el operador
    const compareValues = (productValue, filterValue, comparator) => {
        const pVal = parseFloat(productValue);
        const fVal = parseFloat(filterValue);
        
        switch(comparator) {
            case 'gt': return pVal > fVal;
            case 'gte': return pVal >= fVal;
            case 'lt': return pVal < fVal;
            case 'lte': return pVal <= fVal;
            case 'eq': return pVal === fVal;
            default: return true;
        }
    };

    // Filtrar productos disponibles
    const availableProducts = products.filter(product => {
        // Filtro base
        if (product.category !== 'Producto' || product.stock <= 0) return false;
        
        // Filtro de búsqueda
        if (searchTerm !== '' && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        
        // Filtro de stock
        if (stockComparator && stockValue !== '') {
            if (!compareValues(product.stock, stockValue, stockComparator)) return false;
        }
        
        // Filtro de precio
        if (priceComparator && priceValue !== '') {
            if (!compareValues(product.price, priceValue, priceComparator)) return false;
        }
        
        return true;
    });

    // Agregar producto al carrito (al hacer clic en el producto)
    const addProductToCart = (product) => {
        if (product.stock <= 0) {
            setMessage('No hay stock disponible para este producto.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        setCartItems(prevItems => {
            const existingItem = prevItems.find(item => item.product.id === product.id);
            if (existingItem) {
                const newQuantity = existingItem.quantity + 1;
                if (newQuantity > product.stock) {
                    setMessage(`No hay suficiente stock de ${product.name}. Stock disponible: ${product.stock}`);
                    setTimeout(() => setMessage(''), 3000);
                    return prevItems;
                }
                return prevItems.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: newQuantity }
                        : item
                );
            } else {
                return [...prevItems, { product: product, quantity: 1 }];
            }
        });
    };

    // Actualizar cantidad desde el ticket
    const updateQuantity = (productId, newQuantity) => {
        // Permitir input vacío sin eliminar el producto
        if (newQuantity === "") {
            setCartItems(prevItems =>
                prevItems.map(item =>
                    item.product.id === productId
                        ? { ...item, quantity: "" }
                        : item
                )
            );
            return;
        }

        if (parseInt(newQuantity) < 1) {
            removeFromCart(productId);
            return;
        }

        const product = products.find(p => p.id === productId);
        if (parseInt(newQuantity) > product.stock) {
            setMessage(`No puedes vender más de ${product.stock} unidades de ${product.name}.`);
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        setCartItems(prevItems =>
            prevItems.map(item =>
                item.product.id === productId
                    ? { ...item, quantity: parseInt(newQuantity) || 0 }
                    : item
            )
        );
    };

    // Remover producto del carrito
    const removeFromCart = (productId) => {
        setCartItems(prevItems => prevItems.filter(item => item.product.id !== productId));
    };

    // Calcular total
    useEffect(() => {
        const newTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
        setTotal(newTotal);
    }, [cartItems]);

    // Agregar medio de pago
    const addPaymentMethod = () => {
        setPaymentMethods([...paymentMethods, { method: 'efectivo', amount: '' }]);
    };

    // Actualizar medio de pago
    const updatePaymentMethod = (index, field, value) => {
        const updated = [...paymentMethods];
        updated[index][field] = value;
        setPaymentMethods(updated);
    };

    // Eliminar medio de pago
    const removePaymentMethod = (index) => {
        if (paymentMethods.length > 1) {
            setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
        }
    };

    // Calcular faltante
    const totalPaid = paymentMethods.reduce((sum, pm) => sum + (parseFloat(pm.amount) || 0), 0);
    const remaining = total - totalPaid;

    // Limpiar carrito
    const clearCart = () => {
        setCartItems([]);
        setPaymentMethods([{ method: 'efectivo', amount: '' }]);
        setMessage('');
    };

    // Confirmar venta
    const handleConfirmSale = async () => {
        if (cartItems.length === 0) {
            setMessage('El carrito está vacío.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        // Validar que todos los medios de pago tengan un monto
        const invalidPayments = paymentMethods.filter(pm => !pm.amount || parseFloat(pm.amount) <= 0);
        if (invalidPayments.length > 0) {
            setMessage('Todos los medios de pago deben tener un monto válido.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        // Validar que el total pagado sea exacto
        if (Math.abs(remaining) > 0.01) {
            setMessage(`Faltan: $${remaining.toFixed(2)}. El total debe estar completo.`);
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        const saleItems = cartItems.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            price: item.product.price
        }));

        try {
            // Registrar venta
            await api.post('/sales/', {
                total_amount: total,
                payment_method: paymentMethods.map(pm => pm.method).join(', '),
                items: saleItems
            });

            // Registrar cada movimiento de caja según el medio de pago
            for (const pm of paymentMethods) {
                const itemsForThisMethod = cartItems.map(item => 
                    `${item.product.name} x${item.quantity}`
                ).join(', ');
                
                await api.post('/cash-movements/', {
                    type: 'Entrada',
                    amount: parseFloat(pm.amount),
                    description: `Venta: ${itemsForThisMethod}`,
                    payment_method: pm.method
                });
            }

            await loadProducts();
            await loadCashMovements();

            setMessage('✅ Venta registrada exitosamente');
            setTimeout(() => {
                clearCart();
            }, 2000);
        } catch (err) {
            console.error('Error registrando venta:', err);
            setMessage('❌ No se pudo registrar la venta en el servidor.');
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-1 md:p-2">
            {/* Mensaje */}
            {message && (
                <div className={`mb-3 p-3 rounded-lg ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message}
                </div>
            )}

            {/* Layout principal */}
            <div className="w-full max-w-[3000px] mx-auto px-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-start">
                    {/* Columna izquierda: Filtros */}
                    <div className="md:col-span-3 lg:col-span-2 xl:col-span-2 2xl:col-span-2">
                        <div className="bg-white rounded-lg shadow-md p-4 sticky top-0">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h3>
                            
                            {/* Filtro de Stock */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Stock</label>
                                <select
                                    value={stockComparator}
                                    onChange={(e) => setStockComparator(e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                                >
                                    <option value="">Sin filtro</option>
                                    <option value="gt">Mayor que</option>
                                    <option value="gte">Mayor o igual</option>
                                    <option value="lt">Menor que</option>
                                    <option value="lte">Menor o igual</option>
                                    <option value="eq">Igual a</option>
                                </select>
                                {stockComparator && (
                                    <input
                                        type="number"
                                        value={stockValue}
                                        onChange={(e) => setStockValue(e.target.value)}
                                        placeholder="Cantidad"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}
                            </div>

                            {/* Filtro de Precio */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Precio</label>
                                <select
                                    value={priceComparator}
                                    onChange={(e) => setPriceComparator(e.target.value)}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                                >
                                    <option value="">Sin filtro</option>
                                    <option value="gt">Mayor que</option>
                                    <option value="gte">Mayor o igual</option>
                                    <option value="lt">Menor que</option>
                                    <option value="lte">Menor o igual</option>
                                    <option value="eq">Igual a</option>
                                </select>
                                {priceComparator && (
                                    <input
                                        type="number"
                                        value={priceValue}
                                        onChange={(e) => setPriceValue(e.target.value)}
                                        placeholder="Monto"
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}
                            </div>

                            {/* Botón limpiar filtros */}
                            <button
                                onClick={() => {
                                    setStockComparator('');
                                    setStockValue('');
                                    setPriceComparator('');
                                    setPriceValue('');
                                }}
                                className="w-full py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    </div>

                    {/* Columna central: Buscador y Productos */}
                    <div className="md:col-span-5 lg:col-span-6 xl:col-span-7 2xl:col-span-7 space-y-2">
                    {/* Buscador */}
                    <div className="bg-white rounded-lg shadow-md p-2 w-full">
                        <div className="relative w-full">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="🔍 Buscar producto..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Grid de productos */}
                    <div className="bg-white rounded-lg shadow-md p-4 w-full">
                        <div className="grid grid-cols-2 min-[800px]:grid-cols-2 min-[1000px]:grid-cols-3 min-[1240px]:grid-cols-3 min-[1443px]:grid-cols-4 min-[1800px]:grid-cols-5 2xl:grid-cols-6 gap-3 w-full">
                            {availableProducts.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => addProductToCart(product)}
                                    className="bg-white hover:bg-gray-50 text-black border-2 border-gray-200 rounded-lg p-4 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg flex flex-col items-center justify-between min-h-[140px]"
                                >
                                    <div className="text-center w-full">
                                        <p className="font-bold text-sm md:text-base mb-2 break-words hyphens-auto">{product.name}</p>
                                        <p className="text-xl font-bold break-all">${product.price}</p>
                                    </div>
                                    <p className="text-xs mt-2 opacity-80">Stock: {parseInt(product.stock, 10)}</p>
                                </button>
                            ))}
                        </div>
                        {availableProducts.length === 0 && (
                            <p className="text-center text-gray-500 py-8">No hay productos disponibles</p>
                        )}
                    </div>
                    </div>

                    {/* Columna derecha: Ticket */}
                    <div className="md:col-span-4 lg:col-span-4 xl:col-span-3 2xl:col-span-3">
                        {/* Ticket desktop (oculto en móvil cuando width < 800px) */}
                        {windowWidth >= 800 && (
                        <div className="bg-white rounded-lg shadow-md p-4 sticky top-0 w-full min-h-[500px]">
                        <div className="flex items-center justify-between mb-4">
                            {/* <h3 className="text-xl font-bold text-gray-800"> Ticket</h3> */}
                            <button
                                onClick={clearCart}
                                className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                                Limpiar
                            </button>
                        </div>

                        {/* Resumen compacto de items */}
                        {cartItems.length > 0 ? (
                            <div className="mb-4">
                                <button
                                    onClick={() => setShowProductsModal(true)}
                                    className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg p-3 transition-colors"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">🛒</span>
                                            <div className="text-left">
                                                <p className="font-bold text-gray-800">{cartItems.length} producto{cartItems.length !== 1 ? 's' : ''}</p>
                                                <p className="text-sm text-gray-600">{cartItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)} unidades</p>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">
                                                    {cartItems.map(item => item.product.name).join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-blue-600 font-medium">Ver detalle →</span>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <p className="text-center text-gray-400 py-8">Carrito vacío</p>
                            </div>
                        )}

                        {/* Total */}
                        <div className="border-t-2 border-gray-300 pt-3 mb-4">
                            <div className="flex justify-between items-center text-xl font-bold">
                                <span>Total</span>
                                <span className="text-black">${total.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Desglose de Pago */}
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-gray-700"> Desglose de Pago</h4>
                                <button
                                    onClick={addPaymentMethod}
                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                >
                                    + Agregar medio
                                </button>
                            </div>

                            <div className="space-y-3">
                                {paymentMethods.map((pm, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <select
                                            value={pm.method}
                                            onChange={(e) => updatePaymentMethod(index, 'method', e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        >
                                            <option value="efectivo">Efectivo</option>
                                            <option value="debito">Débito</option>
                                            <option value="credito">Crédito</option>
                                            <option value="transferencia">Transferencia</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={pm.amount}
                                            onChange={(e) => updatePaymentMethod(index, 'amount', e.target.value)}
                                            placeholder="Monto"
                                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                        />
                                        {paymentMethods.length > 1 && (
                                            <button
                                                onClick={() => removePaymentMethod(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Resumen de pago */}
                            <div className="mt-3 text-sm space-y-1">
                                <div className="flex justify-between text-gray-600">
                                    <span>Total a pagar:</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>Total ingresado:</span>
                                    <span>${totalPaid.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between font-bold ${remaining > 0 ? 'text-red-600' : remaining < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    <span>{remaining > 0 ? 'Faltan:' : remaining < 0 ? 'Sobra:' : 'Completo:'}</span>
                                    <span>${Math.abs(remaining).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Botón confirmar */}
                        <button
                            onClick={handleConfirmSale}
                            disabled={cartItems.length === 0 || Math.abs(remaining) > 0.01}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors duration-200"
                        >
                            ✓ Confirmar Venta
                        </button>
                        </div>
                        )}

                        {/* Modal de productos - Desktop */}
                        {showProductsModal && windowWidth >= 800 && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowProductsModal(false)}>
                                <div 
                                    className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden products-modal"
                                    style={{
                                        position: 'absolute',
                                        left: `${modalPosition.x}px`,
                                        top: `${modalPosition.y}px`,
                                        transform: 'none'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div 
                                        className="flex justify-between items-center p-4 border-b border-gray-200 cursor-move bg-blue-600 text-white select-none"
                                        onMouseDown={(e) => {
                                            setIsDragging(true);
                                            setDragStart({ x: e.clientX, y: e.clientY });
                                        }}
                                    >
                                        <h3 className="text-xl font-bold">📋 Detalle de productos</h3>
                                        <button
                                            onClick={() => setShowProductsModal(false)}
                                            className="text-white hover:text-gray-200 text-2xl font-bold"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                                        <div className="grid grid-cols-1 gap-3 products-modal-grid">
                                            {cartItems.map(item => (
                                                <div key={item.product.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-medium text-gray-800 flex-1 break-words">{item.product.name}</span>
                                                        <button
                                                            onClick={() => removeFromCart(item.product.id)}
                                                            className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-gray-600">${item.product.price} x</span>
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => updateQuantity(item.product.id, e.target.value)}
                                                                min="1"
                                                                max={item.product.stock}
                                                                className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                            />
                                                        </div>
                                                        <span className="font-bold text-gray-800">
                                                            ${(item.product.price * item.quantity).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    
                    {/* Ticket móvil (botón desplegable) - solo visible cuando hay items y width < 800px */}
                    {cartItems.length > 0 && windowWidth < 800 && (
                        <div className="fixed bottom-0 left-0 right-0 z-50">
                                {/* Botón para abrir ticket */}
                                <button
                                    onClick={() => setShowMobileTicket(!showMobileTicket)}
                                    className="w-full bg-gray-800 text-white p-4 flex justify-between items-center shadow-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                            {cartItems.length}
                                        </span>
                                        <span className="font-medium">Ver pedido</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold">${total.toFixed(2)}</span>
                                        <span className="text-2xl">{showMobileTicket ? '∨' : '∧'}</span>
                                    </div>
                                </button>

                                {/* Panel desplegable del ticket */}
                                {showMobileTicket && (
                                    <div className="bg-white border-t-2 border-gray-200 max-h-[70vh] overflow-y-auto shadow-2xl">
                                        <div className="p-4">
                                            <div className="flex items-center justify-between mb-4">
                                                {/* <h3 className="text-xl font-bold text-gray-800"> Ticket</h3> */}
                                                <button
                                                    onClick={clearCart}
                                                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                                                >
                                                    Limpiar
                                                </button>
                                            </div>

                                            {/* Items del carrito */}
                                            <div className="grid grid-cols-1 gap-3 mb-4 ticket-items-mobile">
                                                {cartItems.map(item => (
                                                    <div key={item.product.id} className="border-b border-gray-200 pb-3">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="font-medium text-gray-800 flex-1">{item.product.name}</span>
                                                            <button
                                                                onClick={() => removeFromCart(item.product.id)}
                                                                className="text-red-600 hover:text-red-700 ml-2"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-7 h-7 rounded flex items-center justify-center font-bold"
                                                                >
                                                                    -
                                                                </button>
                                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 w-7 h-7 rounded flex items-center justify-center font-bold"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                            <span className="font-bold text-gray-800">${(item.product.price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {cartItems.length === 0 && (
                                                <p className="text-center text-gray-400 py-8">Carrito vacío</p>
                                            )}

                                            {/* Total */}
                                            <div className="border-t-2 border-gray-300 pt-3 mb-4">
                                                <div className="flex justify-between items-center text-xl font-bold">
                                                    <span>Total</span>
                                                    <span className="text-black">${total.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {/* Desglose de Pago */}
                                            <div className="mb-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-semibold text-gray-700"> Desglose de Pago</h4>
                                                    <button
                                                        onClick={addPaymentMethod}
                                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                                    >
                                                        + Agregar medio
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    {paymentMethods.map((pm, index) => (
                                                        <div key={index} className="flex gap-2 items-center">
                                                            <select
                                                                value={pm.method}
                                                                onChange={(e) => updatePaymentMethod(index, 'method', e.target.value)}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                            >
                                                                <option value="efectivo">Efectivo</option>
                                                                <option value="debito">Débito</option>
                                                                <option value="credito">Crédito</option>
                                                                <option value="transferencia">Transferencia</option>
                                                            </select>
                                                            <input
                                                                type="number"
                                                                value={pm.amount}
                                                                onChange={(e) => updatePaymentMethod(index, 'amount', e.target.value)}
                                                                placeholder="Monto"
                                                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                            />
                                                            {paymentMethods.length > 1 && (
                                                                <button
                                                                    onClick={() => removePaymentMethod(index)}
                                                                    className="text-red-600 hover:text-red-700 p-2"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Resumen de pagos */}
                                                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                                                    <div className="flex justify-between text-gray-600">
                                                        <span>Total a pagar:</span>
                                                        <span>${total.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-gray-600">
                                                        <span>Total ingresado:</span>
                                                        <span>${totalPaid.toFixed(2)}</span>
                                                    </div>
                                                    <div className={`flex justify-between font-bold ${remaining > 0 ? 'text-red-600' : remaining < 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                                                        <span>{remaining > 0 ? 'Faltan:' : remaining < 0 ? 'Sobra:' : 'Completo:'}</span>
                                                        <span>${Math.abs(remaining).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Botón confirmar */}
                                            <button
                                                onClick={handleConfirmSale}
                                                disabled={cartItems.length === 0 || Math.abs(remaining) > 0.01}
                                                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors duration-200"
                                            >
                                                ✓ Confirmar Venta
                                            </button>
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Registrar_Venta;
