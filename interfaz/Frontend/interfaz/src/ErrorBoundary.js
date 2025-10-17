import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Puedes enviar logs a un endpoint aquí si lo deseas
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      // Mostrar fallback simple que permite al usuario intentar volver al Login
      return (
        <div style={{padding: 40, textAlign: 'center'}}>
          <h2>Ocurrió un error cargando la interfaz</h2>
          <p>Por favor, cierra sesión y vuelve a iniciar sesión. Si el problema persiste, recarga la página.</p>
          <button onClick={() => { try { window.localStorage.clear(); } catch(e){}; window.location.reload(); }}>Recargar / Limpiar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
