import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './Ver_Reportes_De_Faltantes.css';

const Ver_Reportes_De_Faltantes = ({ products }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await api.get('/low-stock-reports/');
                setReports(response.data);
            } catch (err) {
                setError('No se pudieron cargar los reportes.');
                console.error('Error fetching low stock reports:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    const handleResolve = async (reportId) => {
        try {
            await api.patch(`/low-stock-reports/${reportId}/update/`, { is_resolved: true });
            setReports(reports.map(r => r.id === reportId ? { ...r, is_resolved: true } : r));
        } catch (err) {
            setError('Error al marcar como resuelto.');
            console.error('Error resolving report:', err);
        }
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este reporte?')) return;
        
        try {
            await api.delete(`/low-stock-reports/${reportId}/delete/`);
            setReports(reports.filter(r => r.id !== reportId));
        } catch (err) {
            setError('Error al eliminar el reporte.');
            console.error('Error deleting report:', err);
        }
    };

    if (loading) {
        return (
            <div className="px-4 py-4 max-w-full mx-auto">
                <div className="text-center py-10 text-lg text-gray-600">Cargando reportes...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="px-4 py-4 max-w-full mx-auto">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center my-4">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-full mx-2">
            <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xl font-bold text-gray-800">
                    Reportes de Faltantes
                </h2>
                <span className="text-sm font-semibold text-red-600">
                    {reports.filter(r => !r.is_resolved).length} pendientes
                </span>
            </div>
            
            {reports.length === 0 ? (
                <div className="text-center py-6 text-base text-gray-600">
                    <p>No hay reportes pendientes</p>
                </div>
            ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {reports.slice(0, 1).map((report, index) => {
                        const productos = report.products_detail?.filter(p => p.category === 'Producto') || [];
                        const insumos = report.products_detail?.filter(p => p.category === 'Insumo') || [];
                        
                        return (
                            <div 
                                key={report.id} 
                                className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border-l-4 flex flex-col ${
                                    report.is_resolved 
                                        ? 'border-green-500 opacity-70' 
                                        : 'border-red-500'
                                }`}
                            >
                                {/* Header con número */}
                                <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-600">#{index + 1}</span>
                                    {report.is_resolved && (
                                        <span className="text-xs font-semibold text-green-700 flex items-center gap-0.5">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Resuelto
                                        </span>
                                    )}
                                </div>
                                
                                {/* Contenido */}
                                <div className="p-2 flex-1 flex flex-col gap-2">
                                    {/* Productos e Insumos */}
                                    <div className="space-y-1">
                                        {insumos.length > 0 && (
                                            <div className="text-xs">
                                                <span className="font-bold text-blue-700">
                                                    {insumos.length === 1 ? 'Insumo:' : 'Insumos:'}
                                                </span>
                                                <div className="text-gray-800 mt-0.5">
                                                    {insumos.map(i => i.name).join(', ')}
                                                </div>
                                            </div>
                                        )}
                                        {productos.length > 0 && (
                                            <div className="text-xs">
                                                <span className="font-bold text-orange-700">
                                                    {productos.length === 1 ? 'Producto:' : 'Productos:'}
                                                </span>
                                                <div className="text-gray-800 mt-0.5">
                                                    {productos.map(p => p.name).join(', ')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Usuario y Fecha */}
                                    <div className="space-y-0.5 text-xs text-gray-500 border-t border-gray-100 pt-1.5">
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span className="truncate">{report.reported_by}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="truncate">
                                                {new Date(report.created_at).toLocaleDateString('es-AR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                })}, {new Date(report.created_at).toLocaleTimeString('es-AR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Mensaje */}
                                    <div className="text-xs text-gray-700 italic bg-gray-50 px-2 py-1.5 rounded border-l-2 border-gray-300">
                                        "{report.message}"
                                    </div>
                                </div>
                                
                                {/* Footer con botón */}
                                {!report.is_resolved ? (
                                    <div className="px-2 pb-2">
                                        <button 
                                            onClick={() => handleResolve(report.id)} 
                                            className="w-full px-2 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded text-xs font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:shadow-md flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Marcar como Resuelto
                                        </button>
                                    </div>
                                ) : (
                                    <div className="px-2 pb-2">
                                        <button 
                                            onClick={() => handleDeleteReport(report.id)} 
                                            className="w-full px-2 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded text-xs font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:shadow-md flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Eliminar Reporte
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Ver_Reportes_De_Faltantes;
