
import React, { useState, useEffect } from 'react';
import { getCurrentUserData } from '../services/api';
import '../estilos.css';

const MyUserData = () => {
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const data = await getCurrentUserData();
                if (data) {
                    setUserData(data);
                } else {
                    setError('No se pudieron cargar los datos del usuario.');
                }
            } catch (err) {
                setError('Error al conectar con el servidor para obtener los datos del usuario.');
                console.error(err);
            }
        };

        fetchUserData();
    }, []);

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!userData) {
        return <div>Cargando datos del usuario...</div>;
    }

    return (
        <div className="user-data-container">
            <h2>Datos de Mi Usuario</h2>
            <div className="user-data-card">
                <p><strong>Nombre de Usuario:</strong> {userData.username}</p>
                <p><strong>Email:</strong> {userData.email}</p>
                <p><strong>Rol:</strong> {userData.role ? userData.role.name : 'No asignado'}</p>
                <p><strong>Estado:</strong> {userData.is_active ? 'Activo' : 'Inactivo'}</p>
            </div>
        </div>
    );
};

export default MyUserData;
