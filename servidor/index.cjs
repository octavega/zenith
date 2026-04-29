/* eslint-env node */
const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Payment } = require("mercadopago"); // Cambiamos Preference por Payment

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// REEMPLAZÁ CON TU ACCESS TOKEN DE PRUEBA (El que usábamos antes)
const client = new MercadoPagoConfig({ accessToken: 'TEST-6187011614622084-030621-0d4b10b3fea3ff5e42b981aefc37c907-1146546771' });

// Esta es la nueva ruta que procesará la tarjeta
app.post("/process_payment", async (req, res) => {
  console.log("-----------------------------------------");
  console.log("📥 Recibiendo datos de la tarjeta desde React...");

  try {
    const payment = new Payment(client);
    
    // Armamos el paquete con los datos exactos que nos manda el formulario de React
    const body = {
      transaction_amount: req.body.transaction_amount,
      token: req.body.token,
      description: req.body.description,
      installments: req.body.installments,
      payment_method_id: req.body.payment_method_id,
      issuer_id: req.body.issuer_id,
      payer: {
        email: req.body.payer.email,
        identification: {
          type: req.body.payer.identification.type,
          number: req.body.payer.identification.number,
        },
      },
    };

    console.log("⏳ Procesando pago...");
    const result = await payment.create({ body });
    
    console.log(`✅ ¡Pago procesado! Estado: ${result.status}`);
    
    // Le devolvemos a React cómo salió el pago
    res.json({
      status: result.status,
      status_detail: result.status_detail,
      id: result.id,
    });

  } catch (error) {
    console.error("❌ ERROR AL COBRAR:");
    console.error(error);
    res.status(500).json({ error: "Error interno al procesar el pago" });
  }
});

app.listen(port, () => {
  console.log(`✅ Servidor de Mercado Pago (Bricks) corriendo en el puerto ${port}`);
});