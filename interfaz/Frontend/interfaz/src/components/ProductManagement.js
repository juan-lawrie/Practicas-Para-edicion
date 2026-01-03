
import React, { useState } from 'react';
import ProductionCreation from './ProductionCreation';
import LossManagement from './LossManagement';

// Este componente actuará como un wrapper para la vista de creación de productos que está en App.js
const ProductCreationView = (props) => {
    // Aquí pasaremos directamente los props al componente que definiremos en App.js
    // Esto es un placeholder que se reemplazará con el componente real de App.js
    return <div></div>;
};

const ProductManagement = ({ userRole, products, inventory, loadProducts, ProductCreationViewComponent }) => {
    const [activeView, setActiveView] = useState('create'); // 'create', 'produce', or 'losses'

    // Solo el gerente puede ver todas las opciones
    if (userRole !== 'Gerente') {
        return <ProductCreationViewComponent />;
    }

    return (
        <div className="product-management-container">
            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeView === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveView('create')}
                >
                    Crear Nuevo Producto
                </button>
                <button
                    className={`tab-button ${activeView === 'produce' ? 'active' : ''}`}
                    onClick={() => setActiveView('produce')}
                >
                    Crear Producción
                </button>
                <button
                    className={`tab-button ${activeView === 'losses' ? 'active' : ''}`}
                    onClick={() => setActiveView('losses')}
                >
                    Pérdidas y Mermas
                </button>
            </div>

            <div className="tab-content">
                {activeView === 'create' && (
                    <ProductCreationViewComponent />
                )}
                {activeView === 'produce' && (
                    <ProductionCreation
                        products={products}
                        userRole={userRole}
                        loadProducts={loadProducts}
                    />
                )}
                {activeView === 'losses' && (
                    <LossManagement
                        products={products}
                        userRole={userRole}
                        loadProducts={loadProducts}
                    />
                )}
            </div>
        </div>
    );
};

export default ProductManagement;
