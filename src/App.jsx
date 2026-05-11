import React, { useState, useEffect } from 'react'; // Agregamos useEffect
import './App.css';
import { supabase } from './supabaseClient'; // Importamos la conexión
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import CheckoutBrick from './CheckoutBrick';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// MINI COMPONENTE: Galería de Imágenes Interactiva (Limpio con CSS)
const GaleriaInmueble = ({ fotos }) => {
  const [indiceActivo, setIndiceActivo] = React.useState(0);

  if (!fotos || fotos.length === 0) {
    return (
      <div className="galeria-vacia">
        <span style={{ fontSize: '3rem' }}>📷</span>
        <p>Sin fotos disponibles</p>
      </div>
    );
  }

  return (
    <div className="galeria-container">
      {/* Foto Principal (La Portada) */}
      <div className="foto-principal-caja">
        <img
          src={fotos[indiceActivo]}
          alt="Principal"
          className="foto-principal-img"
        />
      </div>

      {/* Tira de Miniaturas (Las fotitos de abajo) */}
      {fotos.length > 1 && (
        <div className="tira-miniaturas">
          {fotos.map((foto, index) => (
            <img
              key={index}
              src={foto}
              alt={`Miniatura ${index + 1}`}
              onClick={() => setIndiceActivo(index)}
              className={`miniatura-img ${indiceActivo === index ? 'activa' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// MINI COMPONENTE: Calendario de Disponibilidad
const CalendarioOcupacion = ({ propiedadId, contratos, reservas }) => {
  const [fechaActual, setFechaActual] = React.useState(new Date());

  // 1. Buscamos qué contratos de largo plazo pertenecen a esta casa y están activos
  const contratosPropiedad = contratos.filter(c =>
    c.propiedadId === propiedadId &&
    c.estado === 'activo'
  );

  // ---> NUEVO: 2. Buscamos qué reservas temporales están confirmadas (las canceladas se ignoran)
  const reservasPropiedad = (reservas || []).filter(r =>
    r.propiedadId === propiedadId &&
    r.estado === 'Confirmada'
  );

  const mes = fechaActual.getMonth();
  const anio = fechaActual.getFullYear();

  // Calculamos los días para dibujar la cuadrícula del mes
  const primerDiaDelMes = new Date(anio, mes, 1).getDay(); // 0 (Domingo) a 6 (Sábado)
  const diasEnElMes = new Date(anio, mes + 1, 0).getDate(); // Total de días del mes

  const diasMesaArray = [];
  for (let i = 0; i < primerDiaDelMes; i++) diasMesaArray.push(null); // Espacios vacíos al principio
  for (let i = 1; i <= diasEnElMes; i++) diasMesaArray.push(i); // Los días reales

  const irMesAnterior = () => setFechaActual(new Date(anio, mes - 1, 1));
  const irMesSiguiente = () => setFechaActual(new Date(anio, mes + 1, 1));
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // 3. Motor que verifica si un día específico cae dentro de algún contrato O reserva
  const estaOcupado = (dia) => {
    if (!dia) return false;
    const fechaCelda = new Date(anio, mes, dia);
    fechaCelda.setHours(0, 0, 0, 0);

    // Chequeamos si choca con un contrato largo
    const ocupadoContrato = contratosPropiedad.some(contrato => {
      const inicio = new Date(contrato.fechaInicio + 'T00:00:00');
      const fin = new Date(contrato.fechaFin + 'T00:00:00');
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(0, 0, 0, 0);
      return fechaCelda >= inicio && fechaCelda <= fin;
    });

    // Chequeamos si choca con una reserva temporal
    const ocupadoReserva = reservasPropiedad.some(reserva => {
      const inicio = new Date(reserva.fechaInicio + 'T00:00:00');
      const fin = new Date(reserva.fechaFin + 'T00:00:00');
      inicio.setHours(0, 0, 0, 0);
      fin.setHours(0, 0, 0, 0);
      return fechaCelda >= inicio && fechaCelda <= fin;
    });

    // Si está ocupado por CUALQUIERA de los dos, devolvemos true (rojo)
    return ocupadoContrato || ocupadoReserva;
  };

  return (
    <div className="calendario-container">

      <div className="calendario-header">
        <button type="button" onClick={irMesAnterior} className="calendario-btn">&lt;</button>
        <strong className="calendario-mes">{nombresMeses[mes]} {anio}</strong>
        <button type="button" onClick={irMesSiguiente} className="calendario-btn">&gt;</button>
      </div>

      <div className="calendario-grid">
        {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => <div key={d} className="calendario-dia-semana">{d}</div>)}

        {diasMesaArray.map((dia, index) => {
          const ocupado = estaOcupado(dia);

          let claseCelda = 'calendario-celda ';
          if (!dia) claseCelda += 'vacia';
          else if (ocupado) claseCelda += 'ocupada';
          else claseCelda += 'disponible';

          return (
            <div key={index} className={claseCelda}>
              {dia || ''}
            </div>
          );
        })}
      </div>

      <div className="calendario-leyenda">
        <span className="leyenda-item disponible">
          <div className="leyenda-color"></div> Disponible
        </span>
        <span className="leyenda-item ocupada">
          <div className="leyenda-color"></div> Ocupado
        </span>
      </div>
    </div>
  );
};

const estadosReservaOcupada = ['Confirmada', 'Pendiente', 'Pagada', 'Aprobada'];

const normalizarFecha = (valor) => {
  if (!valor) return null;

  const fecha = valor instanceof Date
    ? new Date(valor)
    : new Date(`${valor}T00:00:00`);

  fecha.setHours(0, 0, 0, 0);
  return fecha;
};

const fechaAInput = (date) => {
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const verificarDisponibilidadReservaSupabase = async (propiedadId, fechaInicio, fechaFin) => {
  const inicioNuevo = normalizarFecha(fechaInicio);
  const finNuevo = normalizarFecha(fechaFin);

  if (!inicioNuevo || !finNuevo) return false;
  if (finNuevo < inicioNuevo) return false;

  const { data: reservasBD, error: errorReservas } = await supabase
    .from('reservas')
    .select('fecha_inicio, fecha_fin, estado')
    .eq('propiedad_id', propiedadId)
    .in('estado', estadosReservaOcupada);

  if (errorReservas) {
    console.error('Error al verificar reservas:', errorReservas.message);
    return false;
  }

  const { data: contratosBD, error: errorContratos } = await supabase
    .from('contratos')
    .select('fecha_inicio, fecha_fin, estado')
    .eq('propiedad_id', propiedadId)
    .eq('estado', 'activo');

  if (errorContratos) {
    console.error('Error al verificar contratos:', errorContratos.message);
    return false;
  }

  const hayCruceReserva = (reservasBD || []).some(reserva => {
    const inicioExistente = normalizarFecha(reserva.fecha_inicio);
    const finExistente = normalizarFecha(reserva.fecha_fin);

    return inicioNuevo <= finExistente && finNuevo >= inicioExistente;
  });

  const hayCruceContrato = (contratosBD || []).some(contrato => {
    const inicioExistente = normalizarFecha(contrato.fecha_inicio);
    const finExistente = normalizarFecha(contrato.fecha_fin);

    return inicioNuevo <= finExistente && finNuevo >= inicioExistente;
  });

  return !hayCruceReserva && !hayCruceContrato;
};

function App() {

  // PRUEBA DE CONEXIÓN A SUPABASE
  useEffect(() => {
    const probarConexion = async () => {
      console.log("Intentando conectar con Supabase...");
      const { data, error } = await supabase.from('usuarios').select('*');

      if (error) {
        console.error("Error al conectar:", error.message);
      } else {
        console.log("¡Conexión exitosa! Usuarios en la base de datos real:", data);
      }
    };

    probarConexion();
  }, []);

  // Estado para guardar el archivo físico de la foto de perfil
  const [archivoFotoPerfil, setArchivoFotoPerfil] = useState(null);

  // Manejo de estado para alternar vistas
  const [vistaActual, setVistaActual] = useState('inicio');
  // Estado unificado para los formularios
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    password: '',
    telefono: '',
    provincia: '',
    rol: 'inquilino'
  });
  const provinciasYCiudades = {
    "Buenos Aires": ["La Plata", "Mar del Plata", "Bahía Blanca", "San Nicolás", "Tandil"],
    "Catamarca": ["San Fernando del Valle de Catamarca", "Belén", "Tinogasta"],
    "Chaco": ["Resistencia", "Presidencia Roque Sáenz Peña", "Villa Ángela"],
    "Chubut": ["Rawson", "Trelew", "Puerto Madryn", "Comodoro Rivadavia", "Esquel"],
    "Córdoba": ["Córdoba", "Villa Carlos Paz", "Río Cuarto", "Alta Gracia", "Villa María"],
    "Corrientes": ["Corrientes", "Goya", "Paso de los Libres", "Mercedes"],
    "Entre Ríos": ["Paraná", "Concordia", "Gualeguaychú", "Concepción del Uruguay"],
    "Formosa": ["Formosa", "Clorinda", "Pirané"],
    "Jujuy": ["San Salvador de Jujuy", "Palpalá", "Perico", "Libertador General San Martín"],
    "La Pampa": ["Santa Rosa", "General Pico", "Toay"],
    "La Rioja": ["La Rioja", "Chilecito", "Aimogasta"],
    "Mendoza": ["Mendoza", "Godoy Cruz", "Maipú", "San Rafael", "Luján de Cuyo"],
    "Misiones": ["Posadas", "Oberá", "Eldorado", "Puerto Iguazú"],
    "Neuquén": ["Neuquén", "Cutral Có", "San Martín de los Andes", "Zapala"],
    "Río Negro": ["Viedma", "General Roca", "Bariloche", "Cipolletti"],
    "Salta": ["Salta", "Orán", "Tartagal", "Metán"],
    "San Juan": ["San Juan", "Rawson", "Rivadavia"],
    "San Luis": ["San Luis", "Villa Mercedes", "Merlo"],
    "Santa Cruz": ["Río Gallegos", "Caleta Olivia", "El Calafate"],
    "Santa Fe": ["Santa Fe", "Rosario", "Rafaela", "Venado Tuerto"],
    "Santiago del Estero": ["Santiago del Estero", "La Banda", "Termas de Río Hondo", "Añatuya"],
    "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
    "Tucumán": ["San Miguel de Tucumán", "Tafí Viejo", "Yerba Buena", "Concepción"]
  };
  // Estado para el usuario que ha iniciado sesión
  const [usuarioLogueado, setUsuarioLogueado] = useState(() => {
  try {
    const usuarioGuardado = localStorage.getItem('zenith_usuario_logueado');
    return usuarioGuardado ? JSON.parse(usuarioGuardado) : null;
  } catch (error) {
    console.error('Error al recuperar sesión:', error);
    return null;
  }
});
useEffect(() => {
  try {
    if (usuarioLogueado) {
      localStorage.setItem('zenith_usuario_logueado', JSON.stringify(usuarioLogueado));
    } else {
      localStorage.removeItem('zenith_usuario_logueado');
    }
  } catch (error) {
    console.error('Error al guardar sesión:', error);
  }
}, [usuarioLogueado]);
  const provinciasArgentinas = [
    "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos",
    "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén",
    "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
    "Santiago del Estero", "Tierra del Fuego", "Tucumán"
  ];
  // Estado para manejar los mensajes de error de validación (RF5 y RF6)
  const [errores, setErrores] = useState({});

  // Estado para el formulario de validación de Propietario (RF7)
  const [datosPropietario, setDatosPropietario] = useState({
    cbu: '',
    dniFrente: null,
    dniReverso: null
  });

  // Estado para la Publicación de Inmuebles (RF8 a RF8.5)
  const [datosInmueble, setDatosInmueble] = useState({
    titulo: '', descripcion: '', tipoInmueble: '', tipoOperacion: 'largo_plazo',
    provincia: '', ciudad: '', barrio: '', direccion: '',
    superficieTotal: '', superficieCubierta: '', habitaciones: '', banos: '', pisos: '', dormitorios: '',
    servicios: [], // RF8.1
    alquilerMensual: '',
    deposito: '', tipoGarantia: '', // RF8.2 (Largo Plazo)
    pagoDiario: '', descuentoSemanal: '', descuentoMensual: '', // RF8.3 y RF8.4 (Temporal)
    fotos: null, escritura: null // RF8 y RF8.5
  });

  // Estados para Valoraciones de propiedades (las que ya tenías)
  const [valoraciones, setValoraciones] = useState([]);
  const [nuevaValoracion, setNuevaValoracion] = useState({ calificacion: 5, comentario: '' });

  // NUEVO: valoraciones entre usuarios
  const [valoracionesUsuarios, setValoracionesUsuarios] = useState([]);
  const [nuevaValoracionUsuario, setNuevaValoracionUsuario] = useState({ calificacion: 5, comentario: '' });

  // NUEVO: modal de perfil público
  const [perfilPublicoAbierto, setPerfilPublicoAbierto] = useState(null);

  // Configuración de Google Maps
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "AIzaSyBhR5fcXzmWSDPfoB5wDgjvtpugQLa13zg", // ⚠️ Recordá poner tu clave real acá
  });

  // Estado para guardar la posición del pin (Centrado en Santiago del Estero)
  const [posicionMapa, setPosicionMapa] = useState({ lat: -27.7833, lng: -64.2667 });

  // Función para mover el pin cuando el usuario hace clic en el mapa
  const handleMapClick = (evento) => {
    const nuevaLat = evento.latLng.lat();
    const nuevaLng = evento.latLng.lng();
    setPosicionMapa({ lat: nuevaLat, lng: nuevaLng });

    // CORRECCIÓN: Guardamos las coordenadas en tu estado datosInmueble
    setDatosInmueble(prevDatos => ({
      ...prevDatos,
      latitud: nuevaLat,
      longitud: nuevaLng
    }));
  };

  // Estado para la ventanita de pago de reservas
  const [modalReserva, setModalReserva] = useState(null);

  // 2. BASE DE DATOS (Ahora vacía, a la espera de Supabase)
  const [usuarios, setUsuarios] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [reservas, setReservas] = useState([]);



const obtenerRangosOcupados = (propiedadId) => {
  const rangosContratos = contratos
    .filter(c =>
      String(c.propiedadId) === String(propiedadId) &&
      c.estado === 'activo'
    )
    .map(c => ({
      inicio: normalizarFecha(c.fechaInicio),
      fin: normalizarFecha(c.fechaFin)
    }));

  const rangosReservas = reservas
    .filter(r =>
      String(r.propiedadId) === String(propiedadId) &&
      estadosReservaOcupada.includes(r.estado)
    )
    .map(r => ({
      inicio: normalizarFecha(r.fechaInicio),
      fin: normalizarFecha(r.fechaFin)
    }));

  return [...rangosContratos, ...rangosReservas];
};

const fechaEstaOcupada = (fecha, propiedadId) => {
  const dia = normalizarFecha(fecha);

  return obtenerRangosOcupados(propiedadId).some(rango =>
    dia >= rango.inicio && dia <= rango.fin
  );
};

const rangoEstaDisponible = (propiedadId, fechaInicio, fechaFin) => {
  const inicioNuevo = normalizarFecha(fechaInicio);
  const finNuevo = normalizarFecha(fechaFin);

  if (!inicioNuevo || !finNuevo) return false;
  if (finNuevo < inicioNuevo) return false;

  const hayCruce = obtenerRangosOcupados(propiedadId).some(rango =>
    inicioNuevo <= rango.fin && finNuevo >= rango.inicio
  );

  return !hayCruce;
};



useEffect(() => {
  const procesarRetornoMercadoPago = async () => {
    const params = new URLSearchParams(window.location.search);

    const mpStatus = params.get('mp_status');
    const status = params.get('status') || params.get('collection_status');
    const paymentId =
      params.get('payment_id') ||
      params.get('collection_id') ||
      params.get('merchant_order_id') ||
      `MP-${Date.now()}`;

    if (!mpStatus) return;

    const pendienteRaw = localStorage.getItem('zenith_pago_pendiente');

    if (!pendienteRaw) {
      alert('Mercado Pago volvió a la app, pero no se encontró la información del pago pendiente.');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const pagoPendiente = JSON.parse(pendienteRaw);

    const aprobado =
      mpStatus === 'success' ||
      status === 'approved';

    const rechazado =
      mpStatus === 'failure' ||
      status === 'rejected';

    const pendiente =
      mpStatus === 'pending' ||
      status === 'pending' ||
      status === 'in_process';

    const claveProcesado = `zenith_pago_procesado_${paymentId}`;

    if (localStorage.getItem(claveProcesado)) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (rechazado) {
      localStorage.removeItem('zenith_pago_pendiente');
      alert('El pago fue rechazado o cancelado.');
      setVistaActual(pagoPendiente.tipo === 'reserva' ? 'detalle-propiedad' : 'mis-alquileres');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (pendiente) {
      alert('El pago quedó pendiente. Cuando Mercado Pago lo confirme, deberías verificarlo desde el panel.');
      setVistaActual('mis-alquileres');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!aprobado) {
      alert('No se pudo confirmar el estado del pago.');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    try {
      if (pagoPendiente.tipo === 'cuota') {
        const infoPago = pagoPendiente.cuota;

        const nuevoPagoDB = {
          contrato_id: pagoPendiente.contratoId,
          concepto: infoPago.concepto,
          monto_total: infoPago.montoTotal,
          metodo: 'mercado_pago_checkout_pro',
          estado: 'Aprobado',
          comprobante_url: `Recibo MP: ${paymentId}`,
        };

        const { data, error } = await supabase
          .from('pagos')
          .insert([nuevoPagoDB])
          .select();

        if (error) throw error;

        if (data && data[0]) {
          const pagoCreado = data[0];

          setPagos(prev => [
            ...prev,
            {
              id: pagoCreado.id,
              contratoId: pagoCreado.contrato_id,
              concepto: pagoCreado.concepto,
              montoTotal: pagoCreado.monto_total,
              metodo: pagoCreado.metodo,
              fecha: new Date(pagoCreado.fecha_pago).toLocaleDateString(),
              estado: pagoCreado.estado,
              comprobanteUrl: pagoCreado.comprobante_url,
            },
          ]);
        }

        setVistaActual('mis-alquileres');

        setTimeout(() => {
          alert('¡Pago registrado correctamente!');
        }, 300);
      }

      if (pagoPendiente.tipo === 'reserva') {
        const reserva = pagoPendiente.reserva;

                  const disponible = await verificarDisponibilidadReservaSupabase(
                        reserva.propiedadId,
                        reserva.fechaInicio,
                        reserva.fechaFin
                      );

                      if (!disponible) {
                        localStorage.removeItem('zenith_pago_pendiente');
                        alert('El pago fue aprobado, pero esas fechas ya fueron reservadas por otra persona. Debe revisarse el reembolso manualmente.');
                        setVistaActual('mis-alquileres');
                        window.history.replaceState({}, document.title, window.location.pathname);
                        return;
                      }

        const nuevaReservaDB = {
          propiedad_id: reserva.propiedadId,
          propietario_id: reserva.propietarioId,
          inquilino_dni: pagoPendiente.usuario.dni,
          fecha_inicio: reserva.fechaInicio,
          fecha_fin: reserva.fechaFin,
          cantidad_dias: reserva.cantidadDias,
          precio_total: reserva.precioTotal,
          estado: 'Confirmada',
          estado_pago: 'Retenido',
        };

        const { data, error } = await supabase
          .from('reservas')
          .insert([nuevaReservaDB])
          .select();

        if (error) throw error;

        if (data && data[0]) {
          const resGuardada = data[0];

          setReservas(prev => [
            ...prev,
            {
              id: resGuardada.id,
              propiedadId: resGuardada.propiedad_id,
              propietarioId: resGuardada.propietario_id,
              inquilinoDni: resGuardada.inquilino_dni,
              fechaInicio: resGuardada.fecha_inicio,
              fechaFin: resGuardada.fecha_fin,
              cantidadDias: resGuardada.cantidad_dias,
              precioTotal: resGuardada.precio_total,
              fechaReserva: resGuardada.fecha_reserva,
              estado: resGuardada.estado,
              estadoPago: resGuardada.estado_pago,
              montoReembolso: resGuardada.monto_reembolso,
            },
          ]);
        }

        setDatosReserva({ fechaInicio: '', fechaFin: '' });
        setVistaActual('mis-alquileres');

        setTimeout(() => {
          alert('¡Reserva confirmada con éxito! El pago quedó registrado.');
        }, 300);
      }

      localStorage.setItem(claveProcesado, 'true');
      localStorage.removeItem('zenith_pago_pendiente');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Error al registrar pago devuelto por Mercado Pago:', error);
      alert('El pago se hizo, pero hubo un error al guardarlo en Supabase: ' + error.message);
      setVistaActual('mis-alquileres');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  procesarRetornoMercadoPago();
}, []);


  //Estados de propiedades
  const [editandoId, setEditandoId] = useState(null); // null = Alta, número = Modificación
  //estado de usuarios
  const [busquedaUsuario, setBusquedaUsuario] = useState('');

  const listaServicios = [
    "Agua", "Electricidad", "Gas", "Internet", "Aire Acondicionado",
    "Calefacción", "Ascensor", "Cochera", "Patio", "Balcón",
    "Seguridad 24/7", "Lavadero", "Piscina", "Mascotas"
  ];

  // Estados para Reporte de Problemas (RF25, RF26, RF27)
  const [problemas, setProblemas] = useState([]);
  const [modalProblema, setModalProblema] = useState(null); // Guarda el contrato sobre el que se reporta

  // Estado para Panel de Administración (RF28.1)
  const [solicitudesPropietarios, setSolicitudesPropietarios] = useState([]);

  // DESCARGAR DATOS PARA EL PANEL ADMIN (Usuarios y Solicitudes)
  useEffect(() => {
    const fetchAdminData = async () => {
      if (vistaActual === 'panel-admin') {

        // 1. Traer TODA la lista de usuarios para la tabla principal
        const { data: todosLosUsuarios, error: errUsuarios } = await supabase.from('usuarios').select('*');
        if (!errUsuarios && todosLosUsuarios) {
          setUsuarios(todosLosUsuarios);
        }

        // 2. Traer solo los pendientes para la tabla de solicitudes
        const { data: pendientes, error: errPendientes } = await supabase
          .from('usuarios')
          .select('*')
          .eq('estado_verificacion', 'pendiente');

        if (!errPendientes && pendientes) {
          setSolicitudesPropietarios(pendientes);
        }
      }
    };

    fetchAdminData();
  }, [vistaActual]);

  // NUEVO: Descargar TODAS las propiedades de Supabase
  useEffect(() => {
    const fetchPropiedades = async () => {
      // Le decimos que traiga las propiedades cada vez que alguien abre el buscador o el panel admin
      if (vistaActual === 'panel-admin' || vistaActual === 'buscador') {
        const { data, error } = await supabase
          .from('propiedades')
          .select('*');

        if (error) {
          console.error("Error al traer propiedades:", error.message);
        } else if (data) {
          // Acá actualizamos tu estado global con los datos reales de la nube
          setPropiedades(data);
        }
      }
    };

    fetchPropiedades();
  }, [vistaActual]);

  // NUEVO: Descargar Contratos, Reservas, Pagos y Usuarios desde Supabase
  useEffect(() => {
    const fetchDatosAlquiler = async () => {

      // 1. ---> AHORA ESTO ES PÚBLICO (Fuera del if) <---
      // Traemos los contratos SIEMPRE para que el calendario y el buscador sepan qué fechas están ocupadas.
      const { data: dataContratos, error: errContratos } = await supabase.from('contratos').select('*');
      if (!errContratos && dataContratos) {
        const contratosFormateados = dataContratos.map(c => ({
          id: c.id,
          propiedadId: c.propiedad_id,
          propietarioId: c.propietario_id,
          dniInquilino: c.inquilino_dni,
          // Ya no mapeamos tipo_alquiler ni frecuencia_pago porque los borramos
          fechaInicio: c.fecha_inicio,
          fechaFin: c.fecha_fin,
          estado: c.estado,
          interesesMora: c.intereses_mora,
          alquilerMensual: c.alquiler_mensual,
          montoDeposito: c.monto_deposito,
          garantia: c.garantia
        }));
        setContratos(contratosFormateados);
      }

      // ---> NUEVO: Traemos las reservas temporales SIEMPRE
      const { data: dataReservas, error: errReservas } = await supabase.from('reservas').select('*');
      if (!errReservas && dataReservas) {
        const reservasFormateadas = dataReservas.map(r => ({
          id: r.id,
          propiedadId: r.propiedad_id,
          propietarioId: r.propietario_id,
          inquilinoDni: r.inquilino_dni,
          fechaInicio: r.fecha_inicio,
          fechaFin: r.fecha_fin,
          cantidadDias: r.cantidad_dias,
          precioTotal: r.precio_total,
          fechaReserva: r.fecha_reserva,
          estado: r.estado,
          estadoPago: r.estado_pago,
          montoReembolso: r.monto_reembolso
        }));
        setReservas(reservasFormateadas);
      }

      // 2. ---> ESTO SIGUE SIENDO PRIVADO (Dentro del if) <---
      // Los recibos de pago y los datos personales de los dueños solo se descargan si inicias sesión.
      if (usuarioLogueado) {

        // Traemos los pagos
        const { data: dataPagos, error: errPagos } = await supabase.from('pagos').select('*');
        if (!errPagos && dataPagos) {
          const pagosFormateados = dataPagos.map(p => ({
            id: p.id,
            contratoId: p.contrato_id,
            concepto: p.concepto,
            montoTotal: p.monto_total,
            metodo: p.metodo,
            fecha: new Date(p.fecha_pago).toLocaleDateString(),
            estado: p.estado,
            comprobanteUrl: p.comprobante_url
          }));
          setPagos(pagosFormateados);
        }

        // Traemos los usuarios para poder leer los CBUs
        const { data: dataUsuarios, error: errUsuarios } = await supabase.from('usuarios').select('*');
        if (!errUsuarios && dataUsuarios) {
          setUsuarios(dataUsuarios);
        }
      }
    };

    fetchDatosAlquiler();
  }, [usuarioLogueado, vistaActual]);


  useEffect(() => {
  const liberarReservasPorCheckIn = async () => {
    if (!reservas || reservas.length === 0) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const reservasParaLiberar = reservas.filter(reserva => {
      const fechaInicio = new Date(reserva.fechaInicio + 'T00:00:00');
      fechaInicio.setHours(0, 0, 0, 0);

      return (
        reserva.estado === 'Confirmada' &&
        reserva.estadoPago === 'Retenido' &&
        fechaInicio <= hoy
      );
    });

    if (reservasParaLiberar.length === 0) return;

    const idsParaLiberar = reservasParaLiberar.map(reserva => reserva.id);

    const { error } = await supabase
      .from('reservas')
      .update({ estado_pago: 'Liberado' })
      .in('id', idsParaLiberar);

    if (error) {
      console.error('Error al liberar fondos por check-in:', error.message);
      return;
    }

    setReservas(prev =>
      prev.map(reserva =>
        idsParaLiberar.includes(reserva.id)
          ? { ...reserva, estadoPago: 'Liberado' }
          : reserva
      )
    );
  };

  liberarReservasPorCheckIn();
}, [reservas]);

  // NUEVO: Descargar el historial de Chats desde Supabase
  useEffect(() => {
    const fetchChats = async () => {
      // Solo buscamos si hay un usuario logueado
      if (usuarioLogueado) {
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          // Traemos los chats donde el usuario sea el inquilino O el propietario
          .or(`inquilino_email.eq.${usuarioLogueado.email},propietario_email.eq.${usuarioLogueado.email}`);

        if (!error && data) {
          // Traducimos de Supabase (snake_case) a React (camelCase)
          const chatsFormateados = data.map(c => ({
            id: c.id,
            propiedadId: c.propiedad_id,
            inquilinoEmail: c.inquilino_email,
            propietarioEmail: c.propietario_email,
            mensajes: c.mensajes || []
          }));
          setChats(chatsFormateados);
        } else if (error) {
          console.error("Error al traer chats:", error.message);
        }
      }
    };

    fetchChats();
  }, [usuarioLogueado, vistaActual]); // Se actualiza al cambiar de vista o de usuario

  // NUEVO: Descargar el historial de Problemas desde Supabase
  useEffect(() => {
    const fetchProblemas = async () => {
      // Solo buscamos si hay un usuario logueado
      if (usuarioLogueado) {
        const { data, error } = await supabase
          .from('problemas')
          .select('*')
          // Traemos los problemas donde el usuario sea el inquilino O el propietario
          .or(`inquilino_email.eq.${usuarioLogueado.email},propietario_email.eq.${usuarioLogueado.email}`);

        if (!error && data) {
          // TRADUCTOR: Pasamos de Supabase (snake_case) a React (camelCase)
          const problemasFormateados = data.map(p => ({
            id: p.id,
            contratoId: p.contrato_id,
            propiedadId: p.propiedad_id,
            inquilinoEmail: p.inquilino_email,
            propietarioEmail: p.propietario_email,
            descripcion: p.descripcion,
            estado: p.estado,
            fecha: p.fecha
          }));

          setProblemas(problemasFormateados);
        } else if (error) {
          console.error("Error al traer los problemas:", error.message);
        }
      }
    };

    fetchProblemas();
  }, [usuarioLogueado, vistaActual]); // Se ejecuta al loguearse o al cambiar de pantalla



  // Descargar Valoraciones desde Supabase
  useEffect(() => {
    const fetchValoraciones = async () => {
      const { data, error } = await supabase.from('valoraciones').select('*');
      if (!error && data) {
        const valFormateadas = data.map(v => ({
          id: v.id,
          propiedadId: v.propiedad_id,
          autorNombre: v.autor_nombre,
          autorEmail: v.autor_email,
          calificacion: v.calificacion,
          comentario: v.comentario,
          fecha: v.fecha
        }));
        setValoraciones(valFormateadas);
      }
    };
    fetchValoraciones();
  }, []); // Se ejecuta una sola vez al cargar

  // NUEVO: Descargar valoraciones entre usuarios
  useEffect(() => {
    const fetchValoracionesUsuarios = async () => {
      const { data, error } = await supabase
        .from('valoraciones_usuario')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formateadas = data.map(v => ({
          id: v.id,
          bookingType: v.booking_type,
          bookingId: v.booking_id,
          propiedadId: v.propiedad_id,
          autorId: v.autor_id,
          receptorId: v.receptor_id,
          rolAutor: v.rol_autor,
          rolReceptor: v.rol_receptor,
          calificacion: v.calificacion,
          comentario: v.comentario,
          visible: v.visible,
          createdAt: v.created_at
        }));

        setValoracionesUsuarios(formateadas);
      } else if (error) {
        console.error('Error al traer valoraciones de usuarios:', error.message);
      }
    };

    fetchValoracionesUsuarios();
  }, []);

  // NUEVO: Cargar Notificaciones desde Supabase
  useEffect(() => {
    const fetchNotificaciones = async () => {
      const { data, error } = await supabase.from('notificaciones').select('*').order('fecha_creacion', { ascending: true });
      if (!error && data) {
        setNotificaciones(data);
      }
    };
    fetchNotificaciones();
  }, []);

  useEffect(() => {
    if (vistaActual !== 'detalle-propiedad') {
      setDatosReserva({ fechaInicio: '', fechaFin: '' });
    }
  }, [vistaActual]);


  // Manejador para enviar una valoración
  const handleEnviarValoracion = async (e, propiedadId) => {
    e.preventDefault();
    if (!nuevaValoracion.comentario.trim()) return;

    const nuevaValDB = {
      propiedad_id: propiedadId,
      autor_nombre: `${usuarioLogueado.nombre} ${usuarioLogueado.apellido}`,
      autor_email: usuarioLogueado.email,
      calificacion: Number(nuevaValoracion.calificacion),
      comentario: nuevaValoracion.comentario,
      fecha: new Date().toLocaleDateString()
    };

    const { data, error } = await supabase.from('valoraciones').insert([nuevaValDB]).select();

    if (error) {
      alert("Error al enviar la valoración: " + error.message);
    } else if (data) {
      const valGuardada = data[0];
      setValoraciones([...valoraciones, {
        id: valGuardada.id,
        propiedadId: valGuardada.propiedad_id,
        autorNombre: valGuardada.autor_nombre,
        autorEmail: valGuardada.autor_email,
        calificacion: valGuardada.calificacion,
        comentario: valGuardada.comentario,
        fecha: valGuardada.fecha
      }]);
      setNuevaValoracion({ calificacion: 5, comentario: '' });
      // Notificar al propietario
      const propInfo = propiedades.find(p => String(p.id) === String(propiedadId));
      if (propInfo && propInfo.propietario_id) {
        enviarNotificacion(propInfo.propietario_id, "Nueva Reseña", `Tu propiedad "${propInfo.titulo}" ha recibido una nueva calificación de ${nuevaValoracion.calificacion} estrellas.`);
      }
      alert("¡Gracias por tu valoración! Ayudará a otros inquilinos.");
    }
  };


  // Estados para Pagos (RF19 y RF20)
  const [modalPago, setModalPago] = useState(null); // Guarda el contrato que se está por pagar


  // Estado para Contratos (RF13)
  const [datosContrato, setDatosContrato] = useState({
    dniInquilino: '', propiedadId: '', tipoAlquiler: 'largo_plazo',
    garantia: '', fechaInicio: '', fechaFin: '', frecuenciaPago: '',
    alquilerMensual: '', // <--- NUEVO
    montoDeposito: '', interesesMora: ''
  });

  // ---> NUEVO: Estado para armar una Reserva Temporal
  const [datosReserva, setDatosReserva] = useState({ fechaInicio: '', fechaFin: '' });

  // Estado para búsqueda de propiedades en panel admin (RF31)
  const [busquedaPropiedadAdmin, setBusquedaPropiedadAdmin] = useState('');



  // Manejadores de Contrato
  const handleContratoChange = (e) => {
    setDatosContrato({ ...datosContrato, [e.target.name]: e.target.value });
  };

  // Manejador para Crear Contrato en Supabase (RF13)
  const handleCrearContrato = async (e) => {
    e.preventDefault();

    // 1. Armamos el paquete usando snake_case para la base de datos
    const nuevoContratoDB = {
      propiedad_id: datosContrato.propiedadId,
      propietario_id: usuarioLogueado.id, // Usamos tu ID real como dueño
      inquilino_dni: datosContrato.dniInquilino,

      fecha_inicio: datosContrato.fechaInicio,
      fecha_fin: datosContrato.fechaFin,
      estado: 'activo',
      // Convertimos a números para evitar errores en PostgreSQL
      intereses_mora: datosContrato.interesesMora ? Number(datosContrato.interesesMora) : null,
      alquiler_mensual: datosContrato.alquilerMensual ? Number(datosContrato.alquilerMensual) : null, // <--- NUEVO
      monto_deposito: datosContrato.montoDeposito ? Number(datosContrato.montoDeposito) : null,
      garantia: datosContrato.garantia || null,

    };

    console.log("Guardando contrato en Supabase...");

    // 2. Insertamos en la tabla y pedimos que nos devuelva el registro creado (.select())
    const { data, error } = await supabase
      .from('contratos')
      .insert([nuevoContratoDB])
      .select();

    if (error) {
      alert("Error al registrar el contrato: " + error.message);
      console.error(error);
    } else if (data) {
      alert("¡Contrato registrado con éxito en el sistema!");

      // 3. Agregamos el contrato recién creado a nuestra vista local
      const contratoCreado = data[0];
      const nuevoContratoLocal = {
        ...datosContrato,
        id: contratoCreado.id,
        propietarioId: contratoCreado.propietario_id
      };

      setContratos([...contratos, nuevoContratoLocal]);

      // Limpiamos y volvemos al buscador
      setDatosContrato({ dniInquilino: '', propiedadId: '', tipoAlquiler: 'largo_plazo', garantia: '', fechaInicio: '', fechaFin: '', frecuenciaPago: '', alquilerMensual: '', montoDeposito: '', interesesMora: '' });
      setVistaActual('buscador');
    }
  };


  // Estado para la vista de detalle
  const [propiedadSeleccionada, setPropiedadSeleccionada] = useState(null);

  // Estados para Búsqueda (RF14) y Consultas (RF15)
  const [filtros, setFiltros] = useState({
    tipoInmueble: '', tipoOperacion: '', tipoGarantia: '', precioMaximo: '', ambientes: '',
    mascotas: false, cochera: false, balcon: false, internet: false, gas: false, luz: false, agua: false,
    fechaInicio: '', fechaFin: '' // <-- Aquí están las fechas que agregamos
  });

  // EFECTO DE LIMPIEZA: Reinicia los filtros al instante si el usuario inicia o cierra sesión
  useEffect(() => {
    setFiltros({
      tipoInmueble: '', tipoOperacion: '', tipoGarantia: '', precioMaximo: '', ambientes: '',
      mascotas: false, cochera: false, balcon: false, internet: false, gas: false, luz: false, agua: false,
      fechaInicio: '', fechaFin: ''
    });
  }, [usuarioLogueado]);
  // Estados para Chat Interno (RF17) y Notificaciones (RF18)
  const [chats, setChats] = useState([]);
  const [chatActivo, setChatActivo] = useState(null); // Chat seleccionado para leer/escribir
  const [notificaciones, setNotificaciones] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  /// NUEVO: Limpiar chatActivo al entrar a mensajes (Estado inicial correcto)
  useEffect(() => {
    if (vistaActual === 'mensajes') {
      setChatActivo(null);
    }
  }, [vistaActual]);

  /// NUEVO: Marcar mensajes como leídos automáticamente al abrir un chat
  useEffect(() => {
    const marcarChatLeido = async () => {
      // 1. Freno de emergencia: Si no hay usuario logueado o no hay chat, no hacemos NADA.
      if (!usuarioLogueado || !chatActivo || !chatActivo.mensajes || chatActivo.mensajes.length === 0) {
        return;
      }

      const mensajesActualizados = [...chatActivo.mensajes];
      // 2. Clonamos el último mensaje de forma segura para no romper el estado de React
      const ultimoMensaje = { ...mensajesActualizados[mensajesActualizados.length - 1] };

      // 3. Revisamos si es de la otra persona y si le falta la etiqueta de leído
      if (ultimoMensaje.sender !== usuarioLogueado.email && !ultimoMensaje.leido) {

        ultimoMensaje.leido = true;
        mensajesActualizados[mensajesActualizados.length - 1] = ultimoMensaje;

        // Guardamos en Supabase
        const { error } = await supabase
          .from('chats')
          .update({ mensajes: mensajesActualizados })
          .eq('id', chatActivo.id);

        if (!error) {
          // Actualizamos los estados usando funciones seguras (prev)
          setChats(prevChats => prevChats.map(c => c.id === chatActivo.id ? { ...c, mensajes: mensajesActualizados } : c));
          setChatActivo(prevChat => ({ ...prevChat, mensajes: mensajesActualizados }));
        } else {
          console.error("Error al marcar como leído:", error.message);
        }
      }
    };

    marcarChatLeido();
  }, [chatActivo, usuarioLogueado]);


  // Validación para el Registro (RF5)
  const validarRegistro = () => {
    let nuevosErrores = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!formData.nombre.trim()) nuevosErrores.nombre = "El nombre es obligatorio.";
    if (!formData.apellido.trim()) nuevosErrores.apellido = "El apellido es obligatorio.";
    if (!formData.dni || formData.dni.length < 7) nuevosErrores.dni = "Ingresa un DNI válido.";
    if (!formData.email || !emailRegex.test(formData.email)) nuevosErrores.email = "Ingresa un email válido.";

    if (!formData.password) {
      nuevosErrores.password = "La contraseña es obligatoria.";
    } else if (!passwordRegex.test(formData.password)) {
      nuevosErrores.password =
        "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial.";
    }

    if (!formData.provincia) nuevosErrores.provincia = "Selecciona una provincia.";

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };
  // NUEVA FUNCIÓN: Generador de Ticket de Pago (Mejorado para Zenith)
  const descargarComprobanteTXT = (infoPago, idTransaccion) => {
    const contenidoTicket = `
===================================================
          COMPROBANTE DE PAGO - ZENITH
===================================================

Operación procesada a través de: ${infoPago.emisor || 'Mercado Pago'}

N° de Transacción: ${idTransaccion}
Fecha: ${new Date().toLocaleString()}

DETALLE DEL MOVIMIENTO:
---------------------------------------------------
Concepto: ${infoPago.concepto}

TOTAL: $${infoPago.montoTotal.toFixed(2)}
---------------------------------------------------

${infoPago.mensajePie || 'El pago ya fue acreditado en la cuenta correspondiente.'}
¡Gracias por utilizar Zenith Alquileres!
===================================================
    `;

    const blob = new Blob([contenidoTicket], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.href = url;
    enlaceDescarga.download = `Comprobante_Zenith_${idTransaccion}.txt`;
    document.body.appendChild(enlaceDescarga);
    enlaceDescarga.click();

    document.body.removeChild(enlaceDescarga);
    URL.revokeObjectURL(url);
  };


  // Manejador para Recuperación de Contraseña (RF34)
  const handleRecuperarPassword = (e) => {
    e.preventDefault();
    const emailInput = e.target.emailRecupero.value;
    const dniInput = e.target.dniRecupero.value;

    // Buscamos si existe un usuario que tenga EXACTAMENTE ese email y ese DNI
    const usuarioValido = usuarios.find(u => u.email === emailInput && String(u.dni) === String(dniInput));

    if (usuarioValido) {
      if (usuarioValido.estado === 'inactivo') {
        alert('Error: Esta cuenta se encuentra inhabilitada.');
        return;
      }
      alert(`¡Éxito! Se ha enviado un enlace de recuperación temporal a: ${emailInput} (Simulación)`);
      setVistaActual('login'); // Lo mandamos de vuelta al login
    } else {
      alert('Error: El correo electrónico y el DNI ingresados no coinciden con ningún usuario registrado.');
    }
  };



  // Manejadores para Publicar Inmueble (RF8)
  const handleInmuebleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'provincia') {
      setDatosInmueble({
        ...datosInmueble,
        provincia: value,
        ciudad: ''
      });
      return;
    }

    setDatosInmueble({ ...datosInmueble, [name]: value });
  };

  const handleServiciosChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setDatosInmueble({ ...datosInmueble, servicios: [...datosInmueble.servicios, value] });
    } else {
      setDatosInmueble({ ...datosInmueble, servicios: datosInmueble.servicios.filter((s) => s !== value) });
    }
  };

  // CORREGIDO: Ahora guarda los ARCHIVOS FÍSICOS reales, no URLs temporales
  const handleInmuebleFile = (e) => {
  const { name, files } = e.target;

  if (files && files.length > 0) {
    const archivosNuevos = Array.from(files);

    if (name === 'fotos') {
      setDatosInmueble(prev => ({
        ...prev,
        fotos: [
          ...(prev.fotos || []),
          ...archivosNuevos
        ]
      }));

      console.log("Archivos de fotos agregados para la nube");
    } else {
      setDatosInmueble(prev => ({
        ...prev,
        [name]: archivosNuevos
      }));
    }
  }
};

  // NUEVA FUNCIÓN: Mueve la foto seleccionada al principio del arreglo
  const handleSetPortada = (index) => {
    // 1. Hacemos una copia del arreglo actual de fotos
    const nuevasFotos = [...datosInmueble.fotos];
    // 2. Extraemos la foto a la que le hicieron clic
    const fotoSeleccionada = nuevasFotos.splice(index, 1)[0];
    // 3. La colocamos al principio de todo (índice 0)
    nuevasFotos.unshift(fotoSeleccionada);
    // 4. Actualizamos el estado
    setDatosInmueble({ ...datosInmueble, fotos: nuevasFotos });
  };

  // Manejar fotos que ya estaban en Supabase (Fotos Viejas)
  const handleEliminarFotoVieja = (index) => {
    const nuevasFotosViejas = [...datosInmueble.fotosViejas];
    nuevasFotosViejas.splice(index, 1); // Quitamos la foto
    setDatosInmueble({ ...datosInmueble, fotosViejas: nuevasFotosViejas });
  };

  const handleSetPortadaVieja = (index) => {
    const nuevasFotosViejas = [...datosInmueble.fotosViejas];
    const fotoSeleccionada = nuevasFotosViejas.splice(index, 1)[0];
    nuevasFotosViejas.unshift(fotoSeleccionada); // La mandamos al principio
    setDatosInmueble({ ...datosInmueble, fotosViejas: nuevasFotosViejas });
  };

  // Validación estricta antes de publicar (RF9) - SE MANTIENE IGUAL
  const validarInmueble = () => {
    let nuevosErrores = {};
    if (!datosInmueble.titulo.trim()) nuevosErrores.titulo = "El título es obligatorio.";
    if (!datosInmueble.tipoInmueble) nuevosErrores.tipoInmueble = "Selecciona el tipo de inmueble.";
    if (!datosInmueble.direccion.trim()) nuevosErrores.direccion = "La dirección es obligatoria.";
    if (datosInmueble.superficieTotal <= 0) nuevosErrores.superficieTotal = "La superficie debe ser mayor a 0.";

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };
  // Alta (RF9) y Modificación (RF11) de Publicaciones (CON FOTOS Y MAPA)
  const handlePublicarInmueble = async (e) => {
    e.preventDefault();

    if (!validarInmueble()) {
      alert("Por favor, corrige los errores antes de publicar.");
      return;
    }

    console.log("Iniciando subida de archivos a Supabase...");

    try {
      // 1. Separamos los archivos físicos del resto de los textos
      const { fotos, escritura, fotosViejas, escrituraVieja, ...datosSinArchivos } = datosInmueble;

      // En vez de arrancar vacíos, arrancamos con lo que ya tenías en la base de datos
      let urlsFotos = [...(fotosViejas || [])];
      let urlEscritura = escrituraVieja || null;

      // 2. SUBIR ESCRITURA (Privada/Validación)
      if (escritura && escritura.length > 0) {
        const archivoEscritura = escritura[0]; // Agarramos el primer archivo
        const nombreEscri = `escritura_${Date.now()}_${archivoEscritura.name}`;

        const { error: errEscri } = await supabase.storage
          .from('propiedades') // El bucket nuevo
          .upload(nombreEscri, archivoEscritura);

        if (errEscri) throw errEscri;

        // Rescatamos el link público
        urlEscritura = supabase.storage.from('propiedades').getPublicUrl(nombreEscri).data.publicUrl;
        console.log("✅ Escritura subida:", urlEscritura);
      }

      // 3. SUBIR FOTOS MÚLTIPLES (Públicas)
      if (fotos && fotos.length > 0) {
  // NO vaciamos urlsFotos, porque ya contiene las fotos viejas
  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i];
    const nombreFoto = `foto_${Date.now()}_${foto.name}`;

    const { error: errFoto } = await supabase.storage
      .from('propiedades')
      .upload(nombreFoto, foto);

    if (errFoto) throw errFoto;

    const urlFoto = supabase.storage.from('propiedades').getPublicUrl(nombreFoto).data.publicUrl;
    urlsFotos.push(urlFoto);
  }

  console.log("✅ Fotos finales:", urlsFotos);
}

      console.log("Archivos listos. Guardando propiedad en la base de datos...");

      // 4. Armamos el paquete final TRADUCIENDO al idioma de tu base de datos
      const payload = {
        titulo: datosSinArchivos.titulo,
        descripcion: datosSinArchivos.descripcion,
        tipo_inmueble: datosSinArchivos.tipoInmueble,
        tipo_operacion: datosSinArchivos.tipoOperacion,
        provincia: datosSinArchivos.provincia,
        ciudad: datosSinArchivos.ciudad,
        barrio: datosSinArchivos.barrio,
        direccion: datosSinArchivos.direccion,

        // Convertimos a número (o dejamos en null si están vacíos) para que no explote Supabase
        superficie_total: Number(datosSinArchivos.superficieTotal) || 0,
        superficie_cubierta: Number(datosSinArchivos.superficieCubierta) || 0,
        habitaciones: Number(datosSinArchivos.habitaciones) || 0,
        dormitorios: Number(datosSinArchivos.dormitorios) || 0,
        banos: Number(datosSinArchivos.banos) || 0,
        pisos: Number(datosSinArchivos.pisos) || 0,

        servicios: datosSinArchivos.servicios, // Es un array, Supabase lo toma perfecto

        // Valores comerciales (algunos pueden estar vacíos según el tipo de operación)
        alquiler_mensual: datosSinArchivos.alquilerMensual ? Number(datosSinArchivos.alquilerMensual) : null, // <--- NUEVO
        deposito: datosSinArchivos.deposito ? Number(datosSinArchivos.deposito) : null,
        tipo_garantia: datosSinArchivos.tipoGarantia || null,
        pago_diario: datosSinArchivos.pagoDiario ? Number(datosSinArchivos.pagoDiario) : null,
        descuento_semanal: datosSinArchivos.descuentoSemanal ? Number(datosSinArchivos.descuentoSemanal) : null,
        descuento_mensual: datosSinArchivos.descuentoMensual ? Number(datosSinArchivos.descuentoMensual) : null,

        latitud: datosInmueble.latitud,
        longitud: datosInmueble.longitud,
        escritura: urlEscritura,
        fotos: urlsFotos,

        // Conectamos el ID real del usuario en lugar del email
        propietario_id: usuarioLogueado.id,
        estado: 'pendiente_revision'
      };

      // 5. Guardamos en la tabla de Supabase
      if (editandoId !== null) {
        const { error } = await supabase.from('propiedades').update(payload).eq('id', editandoId);
        if (error) throw error;
        alert('¡Publicación actualizada con éxito en la base de datos!');
      } else {
        const { error } = await supabase.from('propiedades').insert([payload]);
        if (error) throw error;
        alert('¡Inmueble publicado con éxito y visible en el sistema!');
      }

      // 6. Limpiamos formulario para dejar todo pulcro
      setDatosInmueble({
        titulo: '', descripcion: '', tipoInmueble: '', tipoOperacion: 'largo_plazo',
        provincia: '', ciudad: '', barrio: '', direccion: '', superficieTotal: '',
        superficieCubierta: '', habitaciones: '', banos: '', pisos: '', dormitorios: '',
        servicios: [], alquilerMensual: '', deposito: '', tipoGarantia: '', pagoDiario: '',
        descuentoSemanal: '', descuentoMensual: '', fotos: null, escritura: null,
        latitud: -27.7833, longitud: -64.2667
      });
      setEditandoId(null);
      setErrores({});
      setVistaActual('panel-propiedades');

    } catch (error) {
      alert("Hubo un error crítico al publicar: " + error.message);
      console.error("Error detallado:", error);
    }
  };

  // CORREGIDO: Ahora impacta la baja lógica directo en Supabase (RF10)
  const handleBajaPropiedad = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas dar de baja esta publicación? Dejará de ser visible para los inquilinos.')) {

      console.log("Dando de baja en Supabase...");

      const { error } = await supabase
        .from('propiedades')
        .update({ estado: 'inactivo' })
        .eq('id', id);

      if (error) {
        alert("Hubo un error al dar de baja: " + error.message);
        console.error(error);
      } else {
        alert("Publicación dada de baja exitosamente.");
        // Actualizamos la vista local para que desaparezca al instante
        setPropiedades(propiedades.map(prop =>
          prop.id === id ? { ...prop, estado: 'inactivo' } : prop
        ));
      }
    }
  };

  // Preparar Modificación (RF11)
  const handleEditarPropiedad = (propiedad) => {
    setDatosInmueble({
      ...propiedad,

      // 1. Traducimos los campos problemáticos de Supabase a React
      tipoInmueble: propiedad.tipo_inmueble || propiedad.tipoInmueble || '',
      tipoOperacion: propiedad.tipo_operacion || propiedad.tipoOperacion || 'largo_plazo',
      superficieTotal: propiedad.superficie_total || propiedad.superficieTotal || '',
      superficieCubierta: propiedad.superficie_cubierta || propiedad.superficieCubierta || '',
      alquilerMensual: propiedad.alquiler_mensual || propiedad.alquilerMensual || '', // <--- NUEVO
      deposito: propiedad.deposito || '',
      tipoGarantia: propiedad.tipo_garantia || propiedad.tipoGarantia || '',
      pagoDiario: propiedad.pago_diario || propiedad.pagoDiario || '',
      descuentoSemanal: propiedad.descuento_semanal || propiedad.descuentoSemanal || '',
      descuentoMensual: propiedad.descuento_mensual || propiedad.descuentoMensual || '',

      // 2. Aseguramos que los servicios se carguen (es un Array)
      servicios: propiedad.servicios || [],

      // 3. Guardamos las URLs de las fotos y escritura viejas en variables temporales
      fotosViejas: propiedad.fotos || [],
      escrituraVieja: propiedad.escritura || null,

      // 4. Vaciamos los inputs físicos para no generar conflictos
      fotos: null,
      escritura: null
    });

    setEditandoId(propiedad.id);

    // Centramos el mapa en la ubicación original de la propiedad
    setPosicionMapa({
      lat: Number(propiedad.latitud) || -27.7833,
      lng: Number(propiedad.longitud) || -64.2667
    });

    setErrores({});
    setVistaActual('publicar-inmueble');
  };


  // Manejadores y validación para el registro de Propietario (RF7)
  const handlePropietarioChange = (e) => {
    setDatosPropietario({ ...datosPropietario, [e.target.name]: e.target.value });
  };

  const handlePropietarioFile = (e) => {
    const { name, files } = e.target;
    if (files[0]) {
      setDatosPropietario({ ...datosPropietario, [name]: files[0] });
    }
  };

  const validarPropietario = () => {
    let nuevosErrores = {};
    const cbuRegex = /^[0-9]{22}$/;

    if (!datosPropietario.cbu || !cbuRegex.test(datosPropietario.cbu)) {
      nuevosErrores.cbu = "El CBU/CVU debe contener exactamente 22 números.";
    }
    if (!datosPropietario.dniFrente) nuevosErrores.dniFrente = "La foto del anverso del DNI es obligatoria.";
    if (!datosPropietario.dniReverso) nuevosErrores.dniReverso = "La foto del reverso del DNI es obligatoria.";

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleRegistroPropietario = async (e) => {
    e.preventDefault();
    if (!validarPropietario()) return;

    console.log("Subiendo imágenes a Supabase Storage...");

    try {
      // 1. Subir foto del DNI Frente
      const nombreFrente = `dni_frente_${usuarioLogueado.dni}_${Date.now()}`;
      const { error: errFrente } = await supabase.storage
        .from('documentos') // El nombre exacto de tu Bucket
        .upload(nombreFrente, datosPropietario.dniFrente);
      if (errFrente) throw errFrente;

      // Rescatamos el link público del frente
      const urlFrente = supabase.storage.from('documentos').getPublicUrl(nombreFrente).data.publicUrl;

      // 2. Subir foto del DNI Reverso
      const nombreReverso = `dni_reverso_${usuarioLogueado.dni}_${Date.now()}`;
      const { error: errReverso } = await supabase.storage
        .from('documentos')
        .upload(nombreReverso, datosPropietario.dniReverso);
      if (errReverso) throw errReverso;

      // Rescatamos el link público del reverso
      const urlReverso = supabase.storage.from('documentos').getPublicUrl(nombreReverso).data.publicUrl;

      console.log("Fotos subidas. Actualizando usuario en BD...");

      // 3. Actualizamos el usuario sumando las URLs
      const { error: errUpdate } = await supabase
        .from('usuarios')
        .update({
          estado_verificacion: 'pendiente',
          cbu: datosPropietario.cbu,
          dni_frente: urlFrente,   // Guardamos el link
          dni_reverso: urlReverso  // Guardamos el link
        })
        .eq('email', usuarioLogueado.email);

      if (errUpdate) throw errUpdate;

      alert('¡Documentación enviada! Un administrador revisará tu perfil pronto.');
      setUsuarioLogueado({ ...usuarioLogueado, estado_verificacion: 'pendiente' });
      setErrores({});
      setVistaActual('buscador');

    } catch (error) {
      alert("Hubo un error al procesar tu solicitud: " + error.message);
      console.error(error);
    }
  };



  // NUEVO MANEJADOR DE LOGIN REAL (A SUPABASE)
  const handleLogin = async (e) => {
    e.preventDefault();
    const emailInput = formData.email;
    const passwordInput = formData.password;

    // ACCESO SECRETO PARA EL ADMINISTRADOR (Dejamos intacto tu "Modo Dios")
    if (emailInput === 'admin@zenith.com' && passwordInput === 'admin123') {
      setUsuarioLogueado({ nombre: 'Admin Master', email: 'admin@zenith.com', rol: 'admin' });
      setErrores({});
      setFormData({ nombre: '', apellido: '', email: '', password: '', dni: '', telefono: '', provincia: '' });
      setVistaActual('panel-admin');
      return;
    }

    console.log("Validando credenciales en Supabase...");
    // 1. Buscamos en la tabla un usuario que coincida exactamente con email y contraseña
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', emailInput)
      .eq('password', passwordInput);

    // 2. Evaluamos la respuesta de la base de datos
    if (error) {
      alert("Error de conexión con la base de datos: " + error.message);
      console.error(error);
    } else if (data && data.length > 0) {
      // ¡Coincidencia encontrada! Usamos 'let' porque vamos a modificar este objeto si es necesario
      let usuarioEncontrado = data[0];

      // Verificamos que el administrador no lo haya dado de baja definitiva
      if (usuarioEncontrado.estado === 'inactivo') {
        alert("Error: Tu cuenta se encuentra inhabilitada.");
        return;
      }

      // ---> NUEVO: NOTIFICACIONES AUTOMÁTICAS AL INICIAR SESIÓN <---
      if (usuarioEncontrado.estado_verificacion === 'rechazado') {
        // En vez de un alert, le mandamos una notificación oficial a su bandeja
        enviarNotificacion(usuarioEncontrado.id, "Solicitud Rechazada", "Tu documentación para ser propietario no fue aprobada. Continuarás usando la plataforma con tu rol de Inquilino.");

        // Marcamos en la BD que ya le avisamos
        await supabase.from('usuarios').update({ estado_verificacion: 'rechazado_notificado' }).eq('id', usuarioEncontrado.id);
        usuarioEncontrado.estado_verificacion = 'rechazado_notificado';
      }
      else if (usuarioEncontrado.estado_verificacion === 'aprobado') {
        // Le avisamos que fue aceptado
        enviarNotificacion(usuarioEncontrado.id, "¡Felicidades, eres Propietario!", "Tu solicitud fue verificada con éxito. Ya puedes empezar a publicar tus inmuebles.");

        // Marcamos en la BD que ya le avisamos
        await supabase.from('usuarios').update({ estado_verificacion: 'aprobado_notificado' }).eq('id', usuarioEncontrado.id);
        usuarioEncontrado.estado_verificacion = 'aprobado_notificado';
      }

      // Traducimos la foto de la BD para que el componente la lea bien
      usuarioEncontrado.fotoPerfil = usuarioEncontrado.foto_perfil;
      // Lo dejamos pasar y guardamos su sesión
      setUsuarioLogueado(usuarioEncontrado);
      setErrores({});
      setVistaActual('buscador');

      // Limpiamos el formulario
      setFormData({ nombre: '', apellido: '', email: '', password: '', dni: '', telefono: '', provincia: '' });

    } else {
      // Si "data" viene vacío, significa que el email o la contraseña no coinciden
      alert("Credenciales incorrectas. Verifica tu email y contraseña.");
    }
  };
  // MANEJADOR DE REGISTRO REAL (A SUPABASE)
  const handleRegistro = async (e) => {
    e.preventDefault();

    // 1. Freno de validación que ya tenías armado (¡no lo perdemos!)
    if (!validarRegistro()) return;

    console.log("Enviando usuario a Supabase...");

    // 2. Insertamos la fila en la tabla usando tu estado formData
    const { error } = await supabase
      .from('usuarios')
      .insert([
        {
          nombre: formData.nombre,
          apellido: formData.apellido,
          dni: formData.dni,
          telefono: formData.telefono,
          email: formData.email,
          password: formData.password,
          provincia: formData.provincia
        }
      ]);

    // 3. Comprobamos el resultado
    if (error) {
      alert("Hubo un error al registrar: " + error.message);
      console.error(error);
    } else {
      alert("¡Éxito! Tu usuario ya está guardado en la base de datos.");
      setErrores({}); // Limpiamos los errores visuales
      setVistaActual('login'); // Lo mandamos al login

      // Limpiamos el formulario para el próximo que se quiera registrar
      setFormData({ nombre: '', apellido: '', email: '', password: '', dni: '', telefono: '', provincia: '' });
    }
  };

  // GESTIÓN DE USUARIOS (Dar de baja / Reactivar con EFECTO CASCADA)
  const handleToggleEstadoUsuario = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo';
    const accion = nuevoEstado === 'inactivo' ? 'dado de baja' : 'reactivado';

    if (window.confirm(`¿Estás seguro de que deseas cambiar el estado de este usuario a ${nuevoEstado}?`)) {

      // 1. Actualizamos el estado del usuario en la base de datos
      const { error: errUser } = await supabase
        .from('usuarios')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (errUser) {
        alert("Error al actualizar el usuario: " + errUser.message);
        return; // Si falla, cortamos el proceso acá
      }

      // 2. EFECTO CASCADA: Si lo suspendimos, bajamos todas sus publicaciones
      if (nuevoEstado === 'inactivo') {
        console.log("Suspendiendo propiedades asociadas al usuario...");
        const { error: errProps } = await supabase
          .from('propiedades')
          .update({ estado: 'inactivo' })
          .eq('propietario_id', id); // Busca todas las que tengan su ID

        if (!errProps) {
          // Actualizamos la pantalla del admin para que desaparezcan al instante
          setPropiedades(propiedades.map(p =>
            p.propietario_id === id ? { ...p, estado: 'inactivo' } : p
          ));
        }
      }

      // 3. Actualizamos la tablita de usuarios local
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, estado: nuevoEstado } : u));
      alert(`Usuario ${accion} exitosamente.`);

      // 4. Enviamos la notificación al usuario suspendido
      if (nuevoEstado === 'inactivo') {
        enviarNotificacion(id, "Cuenta inhabilitada", "Tu cuenta ha sido suspendida por un administrador. Por seguridad, tus publicaciones también fueron dadas de baja.");
      } else {
        enviarNotificacion(id, "Cuenta reactivada", "Tu cuenta ha sido reactivada. Ya puedes volver a iniciar sesión en Zenith Alquileres.");
      }
    }
  };

  // GESTIÓN DE INMUEBLES (Dar de baja / Reactivar)
  const handleToggleEstadoPropiedadAdmin = async (prop) => {
    const nuevoEstado = prop.estado === 'activo' ? 'inactivo' : 'activo';
    const mensajeConfirmacion = prop.estado === 'activo'
      ? '¿Estás seguro de dar de baja esta publicación? Dejará de verse en el buscador.'
      : '¿Estás seguro de reactivar esta publicación? Volverá a estar visible.';

    if (window.confirm(mensajeConfirmacion)) {
      const { error } = await supabase
        .from('propiedades')
        .update({ estado: nuevoEstado })
        .eq('id', prop.id);

      if (error) {
        alert("Error al actualizar la propiedad: " + error.message);
      } else {
        // Actualizar estado local
        setPropiedades(propiedades.map(p => p.id === prop.id ? { ...p, estado: nuevoEstado } : p));
        alert(`Publicación ${nuevoEstado === 'inactivo' ? 'dada de baja' : 'reactivada'} exitosamente.`);

        // ---> MAGIA: Buscamos el email real del dueño usando su ID <---
        let emailReal = prop.propietarioEmail;
        if (!emailReal && prop.propietario_id) {
          const { data } = await supabase.from('usuarios').select('email').eq('id', prop.propietario_id).single();
          if (data) emailReal = data.email;
        }

        // Notificar al dueño si encontramos el email
        if (emailReal && nuevoEstado === 'inactivo') {
          enviarNotificacion(prop.propietario_id, "Publicación dada de baja", `Tu inmueble "${prop.titulo}" ha sido dado de baja por un administrador por incumplir las normativas de la plataforma.`);
        } else if (emailReal && nuevoEstado === 'activo') {
          enviarNotificacion(prop.propietario_id, "Publicación reactivada", `Tu inmueble "${prop.titulo}" ha sido reactivado y vuelve a estar visible en el buscador.`);
        }
      }
    }
  };

  // Maneja los cambios de texto en el formulario de perfil
  const handlePerfilChange = (e) => {
    const { name, value } = e.target;
    setUsuarioLogueado({ ...usuarioLogueado, [name]: value });
  };

  // Maneja la subida de la foto de perfil creando una URL local temporal
  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivoFotoPerfil(file); // Guardamos el archivo físico para Supabase
      const imageUrl = URL.createObjectURL(file);
      setUsuarioLogueado({ ...usuarioLogueado, fotoPerfil: imageUrl }); // Mostramos la previsualización
    }
  };

  // Guarda los cambios reales en Supabase
  const handleGuardarPerfil = async (e) => {
    e.preventDefault();

    try {
      let urlFotoPublica = usuarioLogueado.fotoPerfil || usuarioLogueado.foto_perfil;

      // 1. Si el usuario seleccionó una foto nueva, la subimos a Storage
      if (archivoFotoPerfil) {
        console.log("Subiendo foto de perfil a Supabase...");
        const nombreFoto = `perfil_${usuarioLogueado.id}_${Date.now()}`;

        const { error: errUpload } = await supabase.storage
          .from('perfiles') // ⚠️ IMPORTANTE: Debes crear este bucket en Supabase
          .upload(nombreFoto, archivoFotoPerfil);

        if (errUpload) throw errUpload;

        // Rescatamos la URL pública
        urlFotoPublica = supabase.storage.from('perfiles').getPublicUrl(nombreFoto).data.publicUrl;
      }

      console.log("Actualizando datos en la base de datos...");

      // 2. Actualizamos la tabla de usuarios
      const { error: errUpdate } = await supabase
        .from('usuarios')
        .update({
          nombre: usuarioLogueado.nombre,
          apellido: usuarioLogueado.apellido,
          telefono: usuarioLogueado.telefono,
          foto_perfil: urlFotoPublica,
          bio: usuarioLogueado.bio || '',
          idiomas: parseListaTexto(usuarioLogueado.idiomas),
          intereses: parseListaTexto(usuarioLogueado.intereses)
        })
        .eq('id', usuarioLogueado.id);

      if (errUpdate) throw errUpdate;

      // 3. Actualizamos la sesión activa
      setUsuarioLogueado({
        ...usuarioLogueado,
        fotoPerfil: urlFotoPublica,
        foto_perfil: urlFotoPublica,
        idiomas: parseListaTexto(usuarioLogueado.idiomas),
        intereses: parseListaTexto(usuarioLogueado.intereses)
      });
      setArchivoFotoPerfil(null); // Limpiamos el archivo temporal
      alert('¡Perfil actualizado con éxito!');

    } catch (error) {
      alert("Hubo un error al guardar tu perfil: " + error.message);
      console.error(error);
    }
  };

  // Elimina la cuenta y todos sus datos en cascada
  const handleEliminarCuenta = async () => {
    const confirmacion = window.confirm('⚠️ ¿Estás seguro de que deseas ELIMINAR tu cuenta? Esta acción es irreversible y borrará todos tus contratos y propiedades.');

    if (confirmacion) {
      try {
        console.log("Eliminando datos asociados...");

        // 1. Si es propietario, borramos sus propiedades publicadas
        if (usuarioLogueado.rol === 'propietario') {
          await supabase.from('propiedades').delete().eq('propietario_id', usuarioLogueado.id);
        }

        // 2. Borramos los contratos donde sea dueño o inquilino
        await supabase.from('contratos').delete().or(`propietario_id.eq.${usuarioLogueado.id},inquilino_dni.eq.${usuarioLogueado.dni}`);

        // 3. Finalmente, borramos el usuario de la base de datos
        const { error: errUser } = await supabase.from('usuarios').delete().eq('id', usuarioLogueado.id);

        if (errUser) throw errUser;

        alert('Tu cuenta y todos tus datos han sido eliminados del sistema.');

        // Cerramos la sesión y lo mandamos al inicio
        setUsuarioLogueado(null);
        setVistaActual('inicio');

      } catch (error) {
        alert('Hubo un error crítico al intentar eliminar tu cuenta: ' + error.message);
        console.error(error);
      }
    }
  };

  // Manejador de Filtros (RF14)
  const handleFiltroChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFiltros({ ...filtros, [name]: type === 'checkbox' ? checked : value });
  };
  // Gestor de Notificaciones en Supabase (RF18)
  const enviarNotificacion = async (usuarioDestinoId, tipo, mensaje) => {
    try {
      const payload = {
        usuario_id: usuarioDestinoId,
        tipo: tipo,
        mensaje: mensaje,
        leida: false
      };

      const { data, error } = await supabase.from('notificaciones').insert([payload]).select();

      if (!error && data && data.length > 0) {
        setNotificaciones(prev => [...prev, data[0]]);
      } else {
        console.error("Error al guardar notificación en Supabase:", error);
      }
    } catch (err) {
      console.error("Excepción en enviarNotificacion:", err);
    }
  };

  // NUEVO: Abrir notificaciones y marcarlas todas como leídas
  const handleAbrirNotificaciones = async () => {
    // 1. Lo mandamos a la vista
    setVistaActual('notificaciones');
    if (!usuarioLogueado) return;

    // 2. Actualizamos el estado local
    setNotificaciones(notificaciones.map(noti =>
      noti.usuario_id === usuarioLogueado.id ? { ...noti, leida: true } : noti
    ));

    // 3. Actualizamos en Supabase
    await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', usuarioLogueado.id);
  };

useEffect(() => {
  const borrarNotificacionesVistas = async () => {
    if (!usuarioLogueado) return;
    if (vistaActual === 'notificaciones') return;

    const notificacionesVistas = notificaciones.filter(noti =>
      String(noti.usuario_id) === String(usuarioLogueado.id) &&
      noti.leida === true
    );

    if (notificacionesVistas.length === 0) return;

    const idsParaBorrar = notificacionesVistas.map(noti => noti.id);

    const { error } = await supabase
      .from('notificaciones')
      .delete()
      .in('id', idsParaBorrar);

    if (error) {
      console.error('Error al borrar notificaciones vistas:', error.message);
      return;
    }

    setNotificaciones(prev =>
      prev.filter(noti => !idsParaBorrar.includes(noti.id))
    );
  };

  borrarNotificacionesVistas();
}, [vistaActual, usuarioLogueado, notificaciones]);

  // Iniciar un nuevo chat desde una propiedad (RF17)
  const handleConsultar = async (propiedadId) => {

    // 1. Buscamos la propiedad en la pantalla
    const propiedad = propiedades.find(p => p.id === propiedadId);

    if (!propiedad) {
      alert("Error: No se encontró la propiedad.");
      return;
    }

    let emailRealDueño = null;

    // 2. ---> MAGIA: Le preguntamos a Supabase el email del dueño usando su ID <---
    if (propiedad.propietario_id) {
      const { data: dueño, error } = await supabase
        .from('usuarios')
        .select('email')
        .eq('id', propiedad.propietario_id)
        .single();

      if (dueño) {
        emailRealDueño = dueño.email;
      } else if (error) {
        console.error("Error buscando al dueño:", error.message);
      }
    } else {
      // Por si es una propiedad vieja de prueba que guardaste sin ID
      emailRealDueño = propiedad.propietarioEmail || propiedad.propietario_email;
    }

    // 3. Verificamos si lo encontramos
    if (!emailRealDueño) {
      alert("Error: No se pudo encontrar el correo del propietario en la base de datos.");
      return;
    }

    // 4. Pedimos el mensaje al usuario
    const mensajeText = prompt("Escribe tu primer mensaje para el propietario (ej: ¿Sigue disponible?):");

    if (mensajeText && mensajeText.trim() !== '') {
      const nuevoMensaje = { sender: usuarioLogueado.email, text: mensajeText, timestamp: new Date().toLocaleString() };

      let chatExistente = chats.find(c => c.propiedadId === propiedadId && c.inquilinoEmail === usuarioLogueado.email);

      if (chatExistente) {
        // SI YA EXISTE EL CHAT: Actualizamos
        const mensajesActualizados = [...chatExistente.mensajes, nuevoMensaje];
        await supabase.from('chats').update({ mensajes: mensajesActualizados }).eq('id', chatExistente.id);

        setChats(chats.map(c => c.id === chatExistente.id ? { ...c, mensajes: mensajesActualizados } : c));
      } else {
        // SI ES NUEVO: Lo creamos en Supabase
        const nuevoChatDB = {
          propiedad_id: propiedadId,
          inquilino_email: usuarioLogueado.email,
          propietario_email: emailRealDueño, // <-- ¡Ahora sí enviamos el email correcto!
          mensajes: [nuevoMensaje]
        };

        const { data, error } = await supabase.from('chats').insert([nuevoChatDB]).select();

        if (!error && data) {
          const chatCreado = data[0];
          setChats([...chats, {
            id: chatCreado.id,
            propiedadId: chatCreado.propiedad_id,
            inquilinoEmail: chatCreado.inquilino_email,
            propietarioEmail: chatCreado.propietario_email,
            mensajes: chatCreado.mensajes
          }]);
        } else {
          alert("Hubo un error al iniciar el chat: " + error?.message);
          return;
        }
      }

      // Notificación de nueva consulta (ahora conectada a Supabase)
      enviarNotificacion(propiedad.propietario_id, "Nueva consulta recibida", `${usuarioLogueado.nombre} te ha escrito sobre tu propiedad.`);

      alert("¡Consulta enviada! Puedes seguir la conversación en la pestaña de Mensajes.");
    }
  };
  // Enviar un mensaje en un chat ya existente (RF17)
  const handleEnviarMensaje = async (e) => {
    e.preventDefault();
    const texto = e.target.mensajeNuevo.value;
    if (!texto.trim() || !usuarioLogueado || !chatActivo) return;

    // VALIDACION DE SEGURIDAD (Bug de envío)
    if (chatActivo.inquilinoEmail !== usuarioLogueado.email && chatActivo.propietarioEmail !== usuarioLogueado.email) {
      alert("Error de seguridad: No tienes permiso para enviar mensajes en esta conversación.");
      return;
    }

    // 1. Preparamos el nuevo paquete de mensajes sumando el actual
    const nuevoMensaje = { sender: usuarioLogueado.email, text: texto, timestamp: new Date().toLocaleString() };
    const mensajesActualizados = [...chatActivo.mensajes, nuevoMensaje];

    // 2. Lo guardamos en Supabase
    const { error } = await supabase
      .from('chats')
      .update({ mensajes: mensajesActualizados })
      .eq('id', chatActivo.id);

    if (error) {
      alert("Error al enviar el mensaje: " + error.message);
      return;
    }

    // 3. Actualizamos la pantalla al instante
    const chatActualizado = { ...chatActivo, mensajes: mensajesActualizados };
    setChats(chats.map(c => c.id === chatActivo.id ? chatActualizado : c));
    setChatActivo(chatActualizado);
    e.target.reset();

    // Notificamos a la otra parte
    const destinatarioEmail = usuarioLogueado.email === chatActivo.propietarioEmail ? chatActivo.inquilinoEmail : chatActivo.propietarioEmail;
    const destinatarioObj = usuarios.find(u => u.email === destinatarioEmail);
    if (destinatarioObj) {
      enviarNotificacion(destinatarioObj.id, "Nuevo mensaje", `Tienes una nueva respuesta de ${usuarioLogueado.nombre}.`);
    }
  };


  const handleEnviarProblema = async (e) => {
    e.preventDefault();
    const descripcion = e.target.descripcionProblema.value;
    if (!descripcion.trim()) return;

    // ---> MAGIA: Buscamos el email real del dueño usando su ID <---
    const dueño = usuarios.find(u => u.id === modalProblema.propietarioId);
    const emailRealDueño = dueño ? dueño.email : '';

    // 1. Armamos el paquete para Supabase
    const nuevoProblemaDB = {
      contrato_id: modalProblema.id,
      propiedad_id: modalProblema.propiedadId,
      inquilino_email: usuarioLogueado.email,
      propietario_email: emailRealDueño, // <-- Ahora sí guardamos el email real
      descripcion: descripcion,
      estado: 'Pendiente',
      fecha: new Date().toLocaleDateString()
    };

    // 2. Lo enviamos a la base de datos
    const { data, error } = await supabase
      .from('problemas')
      .insert([nuevoProblemaDB])
      .select();

    if (error) {
      alert("Hubo un error al reportar el problema: " + error.message);
      return;
    }

    // 3. Si se guardó bien, actualizamos la pantalla
    if (data && data.length > 0) {
      const problemaGuardado = data[0];
      const nuevoProblemaLocal = {
        id: problemaGuardado.id,
        contratoId: problemaGuardado.contrato_id,
        propiedadId: problemaGuardado.propiedad_id,
        inquilinoEmail: problemaGuardado.inquilino_email,
        propietarioEmail: problemaGuardado.propietario_email,
        descripcion: problemaGuardado.descripcion,
        estado: problemaGuardado.estado,
        fecha: problemaGuardado.fecha
      };
      setProblemas([...problemas, nuevoProblemaLocal]);
    }

    // 4. Notificamos al dueño
    if (emailRealDueño) {
  enviarNotificacion(
    modalProblema.propietarioId,
    "Problema Reportado",
    `Tu inquilino ha reportado un problema: "${descripcion}"`
  );
}

    alert("Problema reportado con éxito. El propietario ha sido notificado.");
    setModalProblema(null);
  };

  const handleResolverProblema = async (problemaId) => {
    // RF27: Resolución de problemas
    if (window.confirm('¿Confirmas que este problema ya fue solucionado?')) {

      // 1. Actualizamos en Supabase
      const { error } = await supabase
        .from('problemas')
        .update({ estado: 'Resuelto' })
        .eq('id', problemaId);

      // 2. Si no hay error, actualizamos la pantalla
      if (error) {
        alert("Error al intentar resolver el problema: " + error.message);
      } else {
        setProblemas(problemas.map(p => p.id === problemaId ? { ...p, estado: 'Resuelto' } : p));
        alert("¡Excelente! El problema ha sido marcado como resuelto.");
      }
    }
  };

  const handleChatDesdeProblema = async (problema) => {
    // 1. Preparamos el mensaje inicial sobre el problema
    const textoInicial = `Hola, te escribo por el problema reportado: "${problema.descripcion}"`;
    const nuevoMensaje = { sender: usuarioLogueado.email, text: textoInicial, timestamp: new Date().toLocaleString() };

    // 2. Buscamos si ya charlaron antes
    let chatExistente = chats.find(c => c.propiedadId === problema.propiedadId && c.inquilinoEmail === problema.inquilinoEmail);

    if (chatExistente) {
      // SI YA EXISTE: Le sumamos el mensaje a la base de datos
      const mensajesActualizados = [...chatExistente.mensajes, nuevoMensaje];
      const { error } = await supabase.from('chats').update({ mensajes: mensajesActualizados }).eq('id', chatExistente.id);

      if (!error) {
        const chatActualizado = { ...chatExistente, mensajes: mensajesActualizados };
        setChats(chats.map(c => c.id === chatExistente.id ? chatActualizado : c));
        setChatActivo(chatActualizado);
      } else {
        alert("Error al conectar con el chat: " + error.message);
        return;
      }
    } else {
      // SI ES NUEVO: Creamos la sala en Supabase
      const nuevoChatDB = {
        propiedad_id: problema.propiedadId,
        inquilino_email: problema.inquilinoEmail,
        propietario_email: problema.propietarioEmail,
        mensajes: [nuevoMensaje]
      };

      const { data, error } = await supabase.from('chats').insert([nuevoChatDB]).select();

      if (!error && data) {
        const chatCreado = data[0];
        const nuevoChatLocal = {
          id: chatCreado.id,
          propiedadId: chatCreado.propiedad_id,
          inquilinoEmail: chatCreado.inquilino_email,
          propietarioEmail: chatCreado.propietario_email,
          mensajes: chatCreado.mensajes
        };
        setChats([...chats, nuevoChatLocal]);
        setChatActivo(nuevoChatLocal);
      } else {
        alert("Hubo un error al iniciar el chat: " + error?.message);
        return;
      }
    }

    // 3. Lo llevamos a la pantalla de mensajes
    setVistaActual('mensajes');
  };
  // ---> PASO 1 ACTUALIZADO: Contar chats no leídos <---
  const notificacionesMensajes = usuarioLogueado ? chats.filter(chat => {
    if (!chat.mensajes || chat.mensajes.length === 0) return false;

    const ultimoMensaje = chat.mensajes[chat.mensajes.length - 1];

    // Cuenta como notificación si NO es mío Y todavía NO lo leí
    return ultimoMensaje.sender !== usuarioLogueado.email && !ultimoMensaje.leido;
  }).length : 0;

  const parseListaTexto = (valor) => {
    if (Array.isArray(valor)) return valor;
    if (!valor) return [];
    return String(valor)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  };

  const formatearMiembroDesde = (fecha) => {
    if (!fecha) return 'Miembro nuevo';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return 'Miembro nuevo';

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${meses[date.getMonth()]} ${date.getFullYear()}`;
  };

  const obtenerResenasUsuario = (usuarioId, rolReceptor = null) => {
    return valoracionesUsuarios.filter(v =>
      String(v.receptorId) === String(usuarioId) &&
      (rolReceptor ? v.rolReceptor === rolReceptor : true) &&
      v.visible !== false
    );
  };

  const obtenerResumenUsuario = (usuario, rol = 'anfitrion') => {
    if (!usuario) return { promedio: 'Nuevo', cantidad: 0 };

    const promedioPre = rol === 'anfitrion'
      ? Number(usuario.promedio_como_anfitrion || 0)
      : Number(usuario.promedio_como_huesped || 0);

    const cantidadPre = rol === 'anfitrion'
      ? Number(usuario.cantidad_resenas_como_anfitrion || 0)
      : Number(usuario.cantidad_resenas_como_huesped || 0);

    if (cantidadPre > 0) {
      return {
        promedio: promedioPre.toFixed(1),
        cantidad: cantidadPre
      };
    }

    const reseñas = obtenerResenasUsuario(usuario.id, rol);
    if (reseñas.length === 0) return { promedio: 'Nuevo', cantidad: 0 };

    const promedio = reseñas.reduce((acc, r) => acc + Number(r.calificacion), 0) / reseñas.length;
    return {
      promedio: promedio.toFixed(1),
      cantidad: reseñas.length
    };
  };

  const ciudadesDisponibles = datosInmueble.provincia
    ? (provinciasYCiudades[datosInmueble.provincia] || [])
    : [];

  const handleEnviarValoracionUsuario = async (e, contexto) => {
    e.preventDefault();
    if (!contexto) return;
    if (!nuevaValoracionUsuario.comentario.trim()) return;

    const payload = {
      booking_type: contexto.bookingType,
      booking_id: String(contexto.bookingId),
      propiedad_id: contexto.propiedadId,
      autor_id: contexto.autorId,
      receptor_id: contexto.receptorId,
      rol_autor: contexto.rolAutor,
      rol_receptor: contexto.rolReceptor,
      calificacion: Number(nuevaValoracionUsuario.calificacion),
      comentario: nuevaValoracionUsuario.comentario,
      visible: true
    };

    const { data, error } = await supabase
      .from('valoraciones_usuario')
      .insert([payload])
      .select();

    if (error) {
      alert('Error al enviar la reseña del perfil: ' + error.message);
      return;
    }

    if (data && data[0]) {
      const v = data[0];
      setValoracionesUsuarios(prev => [
        {
          id: v.id,
          bookingType: v.booking_type,
          bookingId: v.booking_id,
          propiedadId: v.propiedad_id,
          autorId: v.autor_id,
          receptorId: v.receptor_id,
          rolAutor: v.rol_autor,
          rolReceptor: v.rol_receptor,
          calificacion: v.calificacion,
          comentario: v.comentario,
          visible: v.visible,
          createdAt: v.created_at
        },
        ...prev
      ]);

      setNuevaValoracionUsuario({ calificacion: 5, comentario: '' });
      // Notificar al usuario valorado
      if (contexto && contexto.usuarioId) {
        enviarNotificacion(contexto.usuarioId, "Nueva Valoración Personal", `Has recibido una calificación de ${nuevaValoracionUsuario.calificacion} estrellas de parte de ${usuarioLogueado.nombre}.`);
      }
      alert('¡Reseña del perfil enviada con éxito!');
    }
  };

  const obtenerPermisoParaValorarAnfitrion = (prop) => {
    if (!usuarioLogueado || !prop) {
      return { puedeValorar: false, yaValoro: false, contexto: null };
    }

    const propietarioId = prop.propietario_id || prop.propietarioId;
    const ahora = new Date();

    const reservasElegibles = reservas
      .filter(r =>
        String(r.propiedadId) === String(prop.id) &&
        (String(r.inquilinoId) === String(usuarioLogueado.id) ||
          String(r.inquilinoDni) === String(usuarioLogueado.dni)) &&
        ['Completada', 'Finalizada'].includes(r.estado) &&
        new Date(`${r.fechaFin}T23:59:59`) < ahora
      )
      .map(r => ({
        bookingType: 'reserva',
        bookingId: r.id,
        propiedadId: prop.id,
        autorId: usuarioLogueado.id,
        receptorId: propietarioId,
        rolAutor: 'huesped',
        rolReceptor: 'anfitrion'
      }));

    const contratosElegibles = contratos
      .filter(c =>
        String(c.propiedadId) === String(prop.id) &&
        (String(c.inquilinoId) === String(usuarioLogueado.id) ||
          String(c.dniInquilino) === String(usuarioLogueado.dni)) &&
        ['Completado', 'Finalizado'].includes(c.estado) &&
        new Date(`${c.fechaFin}T23:59:59`) < ahora
      )
      .map(c => ({
        bookingType: 'contrato',
        bookingId: c.id,
        propiedadId: prop.id,
        autorId: usuarioLogueado.id,
        receptorId: propietarioId,
        rolAutor: 'huesped',
        rolReceptor: 'anfitrion'
      }));

    const contexto = [...reservasElegibles, ...contratosElegibles][0] || null;

    if (!contexto) {
      return { puedeValorar: false, yaValoro: false, contexto: null };
    }

    const yaValoro = valoracionesUsuarios.some(v =>
      v.bookingType === contexto.bookingType &&
      String(v.bookingId) === String(contexto.bookingId) &&
      String(v.autorId) === String(usuarioLogueado.id)
    );

    return {
      puedeValorar: !yaValoro,
      yaValoro,
      contexto
    };
  };

  const abrirPerfilDesdeAdmin = (user) => {
    setPerfilPublicoAbierto({
      ...user,
      tipoPerfil:
        user.estado_verificacion === 'pendiente' || user.rol === 'propietario'
          ? 'anfitrion'
          : 'huesped'
    });
  };

  const abrirPublicacionDesdeAdmin = (prop) => {
    setPropiedadSeleccionada(prop);
    setVistaActual('detalle-propiedad');
  };

  // COMPONENTE DE ENCABEZADO GLOBAL
  const renderHeader = () => (
    <nav className="flex items-center justify-between px-8 h-24 bg-canvas border-b border-gray-100 shadow-sm shrink-0 sticky top-0 z-50">
      <div className="font-bold text-2xl flex items-center gap-1 tracking-tight">
        <span className="text-primary">Zenith</span> <span className="text-ink">Alquileres</span>
      </div>

      <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">

        {!usuarioLogueado ? (
          <>
            {vistaActual !== 'inicio' ? (
              <button className="font-medium text-ink hover:bg-gray-100 px-5 py-2.5 rounded-full transition-all duration-200" onClick={() => setVistaActual('inicio')}>
                Volver al Inicio
              </button>
            ) : (
              <button className="font-medium text-ink hover:bg-gray-100 px-5 py-2.5 rounded-full transition-all duration-200" onClick={() => setVistaActual('buscador')}>
                Explorar
              </button>
            )}
            <button className="font-semibold text-primary hover:bg-rose-50 px-5 py-2.5 rounded-full transition-all duration-200" onClick={() => setVistaActual('login')}>
              Iniciar Sesión
            </button>
            <button className="bg-primary text-white font-medium px-6 py-2.5 rounded-full hover:bg-rose-600 transition-all duration-200 shadow-sm" onClick={() => setVistaActual('registro')}>
              Registrarse
            </button>
          </>
        ) : (
          <>
            <span className="hidden lg:inline-block font-medium text-ink mr-4">Hola, {usuarioLogueado.nombre}</span>

            <button className={`font-semibold px-5 py-2.5 rounded-full transition-all duration-200 ${vistaActual === 'buscador' ? 'bg-rose-50 text-primary' : 'text-muted hover:bg-gray-100 hover:text-ink'}`} onClick={() => setVistaActual('buscador')}>
              Explorar
            </button>

            {(usuarioLogueado.rol === 'propietario' || usuarioLogueado.rol === 'admin') && (
              <button className={`font-medium px-5 py-2.5 rounded-full transition-all duration-200 ${['mi-panel', 'mensajes', 'panel-cobros'].includes(vistaActual) ? 'bg-rose-50 text-primary' : 'text-muted hover:bg-gray-100 hover:text-ink'}`} onClick={() => setVistaActual(usuarioLogueado.rol === 'admin' ? 'panel-admin' : 'mi-panel')}>
                {usuarioLogueado.rol === 'admin' ? 'Panel Admin' : 'Mi Panel'}
              </button>
            )}

            {usuarioLogueado.rol !== 'admin' && (
              <>
                <button className={`font-medium px-5 py-2.5 rounded-full transition-all duration-200 hidden md:inline-block ${vistaActual === 'mis-alquileres' ? 'bg-rose-50 text-primary' : 'text-muted hover:bg-gray-100 hover:text-ink'}`} onClick={() => setVistaActual('mis-alquileres')}>
                  Mis Alquileres
                </button>

                {usuarioLogueado.rol !== 'propietario' && (
                  <button
                    className={`font-medium px-5 py-2.5 rounded-full transition-all duration-200 hidden md:inline-block relative ${
                      vistaActual === 'mensajes'
                        ? 'bg-rose-50 text-primary'
                        : 'text-muted hover:bg-gray-100 hover:text-ink'
                    }`}
                    onClick={() => setVistaActual('mensajes')}
                  >
                    Mensajes

                    {notificacionesMensajes > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[11px] rounded-full flex items-center justify-center">
                        {notificacionesMensajes}
                      </span>
                    )}
                  </button>
                )}

                {(() => {
                  const noLeidas = notificaciones.filter(n => String(n.usuario_id) === String(usuarioLogueado.id) && !n.leida).length;
                  return (
                    <button className="font-medium px-5 py-2.5 rounded-full transition-all duration-200 text-muted hover:bg-gray-100 hover:text-ink relative" onClick={handleAbrirNotificaciones}>
                      Notificaciones
                      {noLeidas > 0 && <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-white"></span>}
                    </button>
                  );
                })()}
              </>
            )}

            <button className={`font-medium px-5 py-2.5 rounded-full transition-all duration-200 ${vistaActual === 'perfil' ? 'bg-rose-50 text-primary' : 'text-muted hover:bg-gray-100 hover:text-ink'}`} onClick={() => setVistaActual('perfil')}>
              Perfil
            </button>

            {usuarioLogueado?.rol === 'inquilino' && (
              <button className={`font-medium px-5 py-2.5 rounded-full transition-all duration-200 text-primary border border-gray-200 hover:border-rose-300 hover:bg-rose-50 hidden md:inline-block ${vistaActual === 'registro-propietario' ? 'bg-rose-50' : ''}`} onClick={() => setVistaActual('registro-propietario')}>
                ¿Querés publicar?
              </button>
            )}

            <button className="font-medium px-5 py-2.5 rounded-full transition-all duration-200 text-rose-600 hover:bg-rose-50" onClick={() => {
                                                                                                          localStorage.removeItem('zenith_usuario_logueado');
                                                                                                          localStorage.removeItem('zenith_pago_pendiente');
                                                                                                          setUsuarioLogueado(null);
                                                                                                          setVistaActual('inicio');
                                                                                                        }}>
              Salir
            </button>
          </>
        )}
      </div>
    </nav>
  );

  // VISTA 0: LANDING PAGE (PÁGINA DE INICIO)
  if (vistaActual === 'inicio') {
    return (
      <div className="min-h-screen bg-canvas font-sans">

        {/* BARRA DE NAVEGACIÓN DE INICIO */}
        {renderHeader()}

        {/* SECCIÓN HERO */}
        <header className="px-6 py-16 md:py-24 max-w-[1280px] mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <h1 className="text-[40px] md:text-[56px] font-bold text-ink leading-tight tracking-tight">
              ¿Casas? Tenemos.<br /><span className="text-primary">¿Excusas? No.</span>
            </h1>
            <p className="text-lg text-muted max-w-md">
              Descubrí tu próximo hogar o empezá a generar ingresos con tu propiedad. Disfrutá la experiencia Airbnb, simple y segura.
            </p>
            <div className="pt-4 flex flex-wrap gap-4">
              <button
                className="bg-primary text-white px-[24px] py-[14px] rounded-sm font-medium hover:opacity-90 transition shadow-sm text-[16px]"
                onClick={() => setVistaActual('buscador')}>
                Explorar propiedades
              </button>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <img
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
              alt="Casa moderna"
              className="w-full h-[400px] md:h-[500px] object-cover rounded-xl shadow-lg"
            />
          </div>
        </header>

        {/* SECCIÓN SERVICIOS */}
        <section className="px-6 py-16 max-w-[1280px] mx-auto">
          <h2 className="text-[28px] font-bold text-ink mb-8">Nuestros servicios</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-canvas border border-gray-200 rounded-lg p-8 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-shadow flex flex-col items-start gap-4">
              <div className="bg-rose-50 p-4 rounded-full text-primary">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[22px] font-bold text-ink tracking-tight">Buscá tu nuevo hogar</h3>
                <p className="text-muted mt-2 text-[16px] leading-relaxed">¡Queremos ayudarte! Explora miles de opciones y encuentra el lugar perfecto para ti con la mejor seguridad.</p>
              </div>
              <button
                className="mt-6 bg-white border border-gray-800 text-ink px-[24px] py-[12px] rounded-sm font-medium hover:bg-gray-50 transition w-full md:w-auto"
                onClick={() => setVistaActual('buscador')}>
                Buscar
              </button>
            </div>

            <div className="bg-canvas border border-gray-200 rounded-lg p-8 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-shadow flex flex-col items-start gap-4">
              <div className="bg-rose-50 p-4 rounded-full text-primary">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[22px] font-bold text-ink tracking-tight">Publicá tu propiedad</h3>
                <p className="text-muted mt-2 text-[16px] leading-relaxed">¿Estás pensando en alquilar tu casa? Llega a miles de inquilinos verificados y alquila de forma rápida y confiable.</p>
              </div>
              <button
                className="mt-6 bg-primary text-white border border-transparent px-[24px] py-[12px] rounded-sm font-medium hover:bg-primary-active transition shadow-sm w-full md:w-auto"
                onClick={() => {
                  if (!usuarioLogueado) setVistaActual('login');
                  else if (usuarioLogueado.rol === 'propietario') setVistaActual('publicar-inmueble');
                  else setVistaActual('registro-propietario');
                }}>
                Publicar
              </button>
            </div>

          </div>
        </section>

        {/* SECCIÓN INFORMACIÓN CON IMÁGENES */}
        <section className="px-6 py-20 bg-gray-50 border-t border-gray-200 mt-8">
          <div className="max-w-[1280px] mx-auto space-y-24">

            {/* Fila 1 */}
            <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
              <div className="flex-1 w-full relative">
                <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Departamento moderno" className="w-full h-[350px] md:h-[450px] object-cover rounded-xl shadow-md" />
              </div>
              <div className="flex-1 space-y-4">
                <h2 className="text-[32px] font-bold text-ink leading-tight tracking-tight">+200 propiedades activas</h2>
                <p className="text-body text-[16px] leading-relaxed">
                  Descubre un catálogo único con más de 200 propiedades activas listas para convertirse en tu próximo hogar o inversión. Desde modernos departamentos en el centro de la ciudad hasta amplias casas familiares en zonas tranquilas, pasando por terrenos con gran potencial. Cada propiedad es cuidadosamente seleccionada para ofrecer calidad, ubicación y comodidad. ¡La llave de tu nuevo comienzo puede estar a un clic de distancia!
                </p>
              </div>
            </div>

            {/* Fila 2 */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-20">
              <div className="flex-1 w-full relative">
                <img src="https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Contrato exitoso" className="w-full h-[350px] md:h-[450px] object-cover rounded-xl shadow-md" />
              </div>
              <div className="flex-1 space-y-4">
                <h2 className="text-[32px] font-bold text-ink leading-tight tracking-tight">120 contratos cerrados en el último mes</h2>
                <p className="text-body text-[16px] leading-relaxed">
                  Nuestra experiencia y dedicación se reflejan en los resultados: en el último mes, ayudamos a más de 120 personas a encontrar su hogar ideal o cerrar acuerdos de alquiler exitosos. Este logro demuestra nuestro compromiso con la excelencia y la satisfacción de nuestros clientes, garantizando procesos seguros.
                </p>
              </div>
            </div>

          </div>
        </section>
      </div>
    );
  }


  // VISTA 3: PERFIL DEL USUARIO (RF3)
  if (vistaActual === 'perfil' && usuarioLogueado) {
    return (

      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        <div className="auth-container" style={{ minHeight: 'calc(100vh - 80px)', backgroundColor: 'transparent' }}>
          <div className="auth-card perfil-card">
            <h2>Mi Perfil</h2>
            <p>Gestiona tu información personal</p>

            <form onSubmit={handleGuardarPerfil} className="auth-form">

              <div className="foto-perfil-container">
                <div className="foto-preview">
                  {usuarioLogueado.fotoPerfil ? (
                    <img src={usuarioLogueado.fotoPerfil} alt="Perfil" />
                  ) : (
                    <span className="foto-placeholder">Sin Foto</span>
                  )}
                </div>
                <label className="btn-upload">
                  Subir Foto
                  <input type="file" accept="image/*" onChange={handleFotoChange} hidden />
                </label>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="perfil-nombre">Nombre</label>
                  <input type="text" id="perfil-nombre" name="nombre" value={usuarioLogueado.nombre} onChange={handlePerfilChange} required />
                </div>
                <div className="form-group">
                  <label htmlFor="perfil-apellido">Apellido</label>
                  <input type="text" id="perfil-apellido" name="apellido" value={usuarioLogueado.apellido} onChange={handlePerfilChange} required />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="perfil-telefono">Teléfono</label>
                <input type="tel" id="perfil-telefono" name="telefono" value={usuarioLogueado.telefono} onChange={handlePerfilChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="perfil-bio">Biografía</label>
                <textarea
                  id="perfil-bio"
                  name="bio"
                  rows="4"
                  value={usuarioLogueado.bio || ''}
                  onChange={handlePerfilChange}
                  placeholder="Cuéntale a otros usuarios algo sobre ti..."
                  className="perfil-textarea"
                />
              </div>

              <div className="form-group">
                <label htmlFor="perfil-idiomas">Idiomas</label>
                <input
                  type="text"
                  id="perfil-idiomas"
                  name="idiomas"
                  value={Array.isArray(usuarioLogueado.idiomas) ? usuarioLogueado.idiomas.join(', ') : (usuarioLogueado.idiomas || '')}
                  onChange={handlePerfilChange}
                  placeholder="Español, Inglés, Portugués"
                />
                <small className="perfil-help-text">Separalos con coma.</small>
              </div>

              <div className="form-group">
                <label htmlFor="perfil-intereses">Intereses</label>
                <input
                  type="text"
                  id="perfil-intereses"
                  name="intereses"
                  value={Array.isArray(usuarioLogueado.intereses) ? usuarioLogueado.intereses.join(', ') : (usuarioLogueado.intereses || '')}
                  onChange={handlePerfilChange}
                  placeholder="Viajes, lectura, música, deporte"
                />
                <small className="perfil-help-text">Separalos con coma.</small>
              </div>
              <div className="form-group">
                <label htmlFor="perfil-email">Email (No editable)</label>
                <input type="email" id="perfil-email" name="email" value={usuarioLogueado.email} disabled />
              </div>

              {/* BOTONES APILADOS VERTICALMENTE */}
              <div className="perfil-acciones-stack">

                <button type="submit" className="btn-submit btn-full">
                  Guardar Cambios
                </button>

                <button
                  type="button"
                  className="btn-cerrar-sesion-perfil btn-full"
                  onClick={() => {
                        localStorage.removeItem('zenith_usuario_logueado');
                        localStorage.removeItem('zenith_pago_pendiente');
                        setUsuarioLogueado(null);
                        setVistaActual('inicio');
                      }}
                >
                  Cerrar Sesión
                </button>

                <button
                  type="button"
                  className="btn-danger btn-full"
                  onClick={handleEliminarCuenta}
                >
                  Eliminar Cuenta
                </button>

              </div>

            </form>
          </div>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL: BUSCADOR Y FEED DE PROPIEDADES (RF14 y RF15)
  if (vistaActual === 'buscador') {
    // Lógica de filtrado dinámico (RF14)
    const propiedadesFiltradas = propiedades.filter(prop => {
      // 1. Solo mostramos propiedades activas
      if (prop.estado !== 'activo') return false;

      // 2. TRADUCTOR: Aceptamos tanto camelCase (local) como snake_case (Supabase)
      const tipoInmueble = prop.tipo_inmueble || prop.tipoInmueble;
      const tipoOperacion = prop.tipo_operacion || prop.tipoOperacion;
      const tipoGarantia = prop.tipo_garantia || prop.tipoGarantia;
      const pagoInicial = prop.pago_inicial || prop.pagoInicial;
      const pagoDiario = prop.pago_diario || prop.pagoDiario;
      const servicios = prop.servicios || [];

      // FILTRO INTELIGENTE DE FECHAS
      if (filtros.fechaInicio && filtros.fechaFin) {
        if (filtros.fechaInicio <= filtros.fechaFin) {
          const filtroInicio = new Date(filtros.fechaInicio + 'T00:00:00');
          const filtroFin = new Date(filtros.fechaFin + 'T00:00:00');

          // Verificamos contratos de largo plazo
          const tieneSuperposicionContrato = contratos.some(contrato => {
            if (contrato.propiedadId !== prop.id || contrato.estado !== 'activo') return false;
            const contratoInicio = new Date(contrato.fechaInicio + 'T00:00:00');
            const contratoFin = new Date(contrato.fechaFin + 'T00:00:00');
            return (filtroInicio <= contratoFin) && (filtroFin >= contratoInicio);
          });

          // Verificamos reservas temporales activas
          const tieneSuperposicionReserva = reservas.some(reserva => {
            if (reserva.propiedadId !== prop.id || reserva.estado !== 'Confirmada') return false;
            const reservaInicio = new Date(reserva.fechaInicio + 'T00:00:00');
            const reservaFin = new Date(reserva.fechaFin + 'T00:00:00');
            return (filtroInicio <= reservaFin) && (filtroFin >= reservaInicio);
          });

          // Si choca con ALGO, la ocultamos de los resultados
          if (tieneSuperposicionContrato || tieneSuperposicionReserva) return false;
        }
      }

      // 3. Aplicamos los filtros exactos
      if (filtros.tipoInmueble && tipoInmueble !== filtros.tipoInmueble) return false;
      if (filtros.tipoOperacion && tipoOperacion !== filtros.tipoOperacion) return false;
      if (filtros.tipoGarantia && tipoOperacion === 'largo_plazo' && tipoGarantia !== filtros.tipoGarantia) return false;
      if (filtros.ambientes && Number(prop.habitaciones) < Number(filtros.ambientes)) return false;
      if (filtros.precioMaximo) {
        const precio = tipoOperacion === 'largo_plazo' ? pagoInicial : pagoDiario;
        if (Number(precio) > Number(filtros.precioMaximo)) return false;
      }

      // 4. Filtros booleanos de servicios
      if (filtros.mascotas && !servicios.includes('Mascotas')) return false;
      if (filtros.cochera && !servicios.includes('Cochera')) return false;
      if (filtros.balcon && !servicios.includes('Balcón')) return false;
      if (filtros.internet && !servicios.includes('Internet')) return false;
      if (filtros.gas && !servicios.includes('Gas')) return false;
      if (filtros.luz && !servicios.includes('Electricidad')) return false;
      if (filtros.agua && !servicios.includes('Agua')) return false;

      return true;
    });

    return (
      <div className="min-h-screen bg-canvas font-sans flex flex-col">
        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        <div className="flex flex-col lg:flex-row max-w-[1440px] mx-auto w-full px-6 py-8 gap-8 flex-1">

          {/* BARRA LATERAL DE FILTROS */}
          <aside className="w-full lg:w-[320px] shrink-0 bg-canvas border border-gray-200 rounded-xl p-6 h-fit lg:sticky lg:top-[120px] shadow-sm">
            <h3 className="text-xl font-bold text-ink mb-6 pb-4 border-b border-gray-200">Filtros</h3>

            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink text-sm">Disponibilidad</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <DatePicker
                    selected={filtros.fechaInicio ? new Date(filtros.fechaInicio) : null}
                    onChange={(date) => setFiltros({ ...filtros, fechaInicio: date ? date.toISOString().split('T')[0] : '' })}
                    placeholderText="Ingreso"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    dateFormat="yyyy-MM-dd"
                  />
                  <DatePicker
                    selected={filtros.fechaFin ? new Date(filtros.fechaFin) : null}
                    onChange={(date) => setFiltros({ ...filtros, fechaFin: date ? date.toISOString().split('T')[0] : '' })}
                    placeholderText="Salida"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    dateFormat="yyyy-MM-dd"
                  />
                </div>
                {filtros.fechaInicio && filtros.fechaFin && filtros.fechaInicio > filtros.fechaFin && (
                  <span className="text-primary text-xs mt-1 font-medium">La salida es anterior al ingreso.</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink text-sm">Operación</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-sm" name="tipoOperacion" value={filtros.tipoOperacion} onChange={handleFiltroChange}>
                  <option value="">Todos</option>
                  <option value="largo_plazo">Largo Plazo</option>
                  <option value="temporal">Temporal</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink text-sm">Tipo Inmueble</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-sm" name="tipoInmueble" value={filtros.tipoInmueble} onChange={handleFiltroChange}>
                  <option value="">Todos</option>
                  <option value="departamento">Departamento</option>
                  <option value="casa">Casa</option>
                  <option value="monoambiente">Monoambiente</option>
                </select>
              </div>

              {filtros.tipoOperacion !== 'temporal' && (
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-ink text-sm">Tipo de Garantía</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-sm" name="tipoGarantia" value={filtros.tipoGarantia} onChange={handleFiltroChange}>
                    <option value="">Todas</option>
                    <option value="propietaria">Garantía Propietaria</option>
                    <option value="caucion">Seguro de Caución</option>
                    <option value="aval_bancario">Aval Bancario</option>
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink text-sm">Presupuesto Máximo ($)</label>
                <input
                  type="number"
                  name="precioMaximo"
                  value={filtros.precioMaximo}
                  onChange={handleFiltroChange}
                  placeholder="Ej: 300000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                <label className="font-semibold text-ink text-sm">Comodidades</label>
                <div className="flex flex-col gap-3 text-ink text-sm">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="mascotas" checked={filtros.mascotas} onChange={handleFiltroChange} /> Mascotas permitidas</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="cochera" checked={filtros.cochera} onChange={handleFiltroChange} /> Cochera</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="balcon" checked={filtros.balcon} onChange={handleFiltroChange} /> Balcón</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="internet" checked={filtros.internet} onChange={handleFiltroChange} /> Internet</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="gas" checked={filtros.gas} onChange={handleFiltroChange} /> Gas</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="luz" checked={filtros.luz} onChange={handleFiltroChange} /> Electricidad</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" name="agua" checked={filtros.agua} onChange={handleFiltroChange} /> Agua</label>
                </div>
              </div>
            </div>
          </aside>

          {/* FEED DE PROPIEDADES (TARJETAS MODERNAS) */}
          <main className="flex-1">
            {propiedadesFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h3 className="text-lg font-bold text-ink">No hay resultados</h3>
                <p className="text-muted mt-2">Intenta modificar o borrar algunos filtros para ver más propiedades.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max">
                {propiedadesFiltradas.map(prop => {

                  const tipoOperacion = prop.tipo_operacion || prop.tipoOperacion;
                  const tipoInmueble = prop.tipo_inmueble || prop.tipoInmueble;
                  const alquilerMensual = prop.alquiler_mensual || prop.alquilerMensual;
                  const pagoDiario = prop.pago_diario || prop.pagoDiario;

                  const fotoPrincipal = prop.fotos && prop.fotos.length > 0
                    ? prop.fotos[0]
                    : 'https://via.placeholder.com/400x300?text=Sin+Foto';

                  return (
                    <div
                      key={prop.id}
                      className="group cursor-pointer flex flex-col relative"
                      onClick={() => {
                        setDatosReserva({ fechaInicio: '', fechaFin: '' });
                        setPropiedadSeleccionada(prop);
                        setVistaActual('detalle-propiedad');
                      }}
                    >
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden relative mb-3 bg-gray-200">
                        <img
                          src={fotoPrincipal}
                          alt={prop.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
                        />
                        <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
                          <span className="bg-white/90 px-2 py-1 rounded text-xs font-semibold text-ink shadow-sm capitalize w-fit">{tipoInmueble}</span>
                          <span className="bg-white/90 px-2 py-1 rounded text-xs font-semibold text-ink shadow-sm w-fit">{tipoOperacion === 'temporal' ? 'Temporal' : 'Largo Plazo'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col flex-1 pl-1">
                        <h3 className="font-semibold text-[15px] text-ink truncate block" title={prop.titulo}>{prop.titulo}</h3>
                        <p className="text-muted text-[15px] block truncate">{prop.direccion}, {prop.ciudad}</p>
                        <div className="mt-1 text-ink flex items-end">
                          <span className="font-semibold text-[15px] leading-tight">${tipoOperacion === 'largo_plazo' ? alquilerMensual : pagoDiario}</span>
                          <span className="text-[15px] ml-1 leading-tight">{tipoOperacion === 'largo_plazo' ? 'por mes' : 'por día'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // VISTA 11: MIS ALQUILERES Y PAGOS (RF19 al RF24)
  if (vistaActual === 'mis-alquileres' && usuarioLogueado) {
    const misContratos = contratos.filter(c => String(c.dniInquilino) === String(usuarioLogueado.dni));
    // Filtramos las reservas del usuario actual
    const misReservasTemporales = reservas.filter(r => String(r.inquilinoDni) === String(usuarioLogueado.dni));

    // LÓGICA DE CANCELACIÓN Y REEMBOLSOS (REGLA DE LAS 48HS / 7 DÍAS)
    const handleCancelarReserva = async (reserva) => {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const inicio = new Date(reserva.fechaInicio + 'T00:00:00');

      if (hoy >= inicio) {
        alert("Error: No puedes cancelar una reserva que ya comenzó o que inicia hoy.");
        return;
      }

      // Calculamos la diferencia de tiempo
      const diferenciaMs = inicio - hoy;
      const diferenciaHoras = diferenciaMs / (1000 * 60 * 60);
      const diferenciaDias = diferenciaHoras / 24;

      let porcentajeReembolso = 0;
      if (diferenciaDias > 7) {
        porcentajeReembolso = 100;
      } else if (diferenciaHoras >= 48) {
        porcentajeReembolso = 50;
      } else {
        porcentajeReembolso = 0;
      }

      const montoAReembolsar = (Number(reserva.precioTotal) * porcentajeReembolso) / 100;

      const confirmacion = window.confirm(`Estás por cancelar tu reserva.\n\nFaltan ${Math.floor(diferenciaDias)} días para tu ingreso.\nTe corresponde un reembolso del ${porcentajeReembolso}% ($${montoAReembolsar.toFixed(2)}).\n\n¿Deseas confirmar la cancelación?`);

      if (confirmacion) {
        try {
          // Actualizamos en Supabase (Ahora el estado de pago pasa a 'Liberado' automáticamente)
          const { error } = await supabase
            .from('reservas')
            .update({
              estado: 'Cancelada',
              estado_pago: 'Liberado', // Zenith suelta la plata retenida
              monto_reembolso: montoAReembolsar
            })
            .eq('id', reserva.id);

          if (error) throw error;

          alert("Reserva cancelada con éxito. Los fondos han sido liberados según la política de cancelación.");

          // Actualizamos la vista local
          setReservas(reservas.map(r =>
            r.id === reserva.id
              ? { ...r, estado: 'Cancelada', estadoPago: 'Liberado', montoReembolso: montoAReembolsar }
              : r
          ));

        } catch (error) {
          alert("Hubo un error al cancelar: " + error.message);
          console.error(error);
        }
      }
    };

    const obtenerEstadoContrato = (fechaFin) => {
      const hoy = new Date();
      const fin = new Date(fechaFin);
      return fin >= hoy ? 'Activo' : 'Finalizado';
    };

    // MOTOR MATEMÁTICO: Genera el plan de cuotas proyectado
    const generarCronograma = (contrato, pagosRealizados) => {
      const plan = [];
      const pagos = [...pagosRealizados].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      let fechaActual = new Date(contrato.fechaInicio + 'T00:00:00');
      const fechaFin = new Date(contrato.fechaFin + 'T00:00:00');
      const hoy = new Date();
      let cuotaNum = 1;

      // Generación exclusiva para Largo Plazo (Contrato tradicional)
      while (fechaActual <= fechaFin) {
        const esPrimerMes = cuotaNum === 1;
        const monto = esPrimerMes ? (Number(contrato.alquilerMensual) + Number(contrato.montoDeposito)) : Number(contrato.alquilerMensual);
        const concepto = esPrimerMes ? 'Ingreso: Mes 1 + Depósito' : `Cuota ${cuotaNum}: Alquiler Mensual`;

        let fechaLimite = new Date(fechaActual);
        fechaLimite.setDate(fechaLimite.getDate() + 9); // Vencimiento a los 10 días

        plan.push(crearEstadoCuota(cuotaNum, concepto, monto, fechaLimite, pagos, hoy, contrato.interesesMora));
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        cuotaNum++;
      }

      return plan;
    };

    const crearEstadoCuota = (numero, concepto, montoBase, fechaLimite, pagos, hoy, interesMora) => {
      const pagoAsociado = pagos[numero - 1];
      let estado = 'Pendiente';

      hoy.setHours(0, 0, 0, 0);
      fechaLimite.setHours(0, 0, 0, 0);

      const estaVencido = hoy > fechaLimite;
      const recargoMora = (estaVencido && numero > 1 && interesMora > 0) ? (montoBase * (Number(interesMora) / 100)) : 0;
      const montoTotal = montoBase + recargoMora;

      if (pagoAsociado) {
        estado = pagoAsociado.estado === 'Aprobado' ? 'Pagado' : 'En Revisión';
      } else {
        estado = estaVencido ? 'Vencido' : 'Pendiente';
      }

      return { numero, concepto, montoBase, recargoMora, montoTotal, fechaLimite: fechaLimite.toLocaleDateString(), estado, pagoAsociado };
    };

    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        {/* CONTENEDOR CENTRAL DE MIS ALQUILERES */}
        <div className="dashboard-panel-wrapper mis-alquileres-wrapper">
          <div className="auth-card full-width-card">

            <h2 className="titulo-seccion-alquileres">
              Mis Contratos (Largo Plazo)
            </h2>

            {misContratos.length === 0 ? (
              <p className="mensaje-vacio-reservas">No tienes contratos asociados a tu DNI en el historial.</p>
            ) : (
              <div className="propiedades-grid">
                {misContratos.map(contrato => {
                  const estadoContrato = obtenerEstadoContrato(contrato.fechaFin);
                  const propInfo = propiedades.find(p => p.id === contrato.propiedadId) || { titulo: 'Propiedad no encontrada' };
                  const misPagos = pagos.filter(p => p.contratoId === contrato.id);
                  const problemasDelContrato = problemas.filter(p => p.contratoId === contrato.id);

                  const dueño = usuarios.find(u => u.id === contrato.propietarioId) || {};
                  const destinatarioNombre = dueño.nombre ? `${dueño.nombre} ${dueño.apellido}` : 'Propietario';
                  const destinatarioCBU = dueño.cbu || 'No registrado';

                  const cronograma = generarCronograma(contrato, misPagos);

                  return (
                    <div key={contrato.id} className={`propiedad-card reserva-card-item ${estadoContrato === 'Finalizado' ? 'inactiva' : ''}`}>
                      <div className="reserva-card-header">
                        <h3 className="prop-titulo titulo-sin-margen">{propInfo.titulo}</h3>
                        <span className={`badge-estado ${estadoContrato.toLowerCase()}`}>{estadoContrato}</span>
                      </div>

                      <div className="prop-detalles reserva-detalles-box">
                        <span><strong>Fechas:</strong> {contrato.fechaInicio} al {contrato.fechaFin}</span>
                        <span><strong>Tipo:</strong> {contrato.tipoAlquiler === 'largo_plazo' ? 'Largo Plazo' : 'Temporal'}</span>
                        {contrato.tipoAlquiler === 'largo_plazo' ? (
                          <>
                            <span><strong>Garantía:</strong> <span style={{ textTransform: 'capitalize' }}>{contrato.garantia?.replace('_', ' ')}</span></span>
                            <span><strong>Depósito:</strong> ${contrato.montoDeposito}</span>
                          </>
                        ) : (
                          <span><strong>Frecuencia Pago:</strong> <span style={{ textTransform: 'capitalize' }}>{contrato.frecuenciaPago}</span></span>
                        )}

                        <button className="btn-submit btn-peligro-chico" onClick={() => setModalProblema(contrato)}>
                          ⚠️ Reportar Problema
                        </button>
                      </div>

                      <h4 className="subtitulo-plan-pagos">Plan de Pagos</h4>

                      <div className="tabla-contenedor">
                        <table className="tabla-pagos tabla-pagos-limpia">
                          <thead>
                            <tr>
                              <th>Concepto</th>
                              <th>Vencimiento</th>
                              <th>Monto</th>
                              <th>Destinatario</th>
                              <th>Estado</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cronograma.map(cuota => (
                              <tr key={cuota.numero}>
                                <td className="tabla-celda-concepto">{cuota.concepto}</td>
                                <td className={`tabla-celda-fecha ${cuota.estado === 'Vencido' ? 'texto-vencido' : ''}`}>
                                  🗓️ {cuota.fechaLimite}
                                </td>
                                <td className="tabla-celda-monto">${cuota.montoTotal.toFixed(2)}</td>

                                <td className="tabla-celda-detalle">
                                  <strong>{destinatarioNombre}</strong><br />
                                  <span className="texto-cbu-chico">CBU: {destinatarioCBU}</span>
                                </td>

                                <td>
                                  <span className={`badge-estado-pago estado-${cuota.estado.toLowerCase().replace(' ', '-')}`}>
                                    {cuota.estado}
                                  </span>
                                </td>
                                <td>
                                  {(cuota.estado === 'Pendiente' || cuota.estado === 'Vencido') && estadoContrato === 'Activo' && (
                                    <button
                                      className="btn-submit btn-pagar-chico"
                                      onClick={() => setModalPago({ ...contrato, cuotaSeleccionada: cuota, infoDueño: dueño })}
                                    >
                                      💸 Pagar
                                    </button>
                                  )}
                                  {cuota.estado === 'Pagado' && (
                                    <button
                                      className="btn-link btn-descarga-chico"
                                      onClick={() => alert(`🧾 COMPROBANTE DE PAGO\n\nOperación procesada por Mercado Pago.\n\nConcepto: ${cuota.concepto}\nMonto abonado: $${cuota.montoTotal.toFixed(2)}\nFecha: ${cuota.pagoAsociado?.fecha}\nReferencia: ${cuota.pagoAsociado?.comprobanteUrl}`)}
                                    >
                                      📄 Ver Recibo
                                    </button>
                                  )}
                                  {cuota.estado === 'En Revisión' && <span className="texto-procesando">⏳ Procesando</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* =========================================
                          SECCIÓN NUEVA: PROBLEMAS REPORTADOS (INQUILINO)
                          ========================================= */}
                      {problemasDelContrato.length > 0 && (
                        <div className="panel-problemas-dashboard">
                          <h4 className="panel-problemas-titulo">
                            ⚠️ Mis Reportes de Mantenimiento
                          </h4>

                          {problemasDelContrato.map(prob => (
                            <div key={prob.id} className="problema-item-card">

                              <div className="problema-item-header">
                                <div>
                                  <p className="problema-item-texto"><strong>Fecha del reporte:</strong> {prob.fecha}</p>
                                  <p className="problema-item-detalle"><strong>Detalle:</strong> "{prob.descripcion}"</p>
                                </div>

                                <span className={`badge-problema badge-${prob.estado === 'Resuelto' ? 'resuelto' : 'pendiente'}`}>
                                  {prob.estado === 'Resuelto' ? '✔️ Resuelto' : '⏳ Pendiente de solución'}
                                </span>
                              </div>

                              {/* Botón para contactar al dueño si no está resuelto */}
                              {prob.estado !== 'Resuelto' && (
                                <div className="problema-item-acciones">
                                  <button
                                    className="btn-submit btn-problema-chat"
                                    onClick={() => handleChatDesdeProblema(prob)}
                                  >
                                    💬 Consultar al Propietario
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

            {/* =========================================
                SECCIÓN: MIS RESERVAS TEMPORALES
                ========================================= */}
            <h2 className="titulo-reservas">Mis Reservas Temporales</h2>

            {misReservasTemporales.length === 0 ? (
              <p className="mensaje-vacio-reservas">No tienes reservas temporales registradas.</p>
            ) : (
              <div className="propiedades-grid">
                {misReservasTemporales.map(reserva => {
                  const propInfo = propiedades.find(p => p.id === reserva.propiedadId) || { titulo: 'Propiedad no encontrada' };

                 // Verificamos el estado visual según las fechas
                      const hoy = new Date();
                      hoy.setHours(0, 0, 0, 0);

                      const inicio = new Date(reserva.fechaInicio + 'T00:00:00');
                      inicio.setHours(0, 0, 0, 0);

                      const fin = new Date(reserva.fechaFin + 'T00:00:00');
                      fin.setHours(0, 0, 0, 0);

                      let estadoVisual = reserva.estado;

                      if (estadoVisual === 'Confirmada' && hoy > fin) {
                        estadoVisual = 'Finalizada';
                      } else if (estadoVisual === 'Confirmada' && hoy >= inicio && hoy <= fin) {
                        estadoVisual = 'Activa';
                      }

                  return (
                    <div key={reserva.id} className={`propiedad-card reserva-card-item ${estadoVisual === 'Cancelada' || estadoVisual === 'Finalizada' ? 'inactiva' : ''}`}>

                      <div className="reserva-card-header">
                        <h3 className="prop-titulo titulo-sin-margen">🏠 {propInfo.titulo}</h3>
                        <span className={`badge-estado ${estadoVisual === 'Confirmada' ? 'aprobado' : estadoVisual === 'Cancelada' ? 'rechazado' : ''}`}>
                          {estadoVisual}
                        </span>
                      </div>

                      <div className="prop-detalles reserva-detalles-box">
                        <span><strong>Llegada:</strong> {reserva.fechaInicio}</span>
                        <span><strong>Salida:</strong> {reserva.fechaFin}</span>
                        <span><strong>Estadía:</strong> {reserva.cantidadDias} días</span>
                        <span><strong>Total Pagado:</strong> ${Number(reserva.precioTotal).toFixed(2)}</span>
                      </div>

                      {estadoVisual === 'Cancelada' && (
                        <div className="reserva-mensaje-cancelada">
                          {Number(reserva.montoReembolso) === 0 ? (
                            <p className="titulo-sin-margen"><strong>Cancelaste con menos de 48hs de anticipación.</strong> Según nuestras políticas, no corresponde devolución de dinero.</p>
                          ) : (
                            <div className="columna-gap-10">
                              <p className="titulo-sin-margen"><strong>Reserva cancelada.</strong> Monto reembolsado: ${Number(reserva.montoReembolso).toFixed(2)}</p>
                              <button
                                type="button"
                                className="btn-link btn-descarga-reembolso"
                                onClick={() => {
                                  descargarComprobanteTXT({
                                    concepto: `Reembolso por cancelación - ${propInfo.titulo}`,
                                    montoTotal: Number(reserva.montoReembolso),
                                    emisor: 'Zenith Alquileres (Cuenta Ficticia de Reintegros)',
                                    mensajePie: 'El dinero correspondiente al reembolso ya fue transferido a tu cuenta.'
                                  }, `DEV-${reserva.id}-${Date.now().toString().slice(-6)}`);
                                }}
                              >
                                📄 Descargar Comprobante de Reembolso
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {estadoVisual === 'Finalizada' && (
                        <div className="reserva-mensaje-finalizada">
                          <strong>¡Estadía finalizada!</strong> Esperamos que la hayas pasado excelente.
                        </div>
                      )}
                      {estadoVisual === 'Activa' && (
                      <div className="reserva-mensaje-finalizada">
                        <strong>Reserva activa.</strong> La estadía ya comenzó, por eso no puede cancelarse.
                      </div>
                    )}

                     {estadoVisual === 'Confirmada' && hoy < inicio && (
                    <button
                      className="btn-submit btn-cancelar-reserva"
                      onClick={() => handleCancelarReserva(reserva)}
                    >
                      ❌ Cancelar Reserva
                    </button>
                  )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div> {/* FIN CONTENEDOR CENTRAL */}

        {/* ========================================================
            MODAL DE PAGO SIMULADO (MERCADO PAGO)
            ======================================================== */}
        {modalPago && (
          <div className="modal-overlay">
            <div className="modal-content modal-pago-mp">

              <div className="header-mp-azul">
                <h3 className="titulo-sin-margen">Pagar con Mercado Pago</h3>
              </div>

              <div className="desglose-pago desglose-gris">
                <p><strong>Concepto:</strong> {modalPago.cuotaSeleccionada.concepto}</p>
                <p><strong>Monto Base:</strong> ${modalPago.cuotaSeleccionada.montoBase.toFixed(2)}</p>

                {modalPago.cuotaSeleccionada.recargoMora > 0 && (
                  <p className="texto-error">
                    <strong>Recargo por Mora ({modalPago.interesesMora}%):</strong> +${modalPago.cuotaSeleccionada.recargoMora.toFixed(2)}
                  </p>
                )}
              </div>

              <h3 className="total-mp-destacado">
                Total: ${modalPago.cuotaSeleccionada.montoTotal.toFixed(2)}
              </h3>

              <div className="mt-20">
               <CheckoutBrick
  precioAPagar={modalPago.cuotaSeleccionada.montoTotal}
  titulo={modalPago.cuotaSeleccionada.concepto}
  descripcion={`Pago de alquiler - ${modalPago.cuotaSeleccionada.concepto}`}
  payerEmail={usuarioLogueado.email}
  externalReference={`cuota_${modalPago.id}_${modalPago.cuotaSeleccionada.numero}_${Date.now()}`}
  metadata={{
    tipo: 'cuota',
    contratoId: modalPago.id,
    cuotaNumero: modalPago.cuotaSeleccionada.numero,
  }}
  pendingPayment={{
    tipo: 'cuota',
    contratoId: modalPago.id,
    propietarioId: modalPago.propietarioId,
    cuota: modalPago.cuotaSeleccionada,
    usuario: {
      id: usuarioLogueado.id,
      dni: usuarioLogueado.dni,
      nombre: usuarioLogueado.nombre,
      email: usuarioLogueado.email,
    },
  }}
/>

                <button type="button" className="btn-link btn-cancelar-mp-gris" onClick={() => setModalPago(null)}>
                  Cancelar / Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL DE REPORTE DE PROBLEMAS (RF25)
            ======================================================== */}
        {modalProblema && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="titulo-problema-rojo">Reportar Problema</h3>
              <p>Describe el inconveniente en la propiedad. El propietario será notificado de inmediato.</p>

              <form onSubmit={handleEnviarProblema}>
                <div className="form-group mt-20">
                  <label>Descripción del problema</label>
                  <textarea name="descripcionProblema" rows="4" required placeholder="Ej: Hay una pérdida de agua en el baño..." className="textarea-reporte"></textarea>
                </div>

                <div className="botones-reporte-flex">
                  <button type="submit" className="btn-submit btn-enviar-reporte">Enviar Reporte</button>
                  <button type="button" className="btn-danger btn-cancelar-reporte" onClick={() => setModalProblema(null)}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
  // VISTA NUEVA: PANEL DE COBROS Y CONTRATOS (AHORA INTEGRADO AL DASHBOARD)
  if (vistaActual === 'panel-cobros' && usuarioLogueado?.rol === 'propietario') {

    // MOTOR MATEMÁTICO: Genera el plan de cuotas proyectado para un contrato
    const generarCronograma = (contrato, pagosRealizados) => {
      const plan = [];
      const pagos = [...pagosRealizados].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      let fechaActual = new Date(contrato.fechaInicio + 'T00:00:00');
      const fechaFin = new Date(contrato.fechaFin + 'T00:00:00');
      const hoy = new Date();
      let cuotaNum = 1;

      while (fechaActual <= fechaFin) {
        const esPrimerMes = cuotaNum === 1;
        const monto = esPrimerMes ? (Number(contrato.alquilerMensual) + Number(contrato.montoDeposito)) : Number(contrato.alquilerMensual);
        const concepto = esPrimerMes ? 'Ingreso: Mes 1 + Depósito' : `Cuota ${cuotaNum}: Alquiler Mensual`;

        let fechaLimite = new Date(fechaActual);
        fechaLimite.setDate(fechaLimite.getDate() + 10);

        plan.push(crearEstadoCuota(cuotaNum, concepto, monto, fechaLimite, pagos, hoy));
        fechaActual.setMonth(fechaActual.getMonth() + 1);
        cuotaNum++;
      }
      return plan;
    };

    // Función auxiliar para determinar el estado de cada cuota
    const crearEstadoCuota = (numero, concepto, monto, fechaLimite, pagos, hoy) => {
      const pagoAsociado = pagos[numero - 1];
      let estado = 'Pendiente';
      if (pagoAsociado) {
        estado = pagoAsociado.estado === 'Aprobado' ? 'Pagado' : 'En Revisión';
      } else {
        hoy.setHours(0, 0, 0, 0);
        fechaLimite.setHours(0, 0, 0, 0);
        estado = hoy > fechaLimite ? 'Vencido' : 'Pendiente';
      }
      return { numero, concepto, monto, fechaLimite: fechaLimite.toLocaleDateString(), estado, pagoAsociado };
    };

    // Filtramos las reservas donde este usuario es el dueño
    const misReservasPropietario = reservas.filter(r => r.propietarioId === usuarioLogueado.id);

    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        {/* Contenedor central del Dashboard */}
        <div className="dashboard-panel-wrapper">

          {/* Cabecera del Panel con tu BOTÓN CELESTE INSTITUCIONAL */}
          <div className="dashboard-panel-header">
            <h1 className="dashboard-panel-title">Panel de Propietario</h1>

            <button
              className="btn-submit btn-crear-contrato-dashboard"
              style={{ backgroundColor: '#ff385c', margin: 0, width: 'auto', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 6px rgba(52, 152, 219, 0.2)' }}
              onClick={() => setVistaActual('crear-contrato')}
            >
              + Crear Contrato
            </button>
          </div>

          {/* Pestañas (Tabs) */}
          <div className="dash-tabs">
            <button className="dash-tab inactiva" onClick={() => setVistaActual('mi-panel')}>🏢 Mis Publicaciones</button>
            <button className="dash-tab inactiva" onClick={() => setVistaActual('mensajes')}>💬 Mensajes</button>
            <button className="dash-tab activa">📄 Contratos</button>
          </div>

          {/* Contenido de la Pestaña Contratos */}
          <div className="dash-contenido dash-contenido-contratos">

            <p className="hint-text hint-margen-amplio">
              Aquí puedes ver el cronograma automático de todos los pagos proyectados para tus inquilinos, sus fechas límite y gestionar los fondos de tus reservas.
            </p>

            {/* =========================================
                SECCIÓN 1: CONTRATOS A LARGO PLAZO
                ========================================= */}
            <h3 className="titulo-seccion-contratos">
              📝 Contratos Mensuales (Largo Plazo)
            </h3>

            {contratos.filter(c => c.propietarioId === usuarioLogueado.id).length === 0 ? (
              <div className="estado-vacio">Aún no tienes contratos activos a largo plazo.</div>
            ) : (
              contratos.filter(c => c.propietarioId === usuarioLogueado.id).map(contrato => {

                const propInfo = propiedades.find(p => p.id === contrato.propiedadId) || {};
                const pagosDelContrato = pagos.filter(p => p.contratoId === contrato.id);
                const problemasDelContrato = problemas.filter(p => p.contratoId === contrato.id);
                const cronograma = generarCronograma(contrato, pagosDelContrato);

                return (
                  <div key={contrato.id} className="tarjeta-contrato-dashboard">
                    <h3 className="tarjeta-contrato-titulo">
                      🏠 {propInfo.titulo || 'Propiedad Desconocida'}
                    </h3>
                    <p className="tarjeta-contrato-info">
                      <strong>Inquilino (DNI):</strong> {contrato.dniInquilino} | <strong>Período:</strong> {contrato.fechaInicio} al {contrato.fechaFin}
                    </p>

                    <h4 className="tarjeta-contrato-subtitulo">Cronograma de Pagos</h4>

                    <div className="tabla-contenedor">
                      <table className="tabla-pagos tabla-pagos-limpia">
                        <thead>
                          <tr>
                            <th>Concepto</th>
                            <th>Fecha Límite</th>
                            <th>Monto a Pagar</th>
                            <th>Detalle de Pago</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cronograma.map(cuota => (
                            <tr key={cuota.numero}>
                              <td className="tabla-celda-concepto">{cuota.concepto}</td>
                              <td className={`tabla-celda-fecha ${cuota.estado === 'Vencido' ? 'texto-vencido' : ''}`}>
                                🗓️ {cuota.fechaLimite}
                              </td>
                              <td className="tabla-celda-monto">${cuota.monto}</td>
                              <td className="tabla-celda-detalle">
                                {cuota.pagoAsociado ? (
                                  <div className="detalle-pago-flex">
                                    <span className="texto-acreditacion">💳 Acreditación (MP)</span>
                                    <button
                                      type="button"
                                      className="btn-link btn-descarga-chico"
                                      onClick={() => {
                                        const idTransaccion = cuota.pagoAsociado.comprobanteUrl.replace('Recibo MP: ', '');
                                        descargarComprobanteTXT({ concepto: cuota.concepto, montoTotal: cuota.monto }, idTransaccion);
                                      }}
                                    >
                                      📄 Descargar Comprobante
                                    </button>
                                  </div>
                                ) : (
                                  <span className="texto-esperando-pago">Esperando pago...</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge-estado-pago estado-${cuota.estado.toLowerCase().replace(' ', '-')}`}>
                                  {cuota.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* PROBLEMAS REPORTADOS */}
                    {problemasDelContrato.length > 0 && (
                      <div className="panel-problemas-dashboard">
                        <h4 className="panel-problemas-titulo">
                          ⚠️ Reportes de Mantenimiento / Problemas
                        </h4>
                        {problemasDelContrato.map(prob => (
                          <div key={prob.id} className="problema-item-card">
                            <div className="problema-item-header">
                              <div>
                                <p className="problema-item-texto"><strong>Inquilino:</strong> {prob.inquilinoEmail}</p>
                                <p className="problema-item-texto"><strong>Fecha del reporte:</strong> {prob.fecha}</p>
                                <p className="problema-item-detalle"><strong>Detalle:</strong> "{prob.descripcion}"</p>
                              </div>
                              <span className={`badge-problema badge-${prob.estado === 'Resuelto' ? 'resuelto' : 'pendiente'}`}>
                                {prob.estado === 'Resuelto' ? '✔️ Resuelto' : '⏳ Pendiente'}
                              </span>
                            </div>
                            {prob.estado !== 'Resuelto' && (
                              <div className="problema-item-acciones">
                                <button className="btn-submit btn-problema-chat" onClick={() => handleChatDesdeProblema(prob)}>💬 Abrir Chat</button>
                                <button className="btn-submit btn-problema-resolver" onClick={() => handleResolverProblema(prob.id)}>✔️ Marcar como Resuelto</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* =========================================
                SECCIÓN 2: RESERVAS TEMPORALES
                ========================================= */}
            <h3 className="titulo-seccion-reservas mt-40">
              🏖️ Cobros por Reservas Temporales
            </h3>
            <p className="hint-text hint-reservas mb-20">
              El dinero de las reservas se mantiene <strong>retenido de forma segura</strong> por Zenith y se libera a tu cuenta al momento del ingreso del inquilino.
            </p>

            {misReservasPropietario.length === 0 ? (
              <div className="estado-vacio">No tienes reservas temporales registradas.</div>
            ) : (
              <div className="reservas-propietario-grid">
                {misReservasPropietario.map(reserva => {
                  const propInfo = propiedades.find(p => p.id === reserva.propiedadId) || { titulo: 'Propiedad no encontrada' };

                  return (
                    <div key={reserva.id} className="tarjeta-reserva-propietario reserva-bg-blanco">

                      <div className="reserva-header-propietario">
                        <h4 className="reserva-titulo-prop">🏠 {propInfo.titulo}</h4>
                        <span className={`badge-estado ${reserva.estado === 'Confirmada' ? 'aprobado' : reserva.estado === 'Cancelada' ? 'rechazado' : ''}`}>
                          {reserva.estado}
                        </span>
                      </div>

                      <div className="reserva-info-grid">
                        <span><strong>Inquilino (DNI):</strong> {reserva.inquilinoDni}</span>
                        <span><strong>Fechas:</strong> {reserva.fechaInicio} al {reserva.fechaFin}</span>
                        <span><strong>Estadía:</strong> {reserva.cantidadDias} días</span>
                        <span className="reserva-total-verde"><strong>Total:</strong> ${Number(reserva.precioTotal).toFixed(2)}</span>
                      </div>

                      <div className="reserva-estado-financiero reserva-bg-gris">

                        {reserva.estado === 'Cancelada' ? (
                          Number(reserva.montoReembolso) === Number(reserva.precioTotal) ? (
                            <div className="reserva-estado-fila">
                              <strong className="etiqueta-estado-gris">🚫 Cancelación a Tiempo</strong>
                              <p className="mensaje-aclaratorio-gris">El inquilino canceló con más de 7 días de antelación. Se le devolvió el 100% y no percibes penalidad.</p>
                            </div>
                          ) : (
                            <div className="reserva-fila-distribuida">
                              <div>
                                <strong className="etiqueta-estado-fondo">Estado de la penalidad:</strong>
                                <span className="badge-estado-fondo fondo-liberado">✅ Transferido a tu cuenta</span>
                              </div>
                              <div className="reserva-penalidad-info info-positiva">
                                <strong>Inquilino canceló fuera de término.</strong><br />
                                Penalidad a tu favor: ${(Number(reserva.precioTotal) - Number(reserva.montoReembolso)).toFixed(2)}
                              </div>
                              <button
                                type="button"
                                className="btn-link btn-comprobante-reserva"
                                onClick={() => {
                                  descargarComprobanteTXT({
                                    concepto: `Cobro de Penalidad por Cancelación - ${propInfo.titulo}`,
                                    montoTotal: Number(reserva.precioTotal) - Number(reserva.montoReembolso),
                                    emisor: 'Zenith Alquileres (Fondo de Retención Ficticio)',
                                    mensajePie: 'El dinero de la penalidad ha sido liberado a tu cuenta declarada.'
                                  }, `PEN-${reserva.id}-${Date.now().toString().slice(-6)}`);
                                }}
                              >
                                📄 Descargar Comprobante de Cobro
                              </button>
                            </div>
                          )
                        ) : (
                          <>
                            <div>
                              <strong className="etiqueta-estado-fondo">Estado de los fondos:</strong>
                              <span className={`badge-estado-fondo fondo-${reserva.estadoPago.toLowerCase()}`}>
                                {reserva.estadoPago === 'Retenido' ? '⏳ Retenido por Zenith' : '✅ Transferido a tu cuenta'}
                              </span>
                            </div>

                            {reserva.estadoPago === 'Liberado' && (
                              <button
                                type="button"
                                className="btn-link btn-comprobante-reserva"
                                onClick={() => {
                                  descargarComprobanteTXT({
                                    concepto: `Pago de Reserva Temporal - ${propInfo.titulo}`,
                                    montoTotal: Number(reserva.precioTotal),
                                    emisor: 'Zenith Alquileres (Fondo de Retención Ficticio)',
                                    mensajePie: 'Los fondos retenidos han sido liberados a tu cuenta exitosamente.'
                                  }, `RES-${reserva.id}-${Date.now().toString().slice(-6)}`);
                                }}
                              >
                                📄 Descargar Comprobante
                              </button>
                            )}

                            {reserva.estadoPago === 'Retenido' && (
                              <span className="mensaje-candado-retenido">
                                🔒 Te mandaremos el dinero cuando el inquilino haga el check-in
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div> {/* Cierre dash-contenido */}
        </div> {/* Cierre max-width */}
      </div>
    );
  }
  // VISTA 10: CHAT INTERNO (RF17)
  if (vistaActual === 'mensajes' && usuarioLogueado) {
    // Filtramos los chats en los que participa el usuario actual
    const misChats = chats.filter(c => c.inquilinoEmail === usuarioLogueado.email || c.propietarioEmail === usuarioLogueado.email);

    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        {/* ========================================================
            2. TABS DEL DASHBOARD (SOLO SE DIBUJAN SI ES PROPIETARIO)
            ======================================================== */}
        {usuarioLogueado.rol === 'propietario' && (
          <div className="dashboard-panel-wrapper" style={{ paddingBottom: '0', marginBottom: '20px' }}>
            <div className="dashboard-panel-header">
              <h1 className="dashboard-panel-title">Panel de Propietario</h1>
              <button className="btn-submit btn-crear-contrato-dashboard" onClick={() => setVistaActual('crear-contrato')}
                style={{ backgroundColor: '#ff385c', margin: 0, width: 'auto', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 6px rgba(52, 152, 219, 0.2)' }}>
                + Crear Contrato
              </button>
            </div>

            <div className="dash-tabs">
              <button className="dash-tab inactiva" onClick={() => setVistaActual('mi-panel')}>🏢 Mis Publicaciones</button>
              <button className="dash-tab activa">💬 Mensajes</button>
              <button className="dash-tab inactiva" onClick={() => setVistaActual('panel-cobros')}>📄 Contratos</button>
            </div>
          </div>
        )}

        {/* ========================================================
            3. CONTENEDOR DEL CHAT
            ======================================================== */}
        <div style={usuarioLogueado.rol === 'propietario' ? { maxWidth: '1000px', margin: '0 auto 40px', padding: '0 20px' } : { padding: '40px 20px' }}>
          <div className="chat-layout" style={usuarioLogueado.rol === 'propietario' ? { margin: 0, width: '100%', height: '600px', border: '1px solid #e0e6ed', borderTop: 'none', borderRadius: '0 0 10px 10px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' } : { margin: '0 auto', maxWidth: '1000px', height: '600px', borderRadius: '10px', overflow: 'hidden' }}>

            {/* PANEL IZQUIERDO: Lista de hilos de chat */}
            <div className="chat-sidebar" style={usuarioLogueado.rol === 'propietario' ? { backgroundColor: '#fff' } : {}}>
              <h3 style={{ padding: '20px', borderBottom: '1px solid #ecf0f1', margin: 0 }}>Mis Conversaciones</h3>
              {misChats.length === 0 ? (
                <p style={{ padding: '20px', color: '#7f8c8d' }}>No tienes mensajes activos.</p>
              ) : (
                <div className="chat-lista">
                  {misChats.map(chat => {
                    const propInfo = propiedades.find(p => p.id === chat.propiedadId);
                    const titulo = propInfo ? propInfo.titulo : 'Propiedad eliminada';
                    const otroUsuario = chat.propietarioEmail === usuarioLogueado.email ? chat.inquilinoEmail : chat.propietarioEmail;

                    return (
                      <div key={chat.id} className={`chat-item ${chatActivo?.id === chat.id ? 'activo' : ''}`} onClick={() => setChatActivo(chat)}>
                        <strong>{titulo}</strong>
                        <span className="chat-contacto">Con: {otroUsuario}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PANEL DERECHO: Conversación activa */}
            <div className="chat-main" style={usuarioLogueado.rol === 'propietario' ? { backgroundColor: '#fbfcfc' } : {}}>
              {chatActivo && (chatActivo.inquilinoEmail === usuarioLogueado.email || chatActivo.propietarioEmail === usuarioLogueado.email) ? (
                <>
                  <div className="chat-header-activo" style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', backgroundColor: '#fff', gap: '15px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setChatActivo(null)}
                      style={{ background: 'none', border: 'none', color: '#ff385c', fontWeight: 'bold', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center', fontSize: '1rem' }}
                    >
                      ← Atrás
                    </button>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#222222' }}>
                      {propiedades.find(p => p.id === chatActivo.propiedadId)?.titulo || 'Conversación'}
                    </span>
                  </div>

                  <div className="chat-mensajes">
                    {chatActivo.mensajes.map((msg, index) => (
                      <div key={index} className={`mensaje-burbuja ${msg.sender === usuarioLogueado.email ? 'mio' : 'otro'}`}>
                        <div className="mensaje-texto">{msg.text}</div>
                        <div className="mensaje-hora">{msg.timestamp}</div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleEnviarMensaje} className="chat-input-area" style={{ flexShrink: 0 }}>
                    <input type="text" name="mensajeNuevo" placeholder="Escribe un mensaje..." required autoComplete="off" />
                    <button type="submit" className="btn-submit" style={{ width: 'auto', margin: 0, padding: '10px 20px', borderRadius: '5px' }}>Enviar</button>
                  </form>
                </>
              ) : (
                <div className="chat-placeholder">
                  <span style={{ fontSize: '3rem' }}>💬</span>
                  <p>Selecciona una conversación para empezar a chatear</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // =======================================================
  // VISTA NUEVA: MI PANEL (DASHBOARD PROPIETARIO MODERNO)
  // =======================================================
  if (vistaActual === 'mi-panel' && usuarioLogueado?.rol === 'propietario') {
    // Usamos tu variable real de la BD: propietario_id
    const misPropiedades = propiedades.filter(p => p.propietario_id === usuarioLogueado.id);

    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        {/* Contenedor central */}
        <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>

          {/* Cabecera del Panel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '2rem', color: '#1a252f', margin: 0 }}>Panel de Propietario</h1>

            <button
              className="btn-submit"
              onClick={() => { setEditandoId(null); setVistaActual('publicar-inmueble'); }}
              style={{ backgroundColor: '#ff385c', margin: 0, width: 'auto', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', color: 'white', boxShadow: '0 4px 6px rgba(52, 152, 219, 0.2)' }}
            >
              + Publicar Inmueble
            </button>
          </div>

          {/* Pestañas (Tabs) */}
          <div className="dash-tabs">
            <button className="dash-tab activa">🏢 Mis Publicaciones</button>
            <button className="dash-tab inactiva" onClick={() => setVistaActual('mensajes')}>💬 Mensajes</button>
            <button className="dash-tab inactiva" onClick={() => setVistaActual('panel-cobros')}>📄 Contratos</button>
          </div>

          {/* Lista de Propiedades */}
          <div className="dash-contenido">
            {misPropiedades.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#7f8c8d', padding: '40px' }}>No tienes propiedades publicadas en este momento.</p>
            ) : (
              misPropiedades.map(prop => (
                <div key={prop.id} className="dash-item-prop">

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Imagen o Placeholder */}
                    <div className="dash-item-img">
                      {prop.fotos && prop.fotos.length > 0 ? (
                        <img src={prop.fotos[0]} alt="Propiedad" />
                      ) : (
                        <span>🏢</span>
                      )}
                    </div>

                    {/* Info */}
                    <div>
                      <strong style={{ display: 'block', fontSize: '1.2rem', color: '#2c3e50', marginBottom: '5px' }}>{prop.titulo}</strong>
                      <span style={{ display: 'block', color: '#7f8c8d', fontSize: '0.9rem', marginBottom: '10px' }}>📍 {prop.direccion}, {prop.ciudad}</span>

                      <span className={`dash-badge ${prop.estado === 'activo' ? 'ok' : prop.estado === 'inactivo' ? 'mal' : 'revisando'}`}>
                        {prop.estado === 'activo' ? 'Aprobada' : prop.estado === 'inactivo' ? 'Dada de baja' : 'En Revisión'}
                      </span>
                    </div>
                  </div>

                  {/* Acciones conectadas a tus funciones reales */}
                  <div className="dash-item-acciones">
                    <button onClick={() => { setPropiedadSeleccionada(prop); setVistaActual('detalle-propiedad'); }} title="Ver Detalle">👁️</button>

                    {/* ---> NUEVO BOTÓN DE EDITAR <--- */}
                    <button onClick={() => handleEditarPropiedad(prop)} title="Editar Propiedad">✏️</button>

                    {/* Botón de dar de baja (solo si está activa o en revisión) */}
                    {prop.estado !== 'inactivo' && (
                      <button onClick={() => handleBajaPropiedad(prop.id)} title="Dar de baja" style={{ color: '#e74c3c' }}>🗑️</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    );
  }

  // VISTA 6: PANEL Y VISUALIZACIÓN DE PROPIEDADES (RF10, RF11, RF12)
  if (vistaActual === 'panel-propiedades' && usuarioLogueado) {

    // CORRECCIÓN: Filtro estricto. SOLO mostramos las que le pertenecen a este usuario exacto.
    const propiedadesVisibles = propiedades.filter(p =>
      p.propietario_id === usuarioLogueado.id
    );

    return (
      <div className="auth-container" style={{ padding: '40px 20px', alignItems: 'flex-start' }}>
        <div className="auth-card" style={{ maxWidth: '900px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Mis Publicaciones</h2>
            <button className="btn-link" onClick={() => setVistaActual('buscador')}>Volver al Inicio</button>
          </div>

          {propiedadesVisibles.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#7f8c8d' }}>No tienes propiedades publicadas en este momento.</p>
          ) : (
            <div className="propiedades-grid">
              {propiedadesVisibles.map((prop) => (
                <div key={prop.id} className={`propiedad-card ${prop.estado === 'inactivo' ? 'inactiva' : ''}`}>
                  {prop.estado === 'inactivo' && <div className="badge-inactivo">Dada de baja</div>}

                  <h3 className="prop-titulo">{prop.titulo}</h3>
                  <p className="prop-ubicacion">📍 {prop.direccion}, {prop.barrio}, {prop.ciudad}</p>

                  {/* RF12: Información general visible */}
                  <div className="prop-detalles">
                    <span><strong>Tipo:</strong> <span style={{ textTransform: 'capitalize' }}>{prop.tipo_inmueble || prop.tipoInmueble}</span></span>
                    <span><strong>Operación:</strong> {prop.tipo_operacion || prop.tipoOperacion === 'largo_plazo' ? 'Largo Plazo' : 'Temporal'}</span>
                    <span><strong>Superficie:</strong> Total {prop.superficie_total || prop.superficieTotal}m² | Cubierta {prop.superficie_cubierta || prop.superficieCubierta}m²</span>
                    <span><strong>Ambientes:</strong> {prop.habitaciones} (Dormitorios: {prop.dormitorios})</span>
                  </div>

                  {/* Precios según tipo de operación */}
                  <div className="prop-precio">
                    {prop.tipo_operacion || prop.tipoOperacion === 'largo_plazo' ? (
                      <>
                        <p><strong>Pago Inicial:</strong> ${prop.pago_inicial || prop.pagoInicial}</p>
                        <p><strong>Garantía solicitada:</strong> <span style={{ textTransform: 'capitalize' }}>{prop.tipo_garantia?.replace('_', ' ') || prop.tipoGarantia?.replace('_', ' ')}</span></p>
                      </>
                    ) : (
                      <p><strong>Valor por día:</strong> ${prop.pago_diario || prop.pagoDiario}</p>
                    )}
                  </div>

                  <div className="prop-servicios">
                    <strong>Servicios: </strong>
                    {prop.servicios && prop.servicios.length > 0 ? prop.servicios.join(' • ') : 'No especificados'}
                  </div>

                  {/* CORRECCIÓN: Controles de Propietario vinculados al ID real de Supabase */}
                  {prop.propietario_id === usuarioLogueado.id && (
                    <div className="prop-acciones">
                      <button className="btn-editar" onClick={() => handleEditarPropiedad(prop)}>✏️ Editar</button>
                      {prop.estado === 'activo' && (
                        <button className="btn-baja" onClick={() => handleBajaPropiedad(prop.id)}>🗑️ Dar de baja</button>
                      )}
                    </div>
                  )}

                  {/* RF26 y RF27: Panel de Problemas para el Propietario */}
                  {prop.propietario_id === usuarioLogueado.id && problemas.filter(p => p.propiedadId === prop.id).length > 0 && (
                    <div className="panel-problemas" style={{ marginTop: '15px', backgroundColor: '#fdfaeb', padding: '15px', borderRadius: '5px', border: '1px solid #f1c40f' }}>
                      <h4 style={{ color: '#d35400', marginBottom: '10px', fontSize: '0.9rem' }}>⚠️ Problemas Reportados en este Inmueble</h4>
                      {problemas.filter(p => p.propiedadId === prop.id).map(prob => (
                        <div key={prob.id} style={{ fontSize: '0.85rem', borderBottom: '1px solid #f8c471', paddingBottom: '10px', marginBottom: '10px' }}>
                          <p><strong>Inquilino:</strong> {prob.inquilinoEmail}</p>
                          <p><strong>Detalle ({prob.fecha}):</strong> {prob.descripcion}</p>
                          <p><strong>Estado:</strong> <span className={`badge-estado ${prob.estado === 'Resuelto' ? 'aprobado' : 'pendiente'}`}>{prob.estado}</span></p>

                          {prob.estado !== 'Resuelto' && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                              <button className="btn-submit" style={{ padding: '5px 10px', fontSize: '0.8rem', margin: 0, backgroundColor: '#3498db' }} onClick={() => handleChatDesdeProblema(prob)}>
                                💬 Contactar
                              </button>
                              <button className="btn-submit" style={{ padding: '5px 10px', fontSize: '0.8rem', margin: 0, backgroundColor: '#27ae60' }} onClick={() => handleResolverProblema(prob.id)}>
                                ✔️ Marcar Resuelto
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // VISTA 8: DETALLE DE PROPIEDAD (Estilo MercadoLibre)
  if (vistaActual === 'detalle-propiedad' && propiedadSeleccionada) {
    const prop = propiedadSeleccionada;

    // TRADUCTOR DE VARIABLES (Supabase Snake_case -> React)
    const tipoOperacion = prop.tipo_operacion || prop.tipoOperacion;
    const supTotal = prop.superficie_total || prop.superficieTotal || '-';
    const supCubierta = prop.superficie_cubierta || prop.superficieCubierta || '-';
    const alquilerMensual = prop.alquiler_mensual || prop.alquilerMensual;

    // LÓGICA DE VALORACIONES
    const valoracionesProp = valoraciones.filter(v => String(v.propiedadId) === String(prop.id));
    const promedioEstrellas = valoracionesProp.length > 0
      ? (valoracionesProp.reduce((acc, v) => acc + v.calificacion, 0) / valoracionesProp.length).toFixed(1)
      : 0;

    // reseñas del anfitrión
    const anfitrionId = prop.propietario_id || prop.propietarioId || prop.propietarioEmail;
    const anfitrion = usuarios.find(u => String(u.id) === String(anfitrionId)) || null;
    const resumenAnfitrion = obtenerResumenUsuario(anfitrion, 'anfitrion');
    const permisoValoracionAnfitrion = obtenerPermisoParaValorarAnfitrion(prop);

    // lógica vieja de reseña de la propiedad
    const yaAlquilo = usuarioLogueado && contratos.some(c =>
      String(c.propiedadId) === String(prop.id) &&
      (String(c.dniInquilino) === String(usuarioLogueado.dni) ||
        String(c.inquilinoId) === String(usuarioLogueado.id))
    );

    const yaValoro = usuarioLogueado && valoracionesProp.some(v => v.autorEmail === usuarioLogueado.email);
    const puedeValorar = yaAlquilo && !yaValoro;

    const precioDiario = prop.pago_diario || prop.pagoDiario;
    const descSemanal = prop.descuento_semanal || prop.descuentoSemanal;
    const descMensual = prop.descuento_mensual || prop.descuentoMensual;
    const tipoGarantia = prop.tipo_garantia || prop.tipoGarantia;
    const propietarioId = prop.propietario_id || prop.propietarioEmail;

    // PREPARAR MAPA
    const posMapaPropiedad = {
      lat: Number(prop.latitud) || -27.7833,
      lng: Number(prop.longitud) || -64.2667
    };

    return (
      <div className="buscador-container" style={{ backgroundColor: '#f8f9fa' }}>
        <div style={{ padding: '20px 40px 0' }}>
          <button className="btn-volver-limpio" onClick={() => {
            setPropiedadSeleccionada(null);
            setVistaActual(usuarioLogueado?.rol === 'admin' ? 'panel-admin' : 'buscador');
          }}>
            ⬅ Volver {usuarioLogueado?.rol === 'admin' ? 'al Panel Admin' : 'al inicio'}
          </button>
        </div>

        <div className="detalle-layout">
          {/* COLUMNA IZQUIERDA: Información detallada */}
          <div className="detalle-main">

            {/* Título y Ubicación arriba de las fotos */}
            <h1 className="detalle-titulo" style={{ marginTop: 0, marginBottom: '10px' }}>{prop.titulo}</h1>
            <p className="prop-ubicacion" style={{ fontSize: '1.1rem', marginBottom: '20px', color: '#7f8c8d' }}>
              📍 {prop.direccion}, {prop.barrio}, {prop.ciudad}, {prop.provincia}
            </p>

            {/* INYECTAMOS NUESTRO NUEVO COMPONENTE DE GALERÍA */}
            <GaleriaInmueble fotos={prop.fotos} />

            <div className="detalle-seccion detalle-seccion-separada">
              <h3>Características Generales</h3>
              <div className="caracteristicas-grid">
                <span>📐 Sup. Total: {supTotal} m²</span>
                <span>🏠 Sup. Cubierta: {supCubierta} m²</span>
                <span>🚪 Ambientes: {prop.habitaciones}</span>
                <span>🛏️ Dormitorios: {prop.dormitorios}</span>
                <span>🛁 Baños: {prop.banos}</span>
                <span>🏢 Pisos: {prop.pisos}</span>
              </div>
            </div>

            <div className="detalle-seccion">
              <h3>Descripción</h3>
              <p className="detalle-descripcion">{prop.descripcion}</p>
            </div>

            {/* ---> SECCIÓN NUEVA: CALENDARIO DE DISPONIBILIDAD <--- */}
            <div className="detalle-seccion">
              <h3>Disponibilidad</h3>
              <CalendarioOcupacion propiedadId={prop.id} contratos={contratos} reservas={reservas} />
            </div>

            {/* MAPA INTERACTIVO */}
            <div className="detalle-seccion">
              <h3>Ubicación en el Mapa</h3>
              <div style={{ height: '350px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
                {!isLoaded ? (
                  <p style={{ padding: '20px' }}>Cargando mapa interactivo...</p>
                ) : (
                  <GoogleMap
                    zoom={15}
                    center={posMapaPropiedad}
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                  >
                    <Marker position={posMapaPropiedad} />
                  </GoogleMap>
                )}
              </div>
            </div>

            <div className="detalle-seccion">
              <h3>Servicios y Amenidades</h3>
              <div className="servicios-tags">
                {prop.servicios && prop.servicios.length > 0
                  ? prop.servicios.map((s, i) => <span key={i} className="tag-servicio">✓ {s}</span>)
                  : <span>No especificados</span>}
              </div>
            </div>
            <div className="detalle-seccion">
              <h3>Perfil del anfitrión</h3>

              {anfitrion ? (
                <div className="host-resumen-card">
                  <div className="host-resumen-left">
                    <div className="host-avatar">
                      {anfitrion.foto_perfil ? (
                        <img src={anfitrion.foto_perfil} alt={`Perfil de ${anfitrion.nombre}`} />
                      ) : (
                        <span>{anfitrion.nombre?.[0] || 'A'}</span>
                      )}
                    </div>

                    <div className="host-resumen-info">
                      <h4 className="host-nombre">
                        {anfitrion.nombre} {anfitrion.apellido}
                      </h4>
                      <p className="host-meta">Miembro desde {formatearMiembroDesde(anfitrion.created_at)}</p>
                      <p className="host-rating">
                        ⭐ {resumenAnfitrion.promedio} · {resumenAnfitrion.cantidad} reseña{resumenAnfitrion.cantidad === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-submit host-btn-ver-perfil"
                    onClick={() => setPerfilPublicoAbierto({ ...anfitrion, tipoPerfil: 'anfitrion' })}
                  >
                    Ver Perfil Completo
                  </button>
                </div>
              ) : (
                <p className="hint-text">No se pudo cargar el perfil del anfitrión.</p>
              )}
            </div>

            <div className="detalle-seccion">
              <h3>Valorar al anfitrión</h3>

              {!usuarioLogueado ? (
                <p className="hint-text">Inicia sesión para dejar una reseña post-estancia.</p>
              ) : permisoValoracionAnfitrion.puedeValorar ? (
                <div className="formulario-valoracion formulario-valoracion-usuario">
                  <h4>Tu experiencia con el anfitrión</h4>

                  <form onSubmit={(e) => handleEnviarValoracionUsuario(e, permisoValoracionAnfitrion.contexto)}>
                    <div className="form-group">
                      <label>Calificación</label>
                      <select
                        value={nuevaValoracionUsuario.calificacion}
                        onChange={(e) => setNuevaValoracionUsuario({ ...nuevaValoracionUsuario, calificacion: e.target.value })}
                        style={{ width: '180px', padding: '8px' }}
                      >
                        <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                        <option value="4">⭐⭐⭐⭐ (Muy bueno)</option>
                        <option value="3">⭐⭐⭐ (Bueno)</option>
                        <option value="2">⭐⭐ (Regular)</option>
                        <option value="1">⭐ (Malo)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Comentario</label>
                      <textarea
                        rows="3"
                        required
                        value={nuevaValoracionUsuario.comentario}
                        onChange={(e) => setNuevaValoracionUsuario({ ...nuevaValoracionUsuario, comentario: e.target.value })}
                        placeholder="Describe cómo fue tu experiencia con el anfitrión"
                      />
                    </div>

                    <button type="submit" className="btn-submit">
                      Publicar reseña del anfitrión
                    </button>
                  </form>
                </div>
              ) : permisoValoracionAnfitrion.yaValoro ? (
                <div className="mensaje-ya-valoro">
                  ✅ Ya dejaste tu reseña para este anfitrión.
                </div>
              ) : (
                <p className="hint-text">
                  Esta reseña solo se habilita cuando la estadía terminó y quedó completada/finalizada.
                </p>
              )}
            </div>
            {/* SECCIÓN DE VALORACIONES Y RESEÑAS */}
            <div className="seccion-valoraciones">
              <h3 className="section-title">
                ⭐ Valoraciones de huéspedes ({promedioEstrellas > 0 ? promedioEstrellas : 'Sin calificaciones'})
              </h3>

              {/* Lista de comentarios existentes */}
              <div className="lista-comentarios">
                {valoracionesProp.length === 0 ? (
                  <p className="hint-text">Aún no hay valoraciones para esta propiedad.</p>
                ) : (
                  valoracionesProp.map(val => (
                    <div key={val.id} className="comentario-card">
                      <div className="comentario-header">
                        <strong>{val.autorNombre}</strong>
                        <span className="estrellitas">{'⭐'.repeat(val.calificacion)}</span>
                        <span className="fecha-comentario">{val.fecha}</span>
                      </div>
                      <p className="comentario-texto">"{val.comentario}"</p>
                    </div>
                  ))
                )}
              </div>

              {/* Formulario para dejar valoración (SOLO INQUILINOS CONFIRMADOS) */}
              {puedeValorar && (
                <div className="formulario-valoracion">
                  <h4>Deja tu opinión sobre tu estadía</h4>
                  <form onSubmit={(e) => handleEnviarValoracion(e, prop.id)}>
                    <div className="form-group">
                      <label>Calificación (Estrellas)</label>
                      <select
                        value={nuevaValoracion.calificacion}
                        onChange={(e) => setNuevaValoracion({ ...nuevaValoracion, calificacion: e.target.value })}
                        style={{ width: '150px', padding: '8px' }}
                      >
                        <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                        <option value="4">⭐⭐⭐⭐ (Muy Bueno)</option>
                        <option value="3">⭐⭐⭐ (Bueno)</option>
                        <option value="2">⭐⭐ (Regular)</option>
                        <option value="1">⭐ (Malo)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Tu comentario</label>
                      <textarea
                        rows="3"
                        required
                        placeholder="¿Cómo fue tu experiencia en este lugar?"
                        value={nuevaValoracion.comentario}
                        onChange={(e) => setNuevaValoracion({ ...nuevaValoracion, comentario: e.target.value })}
                      ></textarea>
                    </div>
                    <button type="submit" className="btn-submit">Publicar Reseña</button>
                  </form>
                </div>
              )}

              {/* Mensaje si el usuario ya comentó */}
              {yaValoro && (
                <div className="mensaje-ya-valoro">
                  ✅ Ya has dejado una valoración para esta propiedad. ¡Gracias!
                </div>
              )}
            </div>
          </div> {/* Fin columna izquierda */}

          {/* COLUMNA DERECHA: Tarjeta de compra/contacto */}
          <div className="detalle-sidebar">
            <div className="compra-card">

              {/* 1. ETIQUETAS Y PRECIOS (Sirve para ambos tipos) */}
              <span className="operacion-tag" style={{ backgroundColor: tipoOperacion === 'largo_plazo' ? '#2980b9' : '#e67e22' }}>
                {tipoOperacion === 'largo_plazo' ? 'Alquiler Largo Plazo' : 'Alquiler Temporal'}
              </span>

              <div className="precio-destacado">
                ${tipoOperacion === 'largo_plazo' ? alquilerMensual : precioDiario}
                <span className="precio-sub">{tipoOperacion === 'largo_plazo' ? ' / mes' : ' / día'}</span>
              </div>

              {/* =========================================
                  2. LÓGICA TEMPORAL (Calculadora y Reserva)
                  ========================================= */}
              {tipoOperacion === 'temporal' && (() => {
                let cantidadDias = 0;
                let precioTotalCalculado = 0;
                let precioBaseSinDescuento = 0;
                let montoDescuento = 0;

                // Motor matemático de fechas
                if (datosReserva.fechaInicio && datosReserva.fechaFin) {
                  const inicio = new Date(datosReserva.fechaInicio + 'T00:00:00');
                  const fin = new Date(datosReserva.fechaFin + 'T00:00:00');

                  if (fin >= inicio) {
                    const diferenciaTiempo = Math.abs(fin - inicio);
                    cantidadDias = Math.ceil(diferenciaTiempo / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir el día de llegada

                    precioBaseSinDescuento = cantidadDias * Number(precioDiario);

                    if (cantidadDias >= 30 && descMensual) {
                      montoDescuento = precioBaseSinDescuento * (Number(descMensual) / 100);
                    } else if (cantidadDias >= 7 && descSemanal) {
                      montoDescuento = precioBaseSinDescuento * (Number(descSemanal) / 100);
                    }

                    precioTotalCalculado = precioBaseSinDescuento - montoDescuento;
                  }
                }

                return (
                  <div className="reserva-temporal-container">
                    <h4 className="reserva-titulo">🗓️ Fechas de estadía</h4>
                    <div className="reserva-fechas-grid">

                      {/* CALENDARIO DE LLEGADA */}
                      <div className="reserva-input-group datepicker-wrapper-full">
                        <label>Llegada</label>
                        <DatePicker
                              selected={datosReserva.fechaInicio ? new Date(datosReserva.fechaInicio + 'T00:00:00') : null}
                              onChange={(date) => {
                                if (date && fechaEstaOcupada(date, prop.id)) {
                                  alert('Esa fecha ya está ocupada.');
                                  return;
                                }

                                setDatosReserva({
                                  ...datosReserva,
                                  fechaInicio: date ? fechaAInput(date) : ''
                                });
                              }}
                              filterDate={(date) => !fechaEstaOcupada(date, prop.id)}
                              selectsStart
                          startDate={datosReserva.fechaInicio ? new Date(datosReserva.fechaInicio + 'T00:00:00') : null}
                          endDate={datosReserva.fechaFin ? new Date(datosReserva.fechaFin + 'T00:00:00') : null}
                          minDate={new Date()} /* Evita reservas en el pasado */
                          dateFormat="yyyy-MM-dd"
                          className="filter-input"
                          placeholderText="Llegada"
                        />
                      </div>

                      {/* CALENDARIO DE SALIDA */}
                      <div className="reserva-input-group datepicker-wrapper-full">
                        <label>Salida</label>
                        <DatePicker
                          selected={datosReserva.fechaFin ? new Date(datosReserva.fechaFin + 'T00:00:00') : null}
                          onChange={(date) => {
                            if (date && fechaEstaOcupada(date, prop.id)) {
                              alert('Esa fecha ya está ocupada.');
                              return;
                            }

                            setDatosReserva({
                              ...datosReserva,
                              fechaFin: date ? fechaAInput(date) : ''
                            });
                          }}
                          filterDate={(date) => !fechaEstaOcupada(date, prop.id)}
                          selectsEnd
                          startDate={datosReserva.fechaInicio ? new Date(datosReserva.fechaInicio + 'T00:00:00') : null}
                          endDate={datosReserva.fechaFin ? new Date(datosReserva.fechaFin + 'T00:00:00') : null}
                          minDate={datosReserva.fechaInicio ? new Date(datosReserva.fechaInicio + 'T00:00:00') : new Date()}
                          dateFormat="yyyy-MM-dd"
                          className="filter-input"
                          placeholderText="Salida"
                        />
                      </div>

                    </div>

                    {datosReserva.fechaInicio && datosReserva.fechaFin && datosReserva.fechaInicio > datosReserva.fechaFin && (
                      <span className="reserva-error" style={{ display: 'block', color: '#e74c3c', fontSize: '0.8rem', marginTop: '5px' }}>
                        La salida no puede ser antes de la llegada.
                      </span>
                    )}

                    {cantidadDias > 0 && (
                      <>
                        <div className="reserva-resumen">
                          <div className="reserva-fila">
                            <span>Estadía ({cantidadDias} días):</span>
                            <span>${precioBaseSinDescuento.toFixed(2)}</span>
                          </div>

                          {montoDescuento > 0 && (
                            <div className="reserva-fila reserva-descuento">
                              <span>Descuento aplicado:</span>
                              <span>-${montoDescuento.toFixed(2)}</span>
                            </div>
                          )}

                          <div className={`reserva-fila reserva-total ${montoDescuento === 0 ? 'con-borde-top' : ''}`}>
                            <span>Total:</span>
                            <span>${precioTotalCalculado.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* BOTONES DE ACCIÓN TEMPORAL (Solo si NO sos el dueño) */}
                        {usuarioLogueado?.id !== propietarioId && (
                          <div className="acciones-temporal-box">
                            <button
                              className="btn-submit btn-consultar-temporal"
                              onClick={() => {
                                if (!usuarioLogueado) {
                                  setVistaActual('login');
                                } else {
                                  handleConsultar(prop.id);
                                }
                              }}
                            >
                              {usuarioLogueado ? '💬 Consultar al Propietario' : 'Iniciar sesión para consultar'}
                            </button>

                            <button
                                className="btn-submit btn-reservar-mp btn-reservar-mp-premium"
                                onClick={async () => {
                                  if (!usuarioLogueado) {
                                    alert("Debes iniciar sesión o registrarte para poder reservar.");
                                    setVistaActual('login');
                                    return;
                                  }

                                  if (!datosReserva.fechaInicio || !datosReserva.fechaFin) {
                                    alert("Debes seleccionar fecha de llegada y salida.");
                                    return;
                                  }

                                  if (!rangoEstaDisponible(prop.id, datosReserva.fechaInicio, datosReserva.fechaFin)) {
                                    alert("Las fechas seleccionadas ya están ocupadas.");
                                    return;
                                  }

                                  const disponible = await verificarDisponibilidadReservaSupabase(
                                    prop.id,
                                    datosReserva.fechaInicio,
                                    datosReserva.fechaFin
                                  );

                                  if (!disponible) {
                                    alert("Las fechas seleccionadas ya no están disponibles.");
                                    return;
                                  }

                                  setModalReserva({
                                    propiedadId: prop.id,
                                    propietarioId: propietarioId,
                                    fechaInicio: datosReserva.fechaInicio,
                                    fechaFin: datosReserva.fechaFin,
                                    cantidadDias: cantidadDias,
                                    precioTotal: precioTotalCalculado
                                  });
                                }}
                              >
                                💳 Reservar y Pagar
                              </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* =========================================
                  3. LÓGICA LARGO PLAZO (Info extra y Chat)
                  ========================================= */}
              {tipoOperacion === 'largo_plazo' && (
                <>
                  <div className="info-extra-precio">
                    <p><strong>Depósito de Garantía:</strong> ${prop.deposito}</p>
                    <p><strong>Garantía solicitada:</strong> <span style={{ textTransform: 'capitalize' }}>{tipoGarantia?.replace('_', ' ')}</span></p>
                  </div>

                  {/* Botón de consulta (Solo se muestra si NO sos el dueño) */}
                  {usuarioLogueado?.id !== propietarioId && (
                    <button
                      className="btn-submit btn-consultar-temporal"
                      onClick={() => {
                        if (!usuarioLogueado) {
                          setVistaActual('login');
                        } else {
                          handleConsultar(prop.id);
                        }
                      }}
                    >
                      {usuarioLogueado ? '💬 Consultar al Propietario' : 'Iniciar sesión para consultar'}
                    </button>
                  )}
                </>
              )}

              {/* =========================================
                 4. AVISO PARA EL DUEÑO
                 ========================================= */}
              {usuarioLogueado?.id === propietarioId && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fcf3cf', border: '1px solid #f1c40f', borderRadius: '5px', textAlign: 'center' }}>
                  Ésta es tu publicación.
                </div>
              )}

            </div>
          </div> {/* Fin columna derecha */}
        </div>

        {/* =========================================
            MODAL DE PAGO PARA RESERVAS TEMPORALES
            ========================================= */}
        {modalReserva && (
          <div className="modal-overlay">
            <div className="modal-content modal-reserva-content">

              <div className="modal-header-mp">
                <h3 className="modal-title-mp">Abonar Reserva</h3>
              </div>

              <div className="desglose-pago desglose-reserva">
                <p><strong>Ingreso:</strong> {modalReserva.fechaInicio}</p>
                <p><strong>Salida:</strong> {modalReserva.fechaFin}</p>
                <p><strong>Estadía:</strong> {modalReserva.cantidadDias} días</p>
              </div>

              <h3 className="modal-total-mp">
                Total: ${modalReserva.precioTotal.toFixed(2)}
              </h3>

              <div className="modal-body-mp">
                <CheckoutBrick
  precioAPagar={modalReserva.precioTotal}
  titulo="Reserva temporal Zenith"
  descripcion={`Reserva temporal del ${modalReserva.fechaInicio} al ${modalReserva.fechaFin}`}
  payerEmail={usuarioLogueado.email}
  externalReference={`reserva_${modalReserva.propiedadId}_${usuarioLogueado.dni}_${Date.now()}`}
  metadata={{
    tipo: 'reserva',
    propiedadId: modalReserva.propiedadId,
    propietarioId: modalReserva.propietarioId,
  }}
  pendingPayment={{
    tipo: 'reserva',
    reserva: modalReserva,
    usuario: {
      id: usuarioLogueado.id,
      dni: usuarioLogueado.dni,
      nombre: usuarioLogueado.nombre,
      email: usuarioLogueado.email,
    },
  }}
/>
                <button type="button" className="btn-link btn-cancelar-mp" onClick={() => setModalReserva(null)}>
                  Cancelar
                </button>
              </div>

            </div>
          </div>
        )}

        {perfilPublicoAbierto && (
          <div className="modal-overlay">
            <div className="modal-content perfil-publico-modal">
              <div className="perfil-publico-header">
                <div className="perfil-publico-avatar">
                  {perfilPublicoAbierto.foto_perfil ? (
                    <img src={perfilPublicoAbierto.foto_perfil} alt={`Perfil de ${perfilPublicoAbierto.nombre}`} />
                  ) : (
                    <span>{perfilPublicoAbierto.nombre?.[0] || 'U'}</span>
                  )}
                </div>

                <div className="perfil-publico-main">
                  <h3>{perfilPublicoAbierto.nombre} {perfilPublicoAbierto.apellido}</h3>
                  <p>Miembro desde {formatearMiembroDesde(perfilPublicoAbierto.created_at)}</p>

                  <div className="perfil-publico-stats">
                    <span className="perfil-chip">
                      ⭐ {obtenerResumenUsuario(perfilPublicoAbierto, perfilPublicoAbierto.tipoPerfil || 'anfitrion').promedio}
                    </span>
                    <span className="perfil-chip">
                      {obtenerResumenUsuario(perfilPublicoAbierto, perfilPublicoAbierto.tipoPerfil || 'anfitrion').cantidad} reseñas
                    </span>
                  </div>
                </div>
              </div>

              <div className="perfil-publico-body">
                <div className="perfil-bloque">
                  <h4>Biografía</h4>
                  <p>{perfilPublicoAbierto.bio || 'Este usuario todavía no cargó una biografía.'}</p>
                </div>

                <div className="perfil-bloque-grid">
                  <div className="perfil-bloque">
                    <h4>Idiomas</h4>
                    <div className="perfil-tags">
                      {parseListaTexto(perfilPublicoAbierto.idiomas).length > 0 ? (
                        parseListaTexto(perfilPublicoAbierto.idiomas).map((item, idx) => (
                          <span key={idx} className="perfil-chip">{item}</span>
                        ))
                      ) : (
                        <p>No especificados.</p>
                      )}
                    </div>
                  </div>

                  <div className="perfil-bloque">
                    <h4>Intereses</h4>
                    <div className="perfil-tags">
                      {parseListaTexto(perfilPublicoAbierto.intereses).length > 0 ? (
                        parseListaTexto(perfilPublicoAbierto.intereses).map((item, idx) => (
                          <span key={idx} className="perfil-chip">{item}</span>
                        ))
                      ) : (
                        <p>No especificados.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="perfil-bloque">
                  <h4>Historial completo de reseñas</h4>

                  {obtenerResenasUsuario(
                    perfilPublicoAbierto.id,
                    perfilPublicoAbierto.tipoPerfil || 'anfitrion'
                  ).length === 0 ? (
                    <p className="hint-text">Todavía no hay reseñas visibles para este perfil.</p>
                  ) : (
                    <div className="lista-comentarios">
                      {obtenerResenasUsuario(
                        perfilPublicoAbierto.id,
                        perfilPublicoAbierto.tipoPerfil || 'anfitrion'
                      ).map((resena) => {
                        const autor = usuarios.find(u => String(u.id) === String(resena.autorId));
                        return (
                          <div key={resena.id} className="comentario-card">
                            <div className="comentario-header">
                              <strong>{autor ? `${autor.nombre} ${autor.apellido}` : 'Usuario'}</strong>
                              <span className="estrellitas">{'⭐'.repeat(resena.calificacion)}</span>
                              <span className="fecha-comentario">
                                {new Date(resena.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="comentario-texto">"{resena.comentario}"</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="btn-danger"
                onClick={() => setPerfilPublicoAbierto(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }


  // VISTA 4: REGISTRO DE PROPIETARIO (RF7)
  if (vistaActual === 'registro-propietario' && usuarioLogueado) {
    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        <div className="auth-container" style={{ minHeight: 'calc(100vh - 80px)', backgroundColor: 'transparent' }}>
          <div className="auth-card">
            <h2>Verificación de Propietario</h2>
            <p>Para publicar inmuebles, necesitamos validar tu identidad.</p>

            <form onSubmit={handleRegistroPropietario} className="auth-form">

              <div className="form-group">
                <label htmlFor="cbu">CBU / CVU (22 dígitos)</label>
                <input type="number" id="cbu" name="cbu" value={datosPropietario.cbu} onChange={handlePropietarioChange} placeholder="Ej: 00000031000..." />
                {errores.cbu && <span className="error-text">{errores.cbu}</span>}
              </div>

              <div className="form-group file-group">
                <label>Foto del Anverso del DNI</label>
                <input type="file" name="dniFrente" accept="image/*" onChange={handlePropietarioFile} className="file-input" />
                {errores.dniFrente && <span className="error-text">{errores.dniFrente}</span>}
              </div>

              <div className="form-group file-group">
                <label>Foto del Reverso del DNI</label>
                <input type="file" name="dniReverso" accept="image/*" onChange={handlePropietarioFile} className="file-input" />
                {errores.dniReverso && <span className="error-text">{errores.dniReverso}</span>}
              </div>

              <button type="submit" className="btn-submit btn-propietario-submit">Enviar Documentación</button>
              <button type="button" className="btn-link" onClick={() => { setErrores({}); setVistaActual('buscador'); }}>
                Cancelar y volver al Inicio
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // VISTA 5: PUBLICACIÓN DE INMUEBLE (RF8)
  if (vistaActual === 'publicar-inmueble' && usuarioLogueado?.rol === 'propietario') {
    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>

        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        <div className="auth-container" style={{ minHeight: 'calc(100vh - 80px)', backgroundColor: 'transparent', padding: '40px 20px' }}>
          <div className="auth-card" style={{ maxWidth: '800px' }}>
            <h2>Publicar Inmueble</h2>
            <p>Completa los detalles de tu propiedad</p>

            <form onSubmit={handlePublicarInmueble} className="auth-form">

              <h3 className="section-title">Datos Generales</h3>
              <div className="form-group">
                <label>Título de la publicación</label>
                <input type="text" name="titulo" value={datosInmueble.titulo} onChange={handleInmuebleChange} required placeholder="Ej: Hermoso departamento céntrico..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Inmueble</label>
                  <select name="tipoInmueble" value={datosInmueble.tipoInmueble} onChange={handleInmuebleChange} required>
                    <option value="" disabled>Seleccionar...</option>
                    <option value="departamento">Departamento</option>
                    <option value="casa">Casa</option>
                    <option value="monoambiente">Monoambiente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tipo de Operación</label>
                  <select name="tipoOperacion" value={datosInmueble.tipoOperacion} onChange={handleInmuebleChange} required>
                    <option value="largo_plazo">Alquiler a Largo Plazo</option>
                    <option value="temporal">Alquiler Temporal</option>
                  </select>
                </div>
              </div>

              <h3 className="section-title">Ubicación y Dimensiones</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Provincia</label>
                  <select
                    name="provincia"
                    value={datosInmueble.provincia}
                    onChange={handleInmuebleChange}
                    required
                  >
                    <option value="">Selecciona una provincia</option>
                    {Object.keys(provinciasYCiudades).map((provincia) => (
                      <option key={provincia} value={provincia}>
                        {provincia}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Ciudad</label>
                  <select
                    name="ciudad"
                    value={datosInmueble.ciudad}
                    onChange={handleInmuebleChange}
                    required
                    disabled={!datosInmueble.provincia}
                  >
                    <option value="">
                      {datosInmueble.provincia ? 'Selecciona una ciudad' : 'Primero selecciona una provincia'}
                    </option>
                    {ciudadesDisponibles.map((ciudad) => (
                      <option key={ciudad} value={ciudad}>
                        {ciudad}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Barrio</label><input type="text" name="barrio" value={datosInmueble.barrio} onChange={handleInmuebleChange} required /></div>
                <div className="form-group"><label>Dirección</label><input type="text" name="direccion" value={datosInmueble.direccion} onChange={handleInmuebleChange} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Sup. Total (m²)</label><input type="number" name="superficieTotal" value={datosInmueble.superficieTotal} onChange={handleInmuebleChange} required /></div>
                <div className="form-group"><label>Sup. Cubierta (m²)</label><input type="number" name="superficieCubierta" value={datosInmueble.superficieCubierta} onChange={handleInmuebleChange} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Habitaciones (Total)</label><input type="number" name="habitaciones" value={datosInmueble.habitaciones} onChange={handleInmuebleChange} required /></div>
                <div className="form-group"><label>Dormitorios</label><input type="number" name="dormitorios" value={datosInmueble.dormitorios} onChange={handleInmuebleChange} required /></div>
                <div className="form-group"><label>Baños</label><input type="number" name="banos" value={datosInmueble.banos} onChange={handleInmuebleChange} required /></div>
                <div className="form-group"><label>Pisos</label><input type="number" name="pisos" value={datosInmueble.pisos} onChange={handleInmuebleChange} required /></div>
              </div>

              {/* ---> SECCIÓN NUEVA: MAPA DE GOOGLE <--- */}
              <div className="form-group" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                <label style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: '10px', display: 'block' }}>
                  📍 Ubicación exacta (Hacé clic en el mapa para colocar el pin)
                </label>

                {!isLoaded ? (
                  <p>Cargando mapa interactivo...</p>
                ) : (
                  <div style={{ height: '350px', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc', marginBottom: '10px' }}>
                    <GoogleMap
                      zoom={13}
                      center={posicionMapa}
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      onClick={handleMapClick}
                    >
                      <Marker position={posicionMapa} />
                    </GoogleMap>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                  <span>Latitud: {posicionMapa.lat.toFixed(6)}</span>
                  <span>Longitud: {posicionMapa.lng.toFixed(6)}</span>
                </div>
              </div>
              {/* ---> FIN SECCIÓN MAPA <--- */}

              <h3 className="section-title">Servicios Incluidos (RF8.1)</h3>
              <div className="servicios-grid">
                {listaServicios.map((servicio) => (
                  <label key={servicio} className="checkbox-label">
                    <input
                      type="checkbox"
                      value={servicio}
                      checked={datosInmueble.servicios?.includes(servicio) || false} /* <-- ESTO FALTABA */
                      onChange={handleServiciosChange}
                    />
                    {servicio}
                  </label>
                ))}
              </div>

              <h3 className="section-title">Condiciones Comerciales</h3>
              {/* RENDERIZADO CONDICIONAL RF8.2 VS RF8.3 y RF8.4 */}
              {datosInmueble.tipoOperacion === 'largo_plazo' ? (
                <div className="condiciones-box">
                  <p className="hint-text">Valores para contrato a largo plazo.</p>

                  {/* ---> NUEVA FILA CON ALQUILER MENSUAL <--- */}
                  <div className="form-row">
                    <div className="form-group">
                      <label>Alquiler Mensual ($)</label>
                      <input type="number" name="alquilerMensual" value={datosInmueble.alquilerMensual} onChange={handleInmuebleChange} required />
                    </div>
                    <div className="form-group">
                      <label>Monto Depósito (Única vez) ($)</label>
                      <input type="number" name="deposito" value={datosInmueble.deposito} onChange={handleInmuebleChange} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo de Garantía Aceptada</label>
                      <select name="tipoGarantia" value={datosInmueble.tipoGarantia} onChange={handleInmuebleChange} required>
                        <option value="" disabled>Seleccionar...</option>
                        <option value="propietaria">Garantía Propietaria</option>
                        <option value="caucion">Seguro de Caución</option>
                        <option value="aval_bancario">Aval Bancario</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="condiciones-box">
                  <p className="hint-text">Valores por día para alquileres temporales.</p>
                  <div className="form-group"><label>Pago por Día ($)</label><input type="number" name="pagoDiario" value={datosInmueble.pagoDiario} onChange={handleInmuebleChange} required /></div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Desc. Semanal (5% - 15%)</label>
                      <input type="number" name="descuentoSemanal" min="5" max="15" value={datosInmueble.descuentoSemanal} onChange={handleInmuebleChange} placeholder="%" />
                    </div>
                    <div className="form-group">
                      <label>Desc. Mensual (20% - 40%)</label>
                      <input type="number" name="descuentoMensual" min="20" max="40" value={datosInmueble.descuentoMensual} onChange={handleInmuebleChange} placeholder="%" />
                    </div>
                  </div>
                </div>
              )}

              <h3 className="section-title">Documentación y Fotos</h3>
              <div className="form-group">
                <label>Descripción detallada</label>
                <textarea name="descripcion" value={datosInmueble.descripcion} onChange={handleInmuebleChange} rows="4" required style={{ padding: '10px', borderRadius: '5px', border: '1px solid #bdc3c7' }}></textarea>
              </div>

              {/* SECCIÓN FOTOS */}
              <div className="form-group file-group">
                <label>Fotos del Inmueble (Públicas)</label>

                {/* ---> MOSTRAR FOTOS VIEJAS AL EDITAR <--- */}
                {editandoId !== null && datosInmueble.fotosViejas && datosInmueble.fotosViejas.length > 0 && (
                  <div className="seccion-edicion-archivos">
                    <p className="hint-text-destacado">Fotos actuales publicadas:</p>
                    <div className="preview-container">
                      {datosInmueble.fotosViejas.map((fotoUrl, index) => (
                        <div key={`vieja-${index}`} className="preview-item">
                          <img src={fotoUrl} alt={`Vieja ${index}`} className={`preview-img ${index === 0 ? 'portada' : ''}`} />

                          {index === 0 ? (
                            <span className="badge-portada">⭐ Portada</span>
                          ) : (
                            <button type="button" onClick={() => handleSetPortadaVieja(index)} className="btn-hacer-portada btn-subir-capa">
                              Hacer Portada
                            </button>
                          )}
                          <button type="button" onClick={() => handleEliminarFotoVieja(index)} className="btn-hacer-portada btn-eliminar-foto">
                            🗑️ Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="hint-text-destacado">
                  {editandoId !== null ? 'Agregar fotos nuevas (se sumarán a las actuales):' : 'Sube tus fotos aquí:'}
                </p>
                <input type="file" name="fotos" accept="image/*" multiple onChange={handleInmuebleFile} required={editandoId === null} className="file-input" />

                {/* PREVISUALIZACIÓN DE FOTOS NUEVAS */}
                {datosInmueble.fotos && datosInmueble.fotos.length > 0 && (
                  <div className="preview-container">
                    {datosInmueble.fotos.map((foto, index) => (
                      <div key={`nueva-${index}`} className="preview-item">
                        <img src={URL.createObjectURL(foto)} alt={`Preview ${index}`} className={`preview-img ${index === 0 && (!datosInmueble.fotosViejas || datosInmueble.fotosViejas.length === 0) ? 'portada' : ''}`} />

                        {index === 0 && (!datosInmueble.fotosViejas || datosInmueble.fotosViejas.length === 0) ? (
                          <span className="badge-portada">⭐ Portada</span>
                        ) : (
                          <button type="button" onClick={() => handleSetPortada(index)} className="btn-hacer-portada">
                            Subir prioridad
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECCIÓN ESCRITURA */}
              <div className="form-group file-group private-file">
                <label>Escritura de la Propiedad (RF8.5 - Privado)</label>

                {/* ---> MOSTRAR ESCRITURA VIEJA AL EDITAR <--- */}
                {editandoId !== null && datosInmueble.escrituraVieja && (
                  <div className="doc-actual-box">
                    <p>📄 Documento actual: <a href={datosInmueble.escrituraVieja} target="_blank" rel="noopener noreferrer">Ver Escritura Subida</a></p>
                  </div>
                )}

                <p className="hint-text-destacado">
                  {editandoId !== null ? 'Si subes un archivo nuevo, reemplazará al actual:' : 'Sube el archivo aquí:'}
                </p>
                <input type="file" name="escritura" accept=".pdf,image/*" onChange={handleInmuebleFile} required={editandoId === null} className="file-input" />
                <span className="hint-text">Este documento es solo para validación interna y no será visible para los inquilinos.</span>
              </div>
              <div className="form-acciones-flex">
                <button type="submit" className="btn-submit" style={{ backgroundColor: '#ff385c', margin: 0, flex: 1 }}>
                  {editandoId !== null ? 'Guardar Cambios' : 'Publicar Inmueble'}
                </button>
                <button type="button" className="btn-cancelar-accion" onClick={() => setVistaActual(usuarioLogueado?.rol === 'admin' ? 'panel-admin' : 'mi-panel')}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /// VISTA 14: BANDEJA DE NOTIFICACIONES
  if (vistaActual === 'notificaciones' && usuarioLogueado) {
    const misNotis = notificaciones.filter(n => String(n.usuario_id) === String(usuarioLogueado.id)).reverse();

    return (
      <div className="min-h-screen font-sans flex flex-col" style={{ backgroundColor: '#f3f4f6' }}>
        {/* ENCABEZADO GLOBAL MODERNO */}
        {renderHeader()}

        <div className="auth-card notificaciones-card">
          {misNotis.length === 0 ? (
            <p className="notificaciones-vacias">No tienes notificaciones nuevas en este momento.</p>
          ) : (
            <div className="notificaciones-lista">
              {misNotis.map(noti => (
                <div key={noti.id} className="notificacion-item">
                  <p className="notificacion-texto"><strong>{noti.tipo}:</strong> {noti.mensaje}</p>
                  <small className="notificacion-fecha">
                    📅 {new Date(noti.fecha_creacion).toLocaleString()}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  // VISTA 1: INICIO DE SESIÓN (RF2 y RF6)
  if (vistaActual === 'login') {
    return (
      <div className="auth-container">
        <div className="auth-card">

          <button className="btn-volver-limpio margen-volver" onClick={() => { setErrores({}); setVistaActual('inicio'); }}>
            ⬅ Volver al inicio
          </button>

          <h2>Iniciar Sesión</h2>
          <p>Bienvenido de nuevo a Zenith Alquileres</p>

          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} />
              {errores.email && <span className="error-text">{errores.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} />
              {errores.password && <span className="error-text">{errores.password}</span>}
            </div>

            <button type="submit" className="btn-submit">Ingresar</button>
          </form>

          <div className="toggle-view" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn-link" type="button" onClick={() => { setErrores({}); setVistaActual('recuperar-password'); }} >
              ¿Olvidaste tu contraseña?
            </button>

            <div>
              <span>¿No tienes una cuenta? </span>
              <button className="btn-link" type="button" onClick={() => { setErrores({}); setVistaActual('registro'); }}>
                Regístrate aquí
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA 9: CREACIÓN DE CONTRATOS (RF13)
  if (vistaActual === 'crear-contrato' && usuarioLogueado?.rol === 'propietario') {

    // CORRECCIÓN: Filtramos usando el ID de Supabase, no el email
    const misPropiedades = propiedades.filter(p => p.propietario_id === usuarioLogueado.id && p.estado === 'activo');
    // Buscamos la propiedad que el dueño acaba de seleccionar en el select
    const propSeleccionadaParaContrato = misPropiedades.find(p => p.id === datosContrato.propiedadId);

    return (
      <div className="auth-container form-container-padded">
        <div className="auth-card auth-card-large">
          <h2>Redactar Nuevo Contrato</h2>
          <p>Formaliza el alquiler ingresando los datos acordados.</p>

          <form onSubmit={handleCrearContrato} className="auth-form">

            <h3 className="section-title">Partes Involucradas</h3>
            <div className="form-row">
              <div className="form-group">
                <label>DNI del Inquilino</label>
                <input type="number" name="dniInquilino" value={datosContrato.dniInquilino} onChange={handleContratoChange} required placeholder="Sin puntos" className="filter-input" />
              </div>
              <div className="form-group">
                <label>Propiedad a Alquilar</label>
                <select name="propiedadId" value={datosContrato.propiedadId} onChange={handleContratoChange} required className="filter-input">
                  <option value="" disabled>Selecciona tu inmueble...</option>
                  {misPropiedades.map(prop => (
                    <option key={prop.id} value={prop.id}>{prop.titulo} ({prop.direccion})</option>
                  ))}
                </select>
              </div>
            </div>

            <h3 className="section-title">Plazos y Modalidad</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Intereses por Mora (%)</label>
                <input type="number" name="interesesMora" value={datosContrato.interesesMora} onChange={handleContratoChange} required step="0.1" className="filter-input" />
              </div>
            </div>

            {/* =========================================
                NUEVO CALENDARIO PARA CONTRATOS
                ========================================= */}
            <div className="form-group">
              <label className="filter-label">Fechas del Contrato</label>
              <div className="filter-row">

                <div className="datepicker-wrapper-full">
                  <span className="datepicker-sublabel">Inicio</span>
                  <DatePicker
                    selected={datosContrato.fechaInicio ? new Date(datosContrato.fechaInicio + 'T00:00:00') : null}
                    onChange={(date) => setDatosContrato({ ...datosContrato, fechaInicio: date ? date.toISOString().split('T')[0] : '' })}
                    selectsStart
                    startDate={datosContrato.fechaInicio ? new Date(datosContrato.fechaInicio + 'T00:00:00') : null}
                    endDate={datosContrato.fechaFin ? new Date(datosContrato.fechaFin + 'T00:00:00') : null}
                    dateFormat="yyyy-MM-dd"
                    className="filter-input"
                    placeholderText="Fecha de ingreso"
                    required
                  />
                </div>

                <div className="datepicker-wrapper-full">
                  <span className="datepicker-sublabel">Fin</span>
                  <DatePicker
                    selected={datosContrato.fechaFin ? new Date(datosContrato.fechaFin + 'T00:00:00') : null}
                    onChange={(date) => setDatosContrato({ ...datosContrato, fechaFin: date ? date.toISOString().split('T')[0] : '' })}
                    selectsEnd
                    startDate={datosContrato.fechaInicio ? new Date(datosContrato.fechaInicio + 'T00:00:00') : null}
                    endDate={datosContrato.fechaFin ? new Date(datosContrato.fechaFin + 'T00:00:00') : null}
                    minDate={datosContrato.fechaInicio ? new Date(datosContrato.fechaInicio + 'T00:00:00') : null}
                    dateFormat="yyyy-MM-dd"
                    className="filter-input"
                    placeholderText="Fecha de salida"
                    required
                  />
                </div>

              </div>
            </div>

            <h3 className="section-title">Condiciones Financieras</h3>
            <div className="condiciones-box">
              <div className="form-row">
                <div className="form-group">
                  <label>Alquiler Mensual ($)</label>
                  <input type="number" name="alquilerMensual" value={datosContrato.alquilerMensual} onChange={handleContratoChange} required className="filter-input" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Monto de Depósito ($)</label>
                  <input type="number" name="montoDeposito" value={datosContrato.montoDeposito} onChange={handleContratoChange} required className="filter-input" />
                </div>
                <div className="form-group">
                  <label>Tipo de Garantía Presentada</label>
                  <select name="garantia" value={datosContrato.garantia} onChange={handleContratoChange} required className="filter-input">
                    <option value="" disabled>Seleccionar...</option>
                    <option value="propietaria">Garantía Propietaria</option>
                    <option value="caucion">Seguro de Caución</option>
                    <option value="aval_bancario">Aval Bancario</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CLÁUSULA AUTOMÁTICA DE EXPENSAS */}
            {propSeleccionadaParaContrato &&
              (propSeleccionadaParaContrato.tipo_inmueble === 'departamento' || propSeleccionadaParaContrato.tipoInmueble === 'departamento') &&
              datosContrato.tipoAlquiler === 'largo_plazo' && (
                <div className="nota-expensas-box">
                  <h4>Cláusula sobre gestión y cobro de expensas</h4>
                  <p>
                    Con el fin de garantizar una correcta administración de los gastos comunes correspondientes a propiedades ubicadas en edificios o complejos habitacionales, se establece que el cobro y la gestión de las expensas serán tercerizados a través de una empresa externa especializada denominada <strong>Gestión Consorcios Integrales S.R.L.</strong>
                  </p>
                  <p>
                    Dicha empresa será la responsable exclusiva de la administración, liquidación y cobro de las expensas correspondientes al mantenimiento de los espacios comunes, servicios compartidos y demás gastos derivados del funcionamiento del consorcio o edificio.
                  </p>
                  <p>
                    La plataforma de alquileres no tendrá intervención en el cálculo, determinación ni cobro de estos montos, quedando estas gestiones exclusivamente a cargo de la empresa mencionada.
                  </p>
                  <p>
                    Los inquilinos y propietarios deberán comunicarse directamente con Gestión Consorcios Integrales S.R.L. para coordinar todo lo relacionado con la liquidación, forma de pago y cualquier consulta vinculada a las expensas. Para tales efectos, se establece como canal de contacto el correo electrónico: <a href="mailto:administracion@gci-consorcios.com">administracion@gci-consorcios.com</a>.
                  </p>
                  <p>
                    En consecuencia, toda cuestión relativa al monto de las expensas, su periodicidad, modalidades de pago o eventuales actualizaciones deberá ser tratada directamente entre las partes interesadas y la empresa administradora designada.
                  </p>
                </div>
              )}

            <div className="form-acciones-flex">
              <button type="submit" className="btn-submit btn-success-flex">
                Registrar Contrato
              </button>
              <button type="button" className="btn-cancelar-accion" onClick={() => setVistaActual('panel-cobros')}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  // VISTA 12: PANEL DE ADMINISTRACIÓN (RF28, RF28.1, RF29, RF30)
  if (vistaActual === 'panel-admin' && usuarioLogueado?.rol === 'admin') {
    const propsPendientes = propiedades.filter(p => p.estado === 'pendiente_revision');
    // Ya vienen filtrados de Supabase, así que solo lo asignamos
    const solisPendientes = solicitudesPropietarios;

    // Funciones exclusivas del Admin (Conectadas a Supabase)
    const procesarSolicitud = async (id, accion, emailUsuario) => {
  const nuevoRol = accion === 'Aprobada' ? 'propietario' : 'inquilino';
  const nuevoEstado = accion === 'Aprobada' ? 'aprobado' : 'rechazado';

  const { error } = await supabase
    .from('usuarios')
    .update({
      rol: nuevoRol,
      estado_verificacion: nuevoEstado
    })
    .eq('email', emailUsuario);

  if (error) {
    alert("Error al procesar: " + error.message);
  } else {
    enviarNotificacion(
      id,
      "Actualización de cuenta",
      `Tu solicitud para ser propietario ha sido ${accion}.`
    );

    alert(`¡Usuario ${accion} correctamente!`);

    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('estado_verificacion', 'pendiente');

    setSolicitudesPropietarios(data || []);
  }
};

    // RF29: Búsqueda dinámica de usuarios por Nombre, Apellido o Email
    const usuariosFiltrados = usuarios.filter(u =>
      (u.nombre?.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
        u.apellido?.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
        u.email?.toLowerCase().includes(busquedaUsuario.toLowerCase()) ||
        u.dni?.includes(busquedaUsuario)) &&
      u.rol !== 'admin' // Ocultamos al admin de la lista
    );

    // RF28: El Admin aprueba o rechaza propiedades en Supabase
    const procesarPropiedad = async (prop, accion, motivo = "") => {
      const nuevoEstado = accion === 'Aprobada' ? 'activo' : 'requiere_cambios';

      const { error } = await supabase.from('propiedades').update({ estado: nuevoEstado }).eq('id', prop.id);

      if (error) {
        alert("Error al actualizar la propiedad: " + error.message);
      } else {
        alert(`¡Inmueble ${accion.toLowerCase()} con éxito!`);
        setPropiedades(propiedades.map(p => p.id === prop.id ? { ...p, estado: nuevoEstado } : p));

        // 1. Buscamos el email real del dueño en la tabla usuarios usando su ID
        let emailReal = prop.propietarioEmail;
        if (!emailReal && prop.propietario_id) {
          const { data } = await supabase.from('usuarios').select('email').eq('id', prop.propietario_id).single();
          if (data) emailReal = data.email;
        }

        // 2. Si encontramos el email, le mandamos la notificación con el motivo
        if (emailReal) {
          let mensajeNotificacion = `La publicación de tu inmueble "${prop.titulo}" ha sido ${accion}.`;
          if (accion === 'Rechazada' && motivo.trim() !== "") {
            mensajeNotificacion += ` Cambios solicitados por el administrador: "${motivo}". Por favor, edita tu publicación desde tu panel.`;
          }
          enviarNotificacion(prop.propietario_id, "Revisión de Publicación", mensajeNotificacion);
        }
      }
    };
    // RF31: Búsqueda dinámica de propiedades por Título (excluyendo las pendientes de revisión)
    const propiedadesAdminFiltradas = propiedades.filter(p =>
      (p.titulo?.toLowerCase().includes(busquedaPropiedadAdmin.toLowerCase())) &&
      p.estado !== 'pendiente_revision'
    );

    return (
      <div className="buscador-container" style={{ padding: '40px 20px' }}>
        <header className="buscador-header" style={{ backgroundColor: '#2c3e50', color: 'white', borderRadius: '8px', marginBottom: '20px' }}>
          <h2>🛡️ Panel de Control - Administrador</h2>
          <button className="btn-link" style={{ color: '#ecf0f1' }} onClick={() => { setUsuarioLogueado(null); setVistaActual('login'); }}>Cerrar Sesión</button>
        </header>

        {/* TABLA 3: RF29 y RF30 GESTIÓN DE USUARIOS (NUEVO) */}
        <div className="auth-card" style={{ maxWidth: '1000px', width: '100%', marginBottom: '30px' }}>
          <h3 style={{ borderBottom: '2px solid #e74c3c', paddingBottom: '10px' }}>👥 Gestión de Usuarios</h3>

          <div className="form-group" style={{ marginTop: '15px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar usuario por Nombre, Apellido, Email o DNI..."
              value={busquedaUsuario}
              onChange={(e) => setBusquedaUsuario(e.target.value)}
              style={{ padding: '12px', width: '100%', borderRadius: '5px', border: '1px solid #bdc3c7', fontSize: '1rem' }}
            />
          </div>

          <table className="tabla-pagos" style={{ marginTop: '15px' }}>
            <thead><tr><th>Nombre Completo</th><th>DNI</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {usuariosFiltrados.map(user => {
                // MAGIA: Limpiamos las comillas extrañas y pasamos todo a minúsculas
                const estadoLimpio = user.estado ? String(user.estado).replace(/['"]/g, '').toLowerCase() : '';
                const rolLimpio = user.rol ? String(user.rol).replace(/['"]/g, '').toLowerCase() : '';

                return (
                  <tr key={user.id} style={{ opacity: estadoLimpio === 'inactivo' ? 0.6 : 1, backgroundColor: estadoLimpio === 'inactivo' ? '#f9ebea' : 'transparent' }}>
                    <td>{user.nombre} {user.apellido}</td>
                    <td>{user.dni}</td>
                    <td>{user.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{rolLimpio}</td>
                    <td><span className={`badge-estado ${estadoLimpio === 'activo' ? 'aprobado' : 'rechazado'}`}>{estadoLimpio}</span></td>
                    <td>
                      <div className="acciones-admin-cell">
                        <button
                          className="btn-submit btn-ver-detalles"
                          onClick={() => abrirPerfilDesdeAdmin(user)}
                        >
                          👤 Ver perfil
                        </button>

                        <button
                          className={estadoLimpio === 'activo' ? "btn-danger" : "btn-submit"}
                          style={{ padding: '5px 10px', margin: 0, backgroundColor: estadoLimpio === 'inactivo' ? '#27ae60' : '' }}
                          onClick={() => handleToggleEstadoUsuario(user.id, estadoLimpio)}
                        >
                          {estadoLimpio === 'activo' ? '🗑️ Suspender' : '✅ Reactivar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuariosFiltrados.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>No se encontraron usuarios con esos datos.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* TABLA 4: RF31 y RF32 GESTIÓN DE INMUEBLES */}
        <div className="auth-card" style={{ maxWidth: '1000px', width: '100%', marginBottom: '30px' }}>
          <h3 style={{ borderBottom: '2px solid #f39c12', paddingBottom: '10px' }}>🏘️ Gestión de Inmuebles</h3>

          <div className="form-group" style={{ marginTop: '15px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar propiedad por Título..."
              value={busquedaPropiedadAdmin}
              onChange={(e) => setBusquedaPropiedadAdmin(e.target.value)}
              style={{ padding: '12px', width: '100%', borderRadius: '5px', border: '1px solid #bdc3c7', fontSize: '1rem' }}
            />
          </div>

          <table className="tabla-pagos" style={{ marginTop: '15px' }}>
            <thead><tr><th>Título</th><th>Propietario</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {propiedadesAdminFiltradas.map(prop => (
                <tr key={prop.id} style={{ opacity: prop.estado === 'inactivo' ? 0.6 : 1, backgroundColor: prop.estado === 'inactivo' ? '#f9ebea' : 'transparent' }}>
                  <td>{prop.titulo}</td>
                  <td>{prop.propietarioEmail}</td>
                  <td style={{ textTransform: 'capitalize' }}>{prop.tipo_inmueble || prop.tipoInmueble}</td>
                  <td><span className={`badge-estado ${prop.estado === 'activo' ? 'aprobado' : 'rechazado'}`}>{prop.estado}</span></td>
                  <td>
                    <div className="acciones-admin-cell">
                      <button
                        className="btn-submit btn-ver-detalles"
                        onClick={() => abrirPublicacionDesdeAdmin(prop)}
                      >
                        🏠 Abrir publicación
                      </button>

                      <button
                        className={prop.estado === 'activo' ? 'btn-danger' : 'btn-submit'}
                        style={{
                          padding: '5px 10px',
                          margin: 0,
                          backgroundColor: prop.estado !== 'activo' ? '#27ae60' : ''
                        }}
                        onClick={() => handleToggleEstadoPropiedadAdmin(prop)}
                      >
                        {prop.estado === 'activo' ? '🗑️ Dar de Baja' : '✅ Reactivar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {propiedadesAdminFiltradas.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>No se encontraron propiedades activas o inactivas.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* TABLA 1: RF28.1 APROBAR PROPIETARIOS */}
        <div className="auth-card" style={{ maxWidth: '1000px', width: '100%', marginBottom: '30px' }}>
          <h3 style={{ borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>📝 Solicitudes de Propietarios</h3>
          {solisPendientes.length === 0 ? <p style={{ marginTop: '15px' }}>No hay solicitudes pendientes.</p> : (
            <table className="tabla-pagos" style={{ marginTop: '15px' }}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>CBU Declarado</th>
                  <th>Documentos</th> {/* <-- Nueva columna agregada */}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solisPendientes.map(soli => (
                  <tr key={soli.id}>
                    <td>{soli.nombre} {soli.apellido}</td>
                    <td>{soli.email}</td>
                    <td>{soli.cbu}</td>

                    {/* Botones para abrir los DNIs en una nueva pestaña */}
                    <td style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {soli.dni_frente ? (
                        <a href={soli.dni_frente} target="_blank" rel="noopener noreferrer" className="btn-link" style={{ margin: 0, padding: 0, fontSize: '0.85rem' }}>📷 Ver Frente</a>
                      ) : 'Sin foto'}

                      {soli.dni_reverso && (
                        <a href={soli.dni_reverso} target="_blank" rel="noopener noreferrer" className="btn-link" style={{ margin: 0, padding: 0, fontSize: '0.85rem' }}>📷 Ver Reverso</a>
                      )}
                    </td>

                    <td>
                      <div className="acciones-admin-cell">
                        <button
                          className="btn-submit btn-ver-detalles"
                          onClick={() => abrirPerfilDesdeAdmin(soli)}
                        >
                          👤 Ver perfil
                        </button>

                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            className="btn-submit"
                            style={{ padding: '5px 10px', margin: 0, backgroundColor: '#27ae60' }}
                            onClick={() => procesarSolicitud(soli.id, 'Aprobada', soli.email)}
                          >
                            ✅ Aprobar
                          </button>

                          <button
                            className="btn-danger"
                            style={{ padding: '5px 10px', margin: 0 }}
                            onClick={() => procesarSolicitud(soli.id, 'Rechazada', soli.email)}
                          >
                            ❌ Rechazar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* TABLA 2: RF28 APROBAR ESCRITURAS/INMUEBLES */}
        <div className="auth-card" style={{ maxWidth: '1000px', width: '100%' }}>
          <h3 style={{ borderBottom: '2px solid #9b59b6', paddingBottom: '10px' }}>📄 Revisión de Inmuebles</h3>
          {propsPendientes.length === 0 ? <p style={{ marginTop: '15px' }}>No hay inmuebles pendientes de revisión.</p> : (
            <table className="tabla-pagos" style={{ marginTop: '15px' }}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Dirección</th>
                  <th>Tipo</th>
                  <th>Escritura</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {propsPendientes.map(prop => (
                  <tr key={prop.id}>
                    <td>{prop.titulo}</td>
                    <td>{prop.direccion}</td>
                    <td style={{ textTransform: 'capitalize' }}>{prop.tipo_inmueble || prop.tipoInmueble}</td>

                    <td>
                      {prop.escritura ? (
                        <a href={prop.escritura} target="_blank" rel="noopener noreferrer" className="btn-link" style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                          📄 Ver Documento
                        </a>
                      ) : (
                        <span style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Sin archivo</span>
                      )}
                    </td>

                    {/* ---> COLUMNA DE ACCIONES LIMPIA CON CLASES CSS <--- */}
                    <td className="acciones-admin-cell">
                      <button
                        className="btn-submit btn-ver-detalles"
                        onClick={() => {
                          setPropiedadSeleccionada(prop);
                          setVistaActual('detalle-propiedad');
                        }}
                      >
                        👁️ Ver Detalles Completos
                      </button>

                      <div className="admin-botones-accion">
                        <button
                          className="btn-submit btn-activar"
                          onClick={() => procesarPropiedad(prop, 'Aprobada')}
                        >
                          ✅ Activar
                        </button>
                        <button
                          className="btn-submit btn-rechazar"
                          onClick={() => {
                            const motivo = prompt("Indique los cambios solicitados (opcional):");
                            if (motivo !== null) procesarPropiedad(prop, 'Rechazada', motivo);
                          }}
                        >
                          ⚠️ Pedir Cambios
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {perfilPublicoAbierto && (
          <div className="modal-overlay">
            <div className="modal-content perfil-publico-modal">
              <div className="perfil-publico-header">
                <div className="perfil-publico-avatar">
                  {perfilPublicoAbierto.foto_perfil ? (
                    <img src={perfilPublicoAbierto.foto_perfil} alt={`Perfil de ${perfilPublicoAbierto.nombre}`} />
                  ) : (
                    <span>{perfilPublicoAbierto.nombre?.[0] || 'U'}</span>
                  )}
                </div>

                <div className="perfil-publico-main">
                  <h3>{perfilPublicoAbierto.nombre} {perfilPublicoAbierto.apellido}</h3>
                  <p>Miembro desde {formatearMiembroDesde(perfilPublicoAbierto.created_at)}</p>

                  <div className="perfil-publico-stats">
                    <span className="perfil-chip">
                      ⭐ {obtenerResumenUsuario(
                        perfilPublicoAbierto,
                        perfilPublicoAbierto.tipoPerfil || 'huesped'
                      ).promedio}
                    </span>
                    <span className="perfil-chip">
                      {obtenerResumenUsuario(
                        perfilPublicoAbierto,
                        perfilPublicoAbierto.tipoPerfil || 'huesped'
                      ).cantidad} reseñas
                    </span>
                  </div>
                </div>
              </div>

              <div className="perfil-publico-body">
                <div className="perfil-bloque">
                  <h4>Biografía</h4>
                  <p>{perfilPublicoAbierto.bio || 'Este usuario todavía no cargó una biografía.'}</p>
                </div>

                <div className="perfil-bloque-grid">
                  <div className="perfil-bloque">
                    <h4>Idiomas</h4>
                    <div className="perfil-tags">
                      {parseListaTexto(perfilPublicoAbierto.idiomas).length > 0 ? (
                        parseListaTexto(perfilPublicoAbierto.idiomas).map((item, idx) => (
                          <span key={idx} className="perfil-chip">{item}</span>
                        ))
                      ) : (
                        <p>No especificados.</p>
                      )}
                    </div>
                  </div>

                  <div className="perfil-bloque">
                    <h4>Intereses</h4>
                    <div className="perfil-tags">
                      {parseListaTexto(perfilPublicoAbierto.intereses).length > 0 ? (
                        parseListaTexto(perfilPublicoAbierto.intereses).map((item, idx) => (
                          <span key={idx} className="perfil-chip">{item}</span>
                        ))
                      ) : (
                        <p>No especificados.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="perfil-bloque">
                  <h4>Historial completo de reseñas</h4>

                  {obtenerResenasUsuario(
                    perfilPublicoAbierto.id,
                    perfilPublicoAbierto.tipoPerfil || 'huesped'
                  ).length === 0 ? (
                    <p className="hint-text">Todavía no hay reseñas visibles para este perfil.</p>
                  ) : (
                    <div className="lista-comentarios">
                      {obtenerResenasUsuario(
                        perfilPublicoAbierto.id,
                        perfilPublicoAbierto.tipoPerfil || 'huesped'
                      ).map((resena) => {
                        const autor = usuarios.find(u => String(u.id) === String(resena.autorId));
                        return (
                          <div key={resena.id} className="comentario-card">
                            <div className="comentario-header">
                              <strong>{autor ? `${autor.nombre} ${autor.apellido}` : 'Usuario'}</strong>
                              <span className="estrellitas">{'⭐'.repeat(resena.calificacion)}</span>
                              <span className="fecha-comentario">
                                {new Date(resena.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="comentario-texto">"{resena.comentario}"</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="btn-danger"
                onClick={() => setPerfilPublicoAbierto(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }

  // VISTA 13: RECUPERAR CONTRASEÑA (RF34)
  if (vistaActual === 'recuperar-password') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Recuperar Contraseña</h2>
          <p>Ingresa tu DNI y el correo electrónico con el que te registraste.</p>

          <form onSubmit={handleRecuperarPassword} className="auth-form">
            <div className="form-group">
              <label>Correo Electrónico</label>
              <input type="email" name="emailRecupero" required placeholder="ejemplo@correo.com" />
            </div>

            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>DNI</label>
              <input type="number" name="dniRecupero" required placeholder="Sin puntos" />
            </div>

            <button type="submit" className="btn-submit" style={{ marginTop: '20px' }}>
              Enviar enlace de recuperación
            </button>

            <button type="button" className="btn-link" onClick={() => setVistaActual('login')} style={{ marginTop: '10px' }}>
              Cancelar y volver
            </button>
          </form>
        </div>
      </div>
    );
  }


  // VISTA 2: REGISTRO (RF1 y RF5)
  return (
    <div className="auth-container">
      <div className="auth-card">

        <button className="btn-volver-limpio margen-volver" onClick={() => { setErrores({}); setVistaActual('inicio'); }}>
          ⬅ Volver al inicio
        </button>

        <h2>Registro de Usuario</h2>
        <p>Únete a nuestra plataforma de alquileres</p>

        <form onSubmit={handleRegistro} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nombre">Nombre</label>
              <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} />
              {errores.nombre && <span className="error-text">{errores.nombre}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="apellido">Apellido</label>
              <input type="text" id="apellido" name="apellido" value={formData.apellido} onChange={handleChange} />
              {errores.apellido && <span className="error-text">{errores.apellido}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dni">DNI</label>
              <input type="number" id="dni" name="dni" value={formData.dni} onChange={handleChange} />
              {errores.dni && <span className="error-text">{errores.dni}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="telefono">Teléfono</label>
              <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} />
            {errores.email && <span className="error-text">{errores.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} />
            <small className="password-help-text">
              Debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial.
            </small>
            {errores.password && <span className="error-text">{errores.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="provincia">Provincia</label>
            <select id="provincia" name="provincia" value={formData.provincia} onChange={handleChange} >
              <option value="" disabled>Selecciona tu provincia</option>
              {provinciasArgentinas.map((prov, index) => (
                <option key={index} value={prov}>{prov}</option>
              ))}
            </select>
            {errores.provincia && <span className="error-text">{errores.provincia}</span>}
          </div>

          <button type="submit" className="btn-submit">Registrarme</button>
        </form>

        <div className="toggle-view">
          <span>¿Ya tienes una cuenta? </span>
          <button className="btn-link" type="button" onClick={() => { setErrores({}); setVistaActual('login'); }}>
            Inicia sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;