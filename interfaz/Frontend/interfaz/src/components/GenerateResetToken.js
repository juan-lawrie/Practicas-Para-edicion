import React, { useState } from 'react';
import api from '../services/api';

const GenerateResetToken = ({ onDone }) => {
  const [targetEmail, setTargetEmail] = useState('');
  const [error, setError] = useState('');
  const [tokenPlain, setTokenPlain] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setTokenPlain(null);
    try {
      const resp = await api.post('/auth/tokens/generate/', { target_email: targetEmail });
      if (resp && resp.data && resp.data.token) {
        setTokenPlain(resp.data.token);
        setExpiresAt(resp.data.expires_at);
      } else {
        setError('No se recibió token del servidor');
      }
    } catch (err) {
      console.error('Error generando token:', err?.response?.data || err.message || err);
      const msg = err?.response?.data?.error?.message || 'Error generando token';
      setError(msg);
    }
  };

  return (
    <div className="panel">
      <h2>Generar token de recuperación (Gerente)</h2>
      {!tokenPlain ? (
        <form onSubmit={handleGenerate} className="form-vertical">
          <label>Correo del usuario</label>
          <input type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} required />
          <div style={{ marginTop: 12 }}>
            <button type="submit" className="action-button primary">Generar token</button>
            <button type="button" className="action-button" onClick={() => onDone && onDone()}>Cancelar</button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </form>
      ) : (
        <div>
          <p className="info">El token se mostrará solo una vez. Copialo y entregalo al usuario por un canal seguro.</p>
          <div className="token-box">{tokenPlain}</div>
          <p>Expira en: {new Date(expiresAt).toLocaleString()}</p>
          <div>
            <button onClick={() => { setTokenPlain(null); setExpiresAt(null); setTargetEmail(''); onDone && onDone(); }} className="action-button">He copiado el token</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateResetToken;
