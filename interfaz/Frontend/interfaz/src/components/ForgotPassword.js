import React, { useState } from 'react';
import { resetWithToken } from '../services/api';

const ForgotPassword = ({ onDone }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email || !newPassword) {
      setError('Completa todos los campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      const resp = await resetWithToken({ email, new_password: newPassword });
      if (resp && resp.data && resp.data.success) {
        setMessage('Contraseña restablecida correctamente. Ya podés iniciar sesión.');
      
      } else {
        setError(resp?.data?.error?.message || 'Error en la petición');
      }
    } catch (err) {
      console.error('Error al resetear contraseña:', err?.response?.data || err.message || err);
      setError(err?.response?.data?.error?.message || 'Error en la petición');
    }
  };

  return (
    <div className="panel">
      <h2>Recuperar Contraseña</h2>
      {/* Token generation removed: using tokenless reset flow */}
      <form onSubmit={handleSubmit} className="form-vertical">
        <label>Correo asociado</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

  {/* Token removed from UI - not required in the new flow */}

        <label>Nueva contraseña</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />

        <label>Confirmar contraseña</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />

        {/* Captcha eliminado - formulario simple de restablecimiento */}

        <div style={{ marginTop: 12 }}>
          <button type="submit" className="action-button primary">Restablecer contraseña</button>
          <button type="button" className="action-button" onClick={() => onDone && onDone()}>Cancelar</button>
        </div>
        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
};

export default ForgotPassword;
