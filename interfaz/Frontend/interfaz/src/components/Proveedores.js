import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Proveedores = ({ suppliers, setSuppliers }) => {
    const [showAddSupplier, setShowAddSupplier] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [newSupplier, setNewSupplier] = useState({ 
        name: '', 
        cuit: '', 
        address: '', 
        phone: '', 
        products: '' 
    });
    const [message, setMessage] = useState('');
    const [showFilters, setShowFilters] = useState(true);
    const [expandedProducts, setExpandedProducts] = useState({});
    
    // Estados de filtros
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

    const validateCUIT = (cuit) => /^\d{11}$/.test(cuit);
    const validatePhone = (phone) => /^\d{8,}$/.test(phone);

    const fetchSuppliers = async () => {
        try {
            const response = await api.get('/suppliers/');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Error cargando proveedores:', error);
            setMessage('Error al cargar la lista de proveedores.');
        }
    };

    const handleAddSupplier = async (e) => {
        e.preventDefault();
        if (!newSupplier.name.trim()) {
            setMessage('🚫 Error: El nombre es obligatorio.');
            return;
        }
        if (!validateCUIT(newSupplier.cuit)) {
            setMessage('🚫 Error: El CUIT debe ser un número de 11 dígitos.');
            return;
        }
        if (!validatePhone(newSupplier.phone)) {
            setMessage('🚫 Error: El teléfono debe contener solo números, con un mínimo de 8 dígitos.');
            return;
        }
        try {
            await api.post('/suppliers/', newSupplier);
            await fetchSuppliers();
            setMessage('Proveedor agregado correctamente.');
            setShowAddSupplier(false);
            setNewSupplier({ name: '', cuit: '', address: '', phone: '', products: '' });
        } catch (error) {
            setMessage('Error al agregar proveedor.');
        }
    };

    const handleUpdateSupplier = async (e) => {
        e.preventDefault();
        if (!editingSupplier) return;

        if (!validateCUIT(editingSupplier.cuit)) {
            setMessage('🚫 Error: El CUIT debe ser un número de 11 dígitos.');
            return;
        }
        if (!validatePhone(editingSupplier.phone)) {
            setMessage('🚫 Error: El teléfono debe contener solo números, con un mínimo de 8 dígitos.');
            return;
        }

        try {
            await api.put(`/suppliers/${editingSupplier.id}/`, editingSupplier);
            await fetchSuppliers();
            setEditingSupplier(null);
            setMessage('✅ Proveedor actualizado exitosamente.');
        } catch (error) {
            console.error('Error actualizando proveedor:', error.response?.data || error.message);
            setMessage('Error al actualizar el proveedor.');
        }
    };

    const handleDeleteSupplier = async (supplierId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este proveedor?')) return;
        try {
            await api.delete(`/suppliers/${supplierId}/`);
            await fetchSuppliers();
            setMessage('Proveedor eliminado correctamente.');
        } catch (error) {
            setMessage('Error al eliminar proveedor.');
        }
    };

    const startEditing = (supplier) => {
        setEditingSupplier({ ...supplier });
        setShowAddSupplier(false);
    };

    const toggleProducts = (supplierId) => {
        setExpandedProducts(prev => ({
            ...prev,
            [supplierId]: !prev[supplierId]
        }));
    };
    
    // Lógica de filtrado
    const getFilteredSuppliers = () => {
        let filteredSuppliers = suppliers;

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

        if (suppliersProductFilter.trim()) {
            filteredSuppliers = filteredSuppliers.filter(supplier => {
                const filterValue = suppliersProductFilter.toLowerCase().trim();
                
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
                    const productsStr = String(supplier.products || '');
                    const productList = productsStr.split(',').map(p => p.toLowerCase().trim());
                    
                    switch (suppliersProductFilterOp) {
                        case 'equals':
                            return productList.some(product => product === filterValue);
                        case 'contains':
                            return productList.some(product => product.includes(filterValue));
                        default:
                            return productList.some(product => product.includes(filterValue));
                    }
                }
            });
        }

        return filteredSuppliers;
    };

    const renderContent = () => {
        return <button className="main-button whitespace-nowrap shrink min-w-0 overflow-hidden text-ellipsis" onClick={() => setShowAddSupplier(true)}>Registrar Nuevo Proveedor</button>;
    };

    const filteredSuppliers = getFilteredSuppliers();

    return (
        <div className="management-container">
            <h2 className="text-2xl font-bold mb-4">Gestión de Proveedores</h2>
            {message && <p className="message">{message}</p>}
            {renderContent()}
            
            {/* Filtros de Proveedores con diseño responsivo */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold">Filtros de Proveedores</h4>
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="min-[1240px]:hidden px-3 py-1 bg-blue-500 text-white rounded-md text-sm"
                    >
                        {showFilters ? 'Ocultar' : 'Mostrar'}
                    </button>
                </div>
                
                {/* Contenedor de filtros con flex wrap */}
                <div className={`${showFilters ? 'block' : 'hidden min-[1240px]:block'} flex flex-wrap gap-3 sm:gap-4`}>
                    {/* Filtro de Nombre */}
                    <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.6rem)]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                        <div className="flex gap-1.5 sm:gap-2">
                            <select 
                                value={suppliersNameFilterOp} 
                                onChange={e => setSuppliersNameFilterOp(e.target.value)}
                                className="w-[95px] sm:w-[110px] lg:w-[120px] px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="contains">Contiene</option>
                                <option value="equals">Es Igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersNameFilter} 
                                onChange={e => setSuppliersNameFilter(e.target.value)} 
                                placeholder="Buscar..." 
                                className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filtro de CUIT */}
                    <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.6rem)]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
                        <div className="flex gap-1.5 sm:gap-2">
                            <select 
                                value={suppliersCuitFilterOp} 
                                onChange={e => setSuppliersCuitFilterOp(e.target.value)}
                                className="w-[95px] sm:w-[110px] lg:w-[120px] px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="contains">Contiene</option>
                                <option value="equals">Es Igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersCuitFilter} 
                                onChange={e => setSuppliersCuitFilter(e.target.value)} 
                                placeholder="Buscar..." 
                                className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filtro de Teléfono */}
                    <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.6rem)]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                        <div className="flex gap-1.5 sm:gap-2">
                            <select 
                                value={suppliersPhoneFilterOp} 
                                onChange={e => setSuppliersPhoneFilterOp(e.target.value)}
                                className="w-[95px] sm:w-[110px] lg:w-[120px] px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="contains">Contiene</option>
                                <option value="equals">Es Igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersPhoneFilter} 
                                onChange={e => setSuppliersPhoneFilter(e.target.value)} 
                                placeholder="Buscar..." 
                                className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filtro de Dirección */}
                    <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.6rem)]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                        <div className="flex gap-1.5 sm:gap-2">
                            <select 
                                value={suppliersAddressFilterOp} 
                                onChange={e => setSuppliersAddressFilterOp(e.target.value)}
                                className="w-[95px] sm:w-[110px] lg:w-[120px] px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="contains">Contiene</option>
                                <option value="equals">Es Igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersAddressFilter} 
                                onChange={e => setSuppliersAddressFilter(e.target.value)} 
                                placeholder="Buscar..." 
                                className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Filtro de Producto/Insumo */}
                    <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] xl:w-[calc(20%-0.6rem)]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Producto/Insumo</label>
                        <div className="flex gap-1.5 sm:gap-2">
                            <select 
                                value={suppliersProductFilterOp} 
                                onChange={e => setSuppliersProductFilterOp(e.target.value)}
                                className="w-[95px] sm:w-[110px] lg:w-[120px] px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="contains">Contiene</option>
                                <option value="equals">Es Igual</option>
                            </select>
                            <input 
                                type="text" 
                                value={suppliersProductFilter} 
                                onChange={e => setSuppliersProductFilter(e.target.value)} 
                                placeholder="Buscar..." 
                                className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Contador de resultados */}
            <div className="mb-4">
                <p className="text-sm text-gray-600">
                    Mostrando {filteredSuppliers.length} de {suppliers.length} proveedores
                </p>
            </div>

            {/* Grid de tarjetas responsivo */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 min-[500px]:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(350px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(400px,1fr))]">
                {filteredSuppliers.map(supplier => (
                    <div 
                        key={supplier.id} 
                        className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 p-4 sm:p-5 border border-gray-200 min-w-0"
                    >
                        {/* Header de la tarjeta */}
                        <div className="mb-3">
                            <h3 className="text-lg font-bold text-gray-800 mb-1">{supplier.name}</h3>
                            <p className="text-sm text-gray-600">(CUIT: {supplier.cuit})</p>
                        </div>
                        
                        {/* Información de contacto */}
                        <div className="space-y-2 mb-4 text-sm">
                            <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-gray-700">{supplier.address}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span className="text-gray-700">Tel: {supplier.phone}</span>
                            </div>
                        </div>
                        
                        {/* Productos */}
                        <div className="mb-4">
                            <div 
                                className="flex items-center justify-between cursor-pointer mb-2"
                                onClick={() => toggleProducts(supplier.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    <span className="font-semibold text-sm text-gray-700">Productos:</span>
                                </div>
                                <svg 
                                    className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${expandedProducts[supplier.id] ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                            {expandedProducts[supplier.id] && (
                                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                    {supplier.products || 'Sin productos especificados'}
                                </p>
                            )}
                        </div>
                        
                        {/* Botones de acción */}
                        <div className="flex gap-2 pt-3 border-t border-gray-200">
                            <button 
                                onClick={() => startEditing(supplier)} 
                                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
                            >
                                Editar
                            </button>
                            <button 
                                onClick={() => handleDeleteSupplier(supplier.id)} 
                                className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 text-sm font-medium"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Mensaje cuando no hay resultados */}
            {filteredSuppliers.length === 0 && (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron proveedores</h3>
                    <p className="mt-1 text-sm text-gray-500">Intenta ajustar los filtros o agrega un nuevo proveedor.</p>
                </div>
            )}

            {/* Modal de registro */}
            {showAddSupplier && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4">Registrar Proveedor</h3>
                            <form onSubmit={handleAddSupplier} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proveedor</label>
                                    <input 
                                        type="text" 
                                        value={newSupplier.name} 
                                        onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} 
                                        placeholder="Nombre del Proveedor" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CUIT (11 dígitos)</label>
                                    <input 
                                        type="text" 
                                        value={newSupplier.cuit} 
                                        onChange={e => setNewSupplier({ ...newSupplier, cuit: e.target.value })} 
                                        placeholder="CUIT (11 dígitos)" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                    <input 
                                        type="text" 
                                        value={newSupplier.address} 
                                        onChange={e => setNewSupplier({ ...newSupplier, address: e.target.value })} 
                                        placeholder="Dirección" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                    <input 
                                        type="text" 
                                        value={newSupplier.phone} 
                                        onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} 
                                        placeholder="Teléfono" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Productos que provee</label>
                                    <textarea 
                                        value={newSupplier.products} 
                                        onChange={e => setNewSupplier({ ...newSupplier, products: e.target.value })} 
                                        placeholder="Productos que provee" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows="3"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="submit" 
                                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 font-medium"
                                    >
                                        Registrar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAddSupplier(false)} 
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors duration-200 font-medium"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de edición */}
            {editingSupplier && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4">Editando a {editingSupplier.name}</h3>
                            <form onSubmit={handleUpdateSupplier} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Proveedor</label>
                                    <input 
                                        type="text" 
                                        value={editingSupplier.name} 
                                        onChange={e => setEditingSupplier({ ...editingSupplier, name: e.target.value })} 
                                        placeholder="Nombre del Proveedor" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CUIT (11 dígitos)</label>
                                    <input 
                                        type="text" 
                                        value={editingSupplier.cuit} 
                                        onChange={e => setEditingSupplier({ ...editingSupplier, cuit: e.target.value })} 
                                        placeholder="CUIT (11 dígitos)" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                    <input 
                                        type="text" 
                                        value={editingSupplier.address} 
                                        onChange={e => setEditingSupplier({ ...editingSupplier, address: e.target.value })} 
                                        placeholder="Dirección" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                    <input 
                                        type="text" 
                                        value={editingSupplier.phone} 
                                        onChange={e => setEditingSupplier({ ...editingSupplier, phone: e.target.value })} 
                                        placeholder="Teléfono" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Productos que provee</label>
                                    <textarea 
                                        value={editingSupplier.products} 
                                        onChange={e => setEditingSupplier({ ...editingSupplier, products: e.target.value })} 
                                        placeholder="Productos que provee" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows="3"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="submit" 
                                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 font-medium"
                                    >
                                        Guardar Cambios
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setEditingSupplier(null)} 
                                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors duration-200 font-medium"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proveedores;
