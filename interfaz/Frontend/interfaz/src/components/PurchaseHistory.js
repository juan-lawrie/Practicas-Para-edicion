
import React from 'react';

const PurchaseHistory = ({ purchases, onDeletePurchase, confirmDelete, onCancelDelete, userRole }) => {
    // Ordenar las compras por fecha, de la más reciente a la más antigua
    const sortedPurchases = [...purchases].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return (
        <div className="purchase-history-container">
            <h3>Historial de Compras</h3>
            {sortedPurchases.length === 0 ? (
                <p>No hay compras en el historial.</p>
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
                            <div className="history-field">{purchase.supplier_name || 'N/A'}</div>
                            <div className="history-field">{new Date(purchase.created_at).toLocaleDateString()}</div>
                            <div className="history-field items-col">
                                <ul className="inner-items-list">
                                    {purchase.items && purchase.items.map((item, index) => (
                                        <li key={index}>
                                            {item.productName || item.product_name} ({item.quantity} x ${item.unitPrice || item.price})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="history-field">${(purchase.total || purchase.total_amount || 0).toFixed(2)}</div>
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
