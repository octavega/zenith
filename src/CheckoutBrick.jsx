import React from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// REEMPLAZÁ CON TU PUBLIC KEY DE PRUEBA (Empieza con TEST-)
initMercadoPago('TEST-2d6514c2-7776-4544-ac36-99f2c73d55e2', { locale: 'es-AR' });

const CheckoutBrick = ({ precioAPagar, onPaymentSuccess }) => {
  // Configuración inicial del monto
  const initialization = {
    amount: precioAPagar, 
  };

  // Qué medios de pago queremos mostrar
  const customization = {
    paymentMethods: {
      creditCard: "all",
      debitCard: "all",
      ticket: "all",
      bankTransfer: "all",
      mercadoPago: "all",
    },
  };

  // Esta función se ejecuta cuando el usuario hace clic en "Pagar" en el formulario
  const onSubmit = async ({ formData }) => {
    return new Promise((resolve, reject) => {
      // Le mandamos los datos de la tarjeta a nuestro servidor Node.js
      fetch("http://localhost:3001/process_payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("Respuesta del servidor:", data);
          if (data.status === "approved") {
            alert("¡Excelente! Tu pago fue aprobado.");
            onPaymentSuccess(data.id);
            // ¡Acá es donde después vas a actualizar tu base de datos de Supabase!
          } else {
            alert("El pago quedó en estado: " + data.status);
          }
          resolve();
        })
        .catch((error) => {
          console.error("Error en la petición:", error);
          reject();
        });
    });
  };

  const onError = async (error) => {
    console.log("Error en el Brick:", error);
  };

  const onReady = async () => {
    console.log("¡Formulario cargado y listo para usar!");
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Payment
        initialization={initialization}
        customization={customization}
        onSubmit={onSubmit}
        onReady={onReady}
        onError={onError}
      />
    </div>
  );
};

export default CheckoutBrick;