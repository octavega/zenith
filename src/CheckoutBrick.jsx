import React, { useState } from 'react';

const CheckoutBrick = ({
  precioAPagar,
  titulo = 'Pago Zenith Alquileres',
  descripcion = 'Pago realizado desde Zenith Alquileres',
  payerEmail,
  externalReference,
  metadata,
  pendingPayment,
}) => {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const iniciarPago = async () => {
    setError('');

    const monto = Number(precioAPagar);

    if (!monto || monto <= 0) {
      setError('El monto a pagar no es válido.');
      return;
    }

    try {
      setCargando(true);

      const response = await fetch('http://localhost:3001/create_preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: monto,
          title: titulo,
          description: descripcion,
          payerEmail,
          externalReference,
          metadata,
        }),
      });

      const data = await response.json();

      console.log('Respuesta create_preference:', data);

      if (!response.ok) {
        throw new Error(data.message || data.error || 'No se pudo crear la preferencia.');
      }

      if (!data.redirectUrl) {
        throw new Error('Mercado Pago no devolvió una URL de pago.');
      }

      localStorage.setItem(
        'zenith_pago_pendiente',
        JSON.stringify({
          ...pendingPayment,
          preferenceId: data.preferenceId,
          externalReference,
          monto,
          createdAt: new Date().toISOString(),
        })
      );

      window.location.href = data.redirectUrl;
    } catch (err) {
      console.error('Error iniciando Checkout Pro:', err);
      setError(err.message || 'Error al iniciar el pago.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button
        type="button"
        className="btn-submit"
        onClick={iniciarPago}
        disabled={cargando}
        style={{
          width: '100%',
          opacity: cargando ? 0.7 : 1,
          cursor: cargando ? 'not-allowed' : 'pointer',
        }}
      >
        {cargando ? 'Redirigiendo a Mercado Pago...' : 'Pagar con Mercado Pago'}
      </button>

      {error && (
        <p style={{ color: '#e74c3c', marginTop: '10px', fontSize: '0.9rem' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default CheckoutBrick;