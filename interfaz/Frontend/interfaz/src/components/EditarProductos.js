import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Select from 'react-select';
import api, { getRecipe, deleteRecipeIngredient, getIngredientsWithSuggestedUnit } from '../services/api';

const EditarProductos = ({ products, setProducts, loadProducts, isLoading, showEditPanel, setShowEditPanel }) => {
    // Solo mostrar productos (category === 'Producto')
    const productosOnly = products.filter(p => p.category === 'Producto' && !p.hasSales);
    
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [isFirstRender, setIsFirstRender] = useState(true);
    const [editingProduct, setEditingProduct] = useState({
        name: '',
        price: 0,
        category: 'Producto',
        stock: 0,
        description: '',
        lowStockThreshold: 10,
        highStockMultiplier: 2.0,
        recipeYield: 1,
        recipe_ingredients: []
    });
    const [message, setMessage] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [showLoadingMessage, setShowLoadingMessage] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    
    // Estados para manejo de recetas
    const [recipeIngredients, setRecipeIngredients] = useState([]);
    const [availableIngredients, setAvailableIngredients] = useState([]);
    const [newIngredients, setNewIngredients] = useState([{
        ingredient: null,
        quantity: '',
        unit: 'g'
    }]);

    // Cargar ingredientes disponibles al montar el componente
    useEffect(() => {
        setMessage('');
        setShowLoadingMessage(false);
        loadAvailableIngredients();
        const timer = setTimeout(() => setIsFirstRender(false), 300);
        return () => clearTimeout(timer);
    }, []);

    // Limpiar mensajes automáticamente
    useEffect(() => {
        if (message && !message.includes('⚠️') && !message.includes('¿Estás seguro')) {
            const timer = setTimeout(() => {
                setMessage('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Controlar mensaje de carga
    useEffect(() => {
        if (isLoading && !isFirstRender) {
            const timer = setTimeout(() => {
                setShowLoadingMessage(true);
            }, 5);
            return () => clearTimeout(timer);
        } else {
            setShowLoadingMessage(false);
        }
    }, [isLoading, isFirstRender]);

    // Filtrar productos
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredProducts(productosOnly);
        } else {
            const filtered = productosOnly.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredProducts(filtered);
        }
    }, [products, searchTerm]);

    const loadRecipe = async (productId) => {
        try {
            const response = await getRecipe(productId);
            const ingredients = response.data || [];
            setRecipeIngredients(ingredients);
            setEditingProduct(prev => ({
                ...prev,
                recipe_ingredients: ingredients
            }));
        } catch (error) {
            setRecipeIngredients([]);
            setEditingProduct(prev => ({
                ...prev,
                recipe_ingredients: []
            }));
        }
    };

    const loadAvailableIngredients = async () => {
        try {
            const response = await getIngredientsWithSuggestedUnit();
            if (response.data.success) {
                setAvailableIngredients(response.data.data || []);
            } else {
                setAvailableIngredients([]);
            }
        } catch (error) {
            setAvailableIngredients([]);
        }
    };

    const addIngredientsToRecipe = () => {
        const validIngredients = newIngredients.filter(
            ing => ing.ingredient && ing.ingredient.value && ing.quantity && parseFloat(ing.quantity) > 0
        );

        if (validIngredients.length === 0) {
            setMessage('⚠️ Complete al menos un ingrediente con todos sus campos y cantidad mayor a 0.');
            return;
        }

        const ingredientsToAdd = validIngredients.map(ing => ({
            ingredient: ing.ingredient.value,
            ingredient_name: ing.ingredient.label.split(' (Stock:')[0],
            quantity: parseFloat(ing.quantity),
            unit: ing.unit
        }));

        const currentIngredients = editingProduct.recipe_ingredients || [];
        const updatedRecipe = [...currentIngredients, ...ingredientsToAdd];
        
        setEditingProduct(prev => ({
            ...prev,
            recipe_ingredients: updatedRecipe
        }));

        setRecipeIngredients(prev => [...prev, ...ingredientsToAdd]);

        setNewIngredients([{
            ingredient: null,
            quantity: '',
            unit: 'g'
        }]);
        setMessage(`✅ ${validIngredients.length} ingrediente(s) agregado(s) a la receta. Recuerde guardar los cambios del producto para confirmar.`);
    };

    const deleteIngredientFromRecipe = async (ingredientId) => {
        try {
            await deleteRecipeIngredient(ingredientId);
            const updatedIngredients = recipeIngredients.filter(ing => ing.id !== ingredientId);
            setRecipeIngredients(updatedIngredients);
            setEditingProduct(prev => ({
                ...prev,
                recipe_ingredients: updatedIngredients
            }));
            setMessage('✅ Ingrediente eliminado de la receta exitosamente.');
        } catch (error) {
            setMessage('❌ Error eliminando ingrediente de la receta.');
        }
    };

    const handleIngredientChange = (selectedOption, index) => {
        const updatedIngredients = [...newIngredients];
        if (selectedOption) {
            updatedIngredients[index] = {
                ...updatedIngredients[index],
                ingredient: selectedOption,
                unit: selectedOption.suggested_unit || 'g'
            };
        } else {
            updatedIngredients[index] = {
                ...updatedIngredients[index],
                ingredient: null,
                unit: 'g'
            };
        }
        setNewIngredients(updatedIngredients);
    };

    const addNewIngredientField = () => {
        setNewIngredients([...newIngredients, {
            ingredient: null,
            quantity: '',
            unit: 'g'
        }]);
    };

    const removeIngredientField = (index) => {
        if (newIngredients.length > 1) {
            const updatedIngredients = newIngredients.filter((_, i) => i !== index);
            setNewIngredients(updatedIngredients);
        }
    };

    const updateIngredientField = (index, field, value) => {
        const updatedIngredients = [...newIngredients];
        updatedIngredients[index] = {
            ...updatedIngredients[index],
            [field]: value
        };
        setNewIngredients(updatedIngredients);
    };

    const selectProductForEdit = async (product) => {
        if (!product) {
            setMessage('⚠️ Producto no encontrado.');
            return;
        }
        setSelectedProduct(product);
        setShowEditPanel(true);
        
        const convertThresholdFromBaseUnit = (threshold, unit) => {
            if (unit === 'g') return threshold / 1000;
            if (unit === 'ml') return threshold / 1000;
            return threshold;
        };
        
        setEditingProduct({
            name: product.name || '',
            price: product.price || 0,
            category: product.category || 'Producto',
            stock: product.stock || 0,
            description: product.description || '',
            lowStockThreshold: convertThresholdFromBaseUnit(product.lowStockThreshold ?? product.low_stock_threshold ?? 10, product.unit),
            highStockMultiplier: product.highStockMultiplier ?? product.high_stock_multiplier ?? 2.0,
            recipeYield: parseInt(product.recipe_yield) || 1,
            recipe_ingredients: []
        });
        setMessage('');
        
        await loadRecipe(product.id);
        await loadAvailableIngredients();
    };

    const handleSaveChanges = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (!selectedProduct) return;

        if (editingProduct.price <= 0) {
            setMessage('🚫 Error: El precio debe ser un número decimal positivo mayor a cero.');
            return;
        }

        if (!editingProduct.name.trim() || editingProduct.price <= 0 || !editingProduct.category) {
            setMessage('🚫 Error: No se pueden eliminar datos obligatorios (nombre, precio, categoría).');
            return;
        }

        try {
            const newIngredientsData = editingProduct.recipe_ingredients
                .filter(ingredient => !ingredient.id)
                .map(ingredient => ({
                    ingredient: ingredient.ingredient,
                    quantity: parseFloat(ingredient.quantity),
                    unit: ingredient.unit
                }));

            const recipeYieldValue = parseInt(editingProduct.recipeYield) || 1;
            if (recipeYieldValue < 1) {
                setMessage('🚫 Error: El rendimiento de la receta debe ser al menos 1.');
                return;
            }

            const convertThresholdToBaseUnit = (threshold, unit) => {
                if (unit === 'g') return threshold * 1000;
                if (unit === 'ml') return threshold * 1000;
                return threshold;
            };

            const updatedProduct = {
                name: editingProduct.name,
                price: parseFloat(editingProduct.price),
                category: editingProduct.category,
                description: editingProduct.description,
                low_stock_threshold: convertThresholdToBaseUnit(parseFloat(editingProduct.lowStockThreshold), selectedProduct.unit),
                high_stock_multiplier: parseFloat(editingProduct.highStockMultiplier),
                recipe_yield: recipeYieldValue
            };

            if (newIngredientsData.length > 0) {
                updatedProduct.recipe_ingredients = newIngredientsData;
            }

            await api.put(`/products/${selectedProduct.id}/`, updatedProduct);
            await loadProducts();

            setShowEditPanel(false);
            setTimeout(() => {
                setSelectedProduct(null);
                setEditingProduct({
                    name: '',
                    price: 0,
                    category: 'Producto',
                    stock: 0,
                    description: '',
                    lowStockThreshold: 10,
                    highStockMultiplier: 2.0,
                    recipeYield: 1,
                    recipe_ingredients: []
                });
                
                setRecipeIngredients([]);
                setNewIngredients([{
                    ingredient: null,
                    quantity: '',
                    unit: 'g'
                }]);
            }, 300);
            
            setMessage('✅ Producto actualizado correctamente en el servidor. Los cambios se reflejan en todas las secciones.');
        } catch (error) {
            if (error.response && error.response.data) {
                const errorData = error.response.data;
                if (typeof errorData === 'string') {
                    setMessage(`❌ Error: ${errorData}`);
                } else if (errorData.detail) {
                    setMessage(`❌ Error: ${errorData.detail}`);
                } else {
                    setMessage('❌ Error: No se pudo actualizar el producto. Verifique los datos.');
                }
            } else {
                setMessage('❌ Error: No se pudo actualizar el producto en el servidor. Los cambios no fueron guardados.');
            }
        }
    };

    const handleCancelEdit = () => {
        setShowEditPanel(false);
        setTimeout(() => {
            setSelectedProduct(null);
            setEditingProduct({
                name: '',
                price: 0,
                category: 'Producto',
                stock: 0,
                description: '',
                lowStockThreshold: 10,
                recipeYield: 1,
                recipe_ingredients: []
            });
            setMessage('');
            setConfirmDelete(false);
            setRecipeIngredients([]);
            setNewIngredients([{
                ingredient: null,
                quantity: '',
                unit: 'g'
            }]);
        }, 300);
    };
    
    const handleDeleteProduct = async () => {
        if (!selectedProduct) return;
        
        if (selectedProduct.hasSales) {
            setMessage(`⚠️ Error: No se puede eliminar un producto que ya tiene ventas registradas.`);
            setShowDeleteModal(false);
            return;
        }
        
        if (!showDeleteModal) {
            setShowDeleteModal(true);
            return;
        }
        
        try {
            await api.delete(`/products/${selectedProduct.id}/`);
            const updatedProducts = products.filter(product => product.id !== selectedProduct.id);
            setProducts(updatedProducts);
            setShowDeleteModal(false);
            setShowEditPanel(false);
            setTimeout(() => {
                setSelectedProduct(null);
                setEditingProduct({
                    name: '',
                    price: 0,
                    category: 'Producto',
                    stock: 0,
                    description: '',
                    lowStockThreshold: 10,
                    recipeYield: 1
                });
            }, 300);
            setMessage(`✅ Producto eliminado correctamente del servidor y todas las secciones.`);
        } catch (error) {
            setMessage(`❌ Error: No se pudo eliminar el producto del servidor. El producto permanece en el sistema.`);
            setShowDeleteModal(false);
        }
    };
    
    const handleDeleteAllProducts = async () => {
        if (!showDeleteAllModal) {
            setShowDeleteAllModal(true);
            return;
        }
        
        try {
            const productsToDelete = productosOnly;
            const deletePromises = productsToDelete.map(product => 
                api.delete(`/products/${product.id}/`)
            );
            await Promise.all(deletePromises);
            const productsWithSales = products.filter(product => product.hasSales || product.category !== 'Producto');
            setProducts(productsWithSales);
            setShowDeleteAllModal(false);
            setMessage(`✅ ${productsToDelete.length} productos eliminados correctamente del servidor y todas las secciones.`);
        } catch (error) {
            setMessage('❌ Error: No se pudieron eliminar todos los productos del servidor.');
            setShowDeleteAllModal(false);
        }
    };

    const productsToShow = filteredProducts.length > 0 ? filteredProducts : productosOnly;

    if (isFirstRender) {
        return null;
    }

    if (showLoadingMessage && !isFirstRender) {
        return <p className="no-products">Cargando productos...</p>;
    }

    return (
        <>
            {message && <p className="message">{message}</p>}
            
            <div className="products-list">
                <h3>Productos Disponibles para Edición</h3>
                
                {/* Buscador */}
                <div className="search-container" style={{marginBottom: '20px'}}>
                    <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                        <input
                            type="text"
                            placeholder="Buscar por nombre"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                            style={{
                                width: '100%',
                                padding: '10px 40px 10px 10px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                marginBottom: '10px'
                            }}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '18px',
                                    cursor: 'pointer',
                                    color: '#666',
                                    marginBottom: '10px'
                                }}
                                title="Limpiar búsqueda"
                            >
                                ×
                            </button>
                        )}
                    </div>
                    {searchTerm && (
                        <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
                            {productsToShow.length} resultado(s) encontrado(s) para "{searchTerm}"
                        </p>
                    )}
                </div>
                
                {productsToShow.length > 0 ? (
                    <ul className="list-container grid gap-4 grid-cols-1 min-[820px]:grid-cols-2 min-[1400px]:grid-cols-3 min-[1600px]:grid-cols-4 min-[1900px]:grid-cols-5 min-[2560px]:grid-cols-6">
                        {productsToShow.map(product => (
                            <React.Fragment key={product.id}>
                                <li className="product-list-item">
                                    <div className="product-info">
                                        <strong>{product.name}</strong>
                                        <span className="product-price">${product.price}</span>
                                        <span className="product-category">{product.category}</span>
                                        <span className="product-stock">Stock: {product.stock}</span>
                                        <span className="product-threshold">Umbral Stock Bajo: {product.lowStockThreshold || 10}</span>
                                        {product.description && (
                                            <span className="product-description">{product.description}</span>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => selectProductForEdit(product)}
                                        className="edit-button"
                                    >
                                        Editar
                                    </button>
                                </li>
                            </React.Fragment>
                        ))}
                    </ul>
                ) : (
                    searchTerm ? (
                        <p className="no-products">No se encontraron productos que coincidan con la búsqueda.</p>
                    ) : (
                        <p className="no-products">No hay productos nuevos disponibles para editar.</p>
                    )
                )}
            </div>

            <div className="manage-all-products">
                <button 
                    onClick={handleDeleteAllProducts}
                    className="action-button delete-all"
                    disabled={productosOnly.length === 0}
                >
                    Eliminar Todos los Productos
                </button>
            </div>

            {/* Formulario de edición de producto */}
            {selectedProduct && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    width: '50%',
                    height: '100vh',
                    backgroundColor: 'white',
                    overflow: 'auto',
                    padding: window.innerWidth <= 590 ? '15px' : '30px',
                    zIndex: 999,
                    boxShadow: '-2px 0 10px rgba(0,0,0,0.1)'
                }}>
                    <h3>Editar Producto: {selectedProduct.name}</h3>
                    
                    <form onSubmit={handleSaveChanges} className="form-container">
                        {/* Fila: Nombre + Precio */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: window.innerWidth >= 1300 ? '1fr 1fr' : '1fr',
                            gap: '15px',
                            marginBottom: '15px'
                        }}>
                            <div className="form-group" style={{marginBottom: 0}}>
                                <label>Nombre del Producto *</label>
                                <input 
                                    type="text" 
                                    value={editingProduct.name} 
                                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} 
                                    placeholder="Nombre del producto (máximo 100 caracteres)"
                                    maxLength="100"
                                    required 
                                />
                            </div>
                            
                            <div className="form-group" style={{marginBottom: 0}}>
                                <label>Precio *</label>
                                <input 
                                    type="number" 
                                    value={editingProduct.price} 
                                    onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} 
                                    placeholder="Precio (mayor a 0)"
                                    min="0.01"
                                    step="0.01"
                                    required 
                                />
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label>Descripción</label>
                            <textarea 
                                value={editingProduct.description} 
                                onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                                placeholder="Descripción del producto (opcional)"
                                rows="3"
                            />
                        </div>
                        
                        {/* Fila 1: Stock Actual + Umbral de Stock Bajo */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: window.innerWidth <= 590 ? '1fr' : '1fr 1fr',
                            gap: '15px',
                            marginBottom: '15px'
                        }}>
                            <div className="form-group" style={{marginBottom: 0}}>
                                <label>Stock Actual {selectedProduct?.unit && `(${selectedProduct.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'})`}</label>
                                <input 
                                    type="number" 
                                    value={selectedProduct?.unit === 'g' ? (editingProduct.stock / 1000).toFixed(3) : 
                                           selectedProduct?.unit === 'ml' ? (editingProduct.stock / 1000).toFixed(3) : 
                                           editingProduct.stock} 
                                    readOnly
                                    disabled
                                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                                    placeholder={`Stock actual en ${selectedProduct?.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'} (solo lectura)`}
                                />
                                <small style={{ color: '#666', fontSize: '0.9em' }}>
                                    Este campo es solo informativo. El stock se actualiza automáticamente con las ventas y movimientos de inventario.
                                </small>
                            </div>
                            
                            <div className="form-group" style={{marginBottom: 0}}>
                                <label>Umbral de Stock Bajo * {selectedProduct?.unit && `(${selectedProduct.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'})`}</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={editingProduct.lowStockThreshold} 
                                    onChange={e => {
                                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                        setEditingProduct({...editingProduct, lowStockThreshold: value});
                                    }} 
                                    placeholder={`Nivel de stock para alertas en ${selectedProduct?.unit === 'g' ? 'Kg' : selectedProduct.unit === 'ml' ? 'L' : 'Unidades'} (0 o mayor)`}
                                    min="0"
                                    required 
                                />
                                <small className="form-helper-text">
                                    Cantidad mínima de stock antes de mostrar alertas en el Dashboard
                                </small>
                            </div>
                        </div>

                        {/* Fila 2: Multiplicador para Stock Alto + Rendimiento de la Receta */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: window.innerWidth <= 590 ? '1fr' : '1fr 1fr',
                            gap: '15px',
                            marginBottom: '15px'
                        }}>
                            <div className="form-group" style={{marginBottom: 0}}>
                                <label>Multiplicador para Stock Alto *</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={editingProduct.highStockMultiplier} 
                                    onChange={e => {
                                        const value = e.target.value === '' ? 2.0 : parseFloat(e.target.value) || 2.0;
                                        setEditingProduct({...editingProduct, highStockMultiplier: value});
                                    }} 
                                    placeholder="Ej: 2.0 = duplicar, 3.5 = triplicar y medio"
                                    min="1.1"
                                    required 
                                />
                                <small className="form-helper-text">
                                    Factor para calcular stock alto: Stock Alto = Umbral × Multiplicador.
                                </small>
                            </div>

                            <div className="form-group" style={{marginBottom: 0}}>
                                <label>Rendimiento de la Receta *</label>
                                <input 
                                    type="number" 
                                    value={editingProduct.recipeYield} 
                                    onChange={e => {
                                        const value = e.target.value === '' ? 1 : parseInt(e.target.value) || 1;
                                        setEditingProduct({...editingProduct, recipeYield: value});
                                    }} 
                                    placeholder="Unidades que produce esta receta"
                                    min="1"
                                    required 
                                />
                                <small className="form-helper-text">
                                    Número de unidades que produce una ejecución completa de esta receta
                                </small>
                            </div>
                        </div>

                        {/* Sección de Recetas */}
                        {selectedProduct && (
                            <div className="recipe-section">
                                <h4>Receta del Producto</h4>
                                
                                <div className="current-ingredients">
                                    <h5>Ingredientes Actuales:</h5>
                                    {(!editingProduct.recipe_ingredients || editingProduct.recipe_ingredients.length === 0) ? (
                                        <p>No hay ingredientes en la receta.</p>
                                    ) : (
                                        <div className="ingredients-list" style={{
                                            display: 'grid',
                                            gridTemplateColumns: window.innerWidth >= 810 ? '1fr 1fr' : '1fr',
                                            gap: '10px'
                                        }}>
                                            {editingProduct.recipe_ingredients.map((ingredient, index) => (
                                                <div key={index} className="ingredient-item">
                                                    <div className="ingredient-display">
                                                        <span className="ingredient-info">
                                                            <strong>{ingredient.ingredient_name}</strong>: {ingredient.quantity} {ingredient.unit}
                                                        </span>
                                                        <div className="ingredient-actions">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (ingredient.id) {
                                                                        deleteIngredientFromRecipe(ingredient.id);
                                                                    } else {
                                                                        const updatedIngredients = editingProduct.recipe_ingredients.filter((_, i) => i !== index);
                                                                        setEditingProduct(prev => ({
                                                                            ...prev,
                                                                            recipe_ingredients: updatedIngredients
                                                                        }));
                                                                    }
                                                                }}
                                                                className="action-button delete small"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="add-ingredient-form">
                                    <h5>Agregar Ingredientes:</h5>
                                    {newIngredients.map((newIngredient, index) => (
                                        <div key={index} className="form-row ingredient-row">
                                            <div className="form-group">
                                                <label>Ingrediente:</label>
                                                <Select
                                                    value={newIngredient.ingredient}
                                                    onChange={(selectedOption) => handleIngredientChange(selectedOption, index)}
                                                    options={availableIngredients.map(ingredient => ({
                                                            value: ingredient.id,
                                                            label: `${ingredient.name} (Stock: ${ingredient.stock} ${ingredient.unit})`,
                                                            unit: ingredient.unit,
                                                            suggested_unit: ingredient.suggested_unit
                                                        }))}
                                                    placeholder="Buscar ingrediente..."
                                                    isClearable
                                                    isSearchable
                                                    className="searchable-select"
                                                    menuPortalTarget={document.body}
                                                    styles={{
                                                        menuPortal: (base) => ({ ...base, zIndex: 9999 })
                                                    }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Cantidad:</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Cantidad"
                                                    value={newIngredient.quantity}
                                                    onChange={(e) => updateIngredientField(index, 'quantity', e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Unidad:</label>
                                                <select
                                                    value={newIngredient.unit}
                                                    onChange={(e) => updateIngredientField(index, 'unit', e.target.value)}
                                                >
                                                    <option value="g">Gramos</option>
                                                    <option value="ml">Mililitros</option>
                                                    <option value="unidades">Unidades</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>&nbsp;</label>
                                                <div className="ingredient-actions">
                                                    {index === newIngredients.length - 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={addNewIngredientField}
                                                            className="action-button secondary small"
                                                            title="Agregar otro ingrediente"
                                                        >
                                                            +
                                                        </button>
                                                    )}
                                                    {newIngredients.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeIngredientField(index)}
                                                            className="action-button delete small"
                                                            title="Eliminar este ingrediente"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            onClick={addIngredientsToRecipe}
                                            className="action-button primary"
                                        >
                                            Agregar Todos los Ingredientes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="button-group" style={{
                            display: 'flex',
                            gap: '1rem',
                            flexDirection: window.innerWidth <= 590 ? 'column' : 'row',
                            flexWrap: 'wrap'
                        }}>
                            <button type="submit" className="action-button primary" style={{
                                width: window.innerWidth <= 590 ? '100%' : 'auto',
                                flex: window.innerWidth > 590 ? '1' : 'none'
                            }}>
                                Guardar Cambios
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="action-button secondary"
                                style={{
                                    width: window.innerWidth <= 590 ? '100%' : 'auto',
                                    flex: window.innerWidth > 590 ? '1' : 'none'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteProduct}
                                className="action-button delete"
                                style={{
                                    width: window.innerWidth <= 590 ? '100%' : 'auto',
                                    flex: window.innerWidth > 590 ? '1' : 'none'
                                }}
                            >
                                Eliminar Producto
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal de confirmación para eliminar producto */}
            {showDeleteModal && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                            ¿Estás seguro que desea eliminar este producto?
                        </h3>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteProduct}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}

            {/* Modal de confirmación para eliminar todos los productos */}
            {showDeleteAllModal && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        maxWidth: '400px',
                        width: '90%'
                    }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 'bold' }}>
                            ¿Estás seguro de eliminar todos los productos?
                        </h3>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowDeleteAllModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteAllProducts}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                Eliminar Todos
                            </button>
                        </div>
                    </div>
                </div>, document.body
            )}
        </>
    );
};

export default EditarProductos;
