
import React from 'react';

const PurchaseRequests = ({ purchases, onApprove, onReject, userRole }) => {
    return (
        <div className="purchase-requests-container">
            <h3>Solicitudes de Compra Pendientes</h3>
            {purchases.length === 0 ? (
                <p>No hay solicitudes de compra pendientes.</p>
            ) : (
                <ul className="list-container">
                    {purchases.map(purchase => (
                        <li key={purchase.id} className="list-item">
                            <div className="purchase-details">
                                <div>
                                    <strong>Proveedor:</strong> {purchase.supplier_name || 'N/A'}
                                </div>
                                <div>
                                    <strong>Fecha:</strong> {new Date(purchase.created_at).toLocaleDateString()}
                                </div>
                                <div>
                                    <strong>Total:</strong> ${(purchase.total || purchase.total_amount || 0).toFixed(2)}
                                </div>
                                <ul className="purchase-items">
                                    {purchase.items.map((item, index) => (
                                        <li key={index}>
                                            {item.productName || item.product_name || item.product} - Cantidad: {item.quantity} - Precio: ${item.unitPrice}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {userRole === 'Gerente' && (
                                <div className="button-group">
                                    <button onClick={() => onApprove(purchase.id)} className="action-button primary">Aprobar</button>
                                    <button onClick={() => onReject(purchase.id)} className="action-button secondary">Rechazar</button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PurchaseRequests;
