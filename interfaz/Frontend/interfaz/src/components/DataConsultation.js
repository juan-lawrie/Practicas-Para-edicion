
import React, { useState, useEffect } from 'react';
import { getPurchaseHistory } from '../services/api';
import { formatMovementDate } from '../utils/date';

const PurchaseHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await getPurchaseHistory();
                setHistory(response.data);
            } catch (err) {
                setError('No se pudo cargar el historial de compras.');
                console.error('Error fetching purchase history:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    if (loading) {
        return <div>Cargando historial de compras...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="purchase-history-container">
            <h3>Historial de Compras Aprobadas</h3>
            {history.length === 0 ? (
                <p>No hay compras en el historial.</p>
            ) : (
                <ul className="list-container">
                    {history.map(purchase => (
                        <li key={purchase.id} className="purchase-list-item">
                            <div className="purchase-header">
                                <strong>Compra #{purchase.id} - {formatMovementDate(purchase.created_at)}</strong>
                                <div>
                                    <span>Solicitado por: {purchase.user}</span>
                                </div>
                            </div>
                            <div className="purchase-details">
                                <p><strong>Proveedor:</strong> {purchase.supplier}</p>
                                <p><strong>Aprobado por:</strong> {purchase.approved_by} el {formatMovementDate(purchase.approved_at)}</p>
                            </div>
                            <div className="purchase-items">
                                <strong>Items:</strong>
                                <ul>
                                    {purchase.items.map((item, index) => (
                                        <li key={index}>
                                            {item.productName} - Cantidad: {item.quantity} - Precio U: ${item.unitPrice}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="purchase-total-display">
                                <strong>Total: ${purchase.total}</strong>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PurchaseHistory;