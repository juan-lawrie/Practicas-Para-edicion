import React, { useState } from 'react';
import EditarProductos from './EditarProductos';
import EditarInsumos from './EditarInsumos';

const Edicion = ({ products, setProducts, loadProducts, isLoading }) => {
    const [activeTab, setActiveTab] = useState('productos');
    const [showEditPanel, setShowEditPanel] = useState(false);

    return (
        <div className="edicion-container" style={{
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            height: '100%'
        }}>
            <div style={{
                display: 'flex',
                width: '200%',
                transform: showEditPanel ? 'translateX(-50%)' : 'translateX(0)',
                transition: 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                height: '100%'
            }}>
                {/* Contenido principal */}
                <div style={{ width: '50%', minHeight: '100vh' }}>
                    <div className="management-container">
                        <div style={{marginBottom: '20px'}}>
                            <h2>Edición de Productos e Insumos</h2>
                        </div>
                
                {/* Botones de pestañas */}
                <div className="tabs-container" style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '20px',
                    borderBottom: '2px solid #ddd'
                }}>
                    <button
                        onClick={() => setActiveTab('productos')}
                        className={`tab-button ${activeTab === 'productos' ? 'active' : ''}`}
                        style={{
                            padding: '12px 24px',
                            fontSize: '16px',
                            fontWeight: activeTab === 'productos' ? 'bold' : 'normal',
                            backgroundColor: activeTab === 'productos' ? '#007bff' : '#f5f5f5',
                            color: activeTab === 'productos' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        Productos
                    </button>
                    <button
                        onClick={() => setActiveTab('insumos')}
                        className={`tab-button ${activeTab === 'insumos' ? 'active' : ''}`}
                        style={{
                            padding: '12px 24px',
                            fontSize: '16px',
                            fontWeight: activeTab === 'insumos' ? 'bold' : 'normal',
                            backgroundColor: activeTab === 'insumos' ? '#007bff' : '#f5f5f5',
                            color: activeTab === 'insumos' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '8px 8px 0 0',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        Insumos
                    </button>
                </div>

                        {/* Contenido de las pestañas */}
                        {activeTab === 'productos' && (
                            <EditarProductos
                                products={products}
                                setProducts={setProducts}
                                loadProducts={loadProducts}
                                isLoading={isLoading}
                                showEditPanel={showEditPanel}
                                setShowEditPanel={setShowEditPanel}
                            />
                        )}
                        {activeTab === 'insumos' && (
                            <EditarInsumos
                                products={products}
                                setProducts={setProducts}
                                loadProducts={loadProducts}
                                isLoading={isLoading}
                                showEditPanel={showEditPanel}
                                setShowEditPanel={setShowEditPanel}
                            />
                        )}
                    </div>
                </div>

                {/* Panel de edición */}
                <div style={{ 
                    width: '50%', 
                    minHeight: '100vh',
                    backgroundColor: 'white',
                    overflow: 'auto',
                    padding: window.innerWidth <= 590 ? '15px' : '30px'
                }}>
                    {/* El contenido del panel se renderiza desde los componentes hijos */}
                </div>
            </div>
        </div>
    );
};

export default Edicion;
