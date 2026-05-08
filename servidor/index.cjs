require('dotenv').config();
/* eslint-env node */

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

/**
 * Checkout Pro:
 * El frontend llama a este endpoint, el backend crea una preferencia
 * y devuelve la URL de Mercado Pago para redirigir al usuario.
 */
app.post("/create_preference", async (req, res) => {
  console.log("-----------------------------------------");
  console.log("📥 Creando preferencia de Checkout Pro...");

  try {
    const {
      amount,
      title,
      description,
      payerEmail,
      externalReference,
      metadata,
    } = req.body;

    const amountNumber = Number(amount);

    if (!amountNumber || amountNumber <= 0) {
      return res.status(400).json({
        error: "El monto es inválido.",
        received: amount,
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const preference = new Preference(client);

    const body = {
      items: [
        {
          title: title || "Pago Zenith Alquileres",
          description: description || "Pago realizado desde Zenith Alquileres",
          quantity: 1,
          currency_id: "ARS",
          unit_price: amountNumber,
        },
      ],

      payer: payerEmail
        ? {
            email: payerEmail,
          }
        : undefined,

      back_urls: {
        success: `${frontendUrl}/?mp_status=success`,
        failure: `${frontendUrl}/?mp_status=failure`,
        pending: `${frontendUrl}/?mp_status=pending`,
      },

    

      external_reference:
        externalReference || `zenith_${Date.now()}`,

      metadata: metadata || {},
    };

    console.log("⏳ Enviando preferencia a Mercado Pago...");
    const result = await preference.create({ body });

    console.log("✅ Preferencia creada:", result.id);

   res.json({
  preferenceId: result.id,
  initPoint: result.init_point,
  sandboxInitPoint: result.sandbox_init_point,

  // Usamos init_point, no sandbox_init_point
  redirectUrl: result.init_point,
});
  } catch (error) {
    console.error("❌ ERROR AL CREAR PREFERENCIA:");
    console.error("message:", error.message);
    console.error("status:", error.status);
    console.error("cause:", JSON.stringify(error.cause, null, 2));

    res.status(error.status || 500).json({
      error: "Error al crear la preferencia de Mercado Pago",
      message: error.message,
      status: error.status,
      cause: error.cause,
    });
  }
});

app.listen(port, () => {
  console.log(`✅ Servidor de Mercado Pago Checkout Pro corriendo en el puerto ${port}`);
});