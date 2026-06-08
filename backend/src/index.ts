import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import authRouter from './routes/auth';
import gpsRouter from './routes/gps';
import jornadasRouter from './routes/jornadas';
import paradasRouter from './routes/paradas';
import clientesRouter from './routes/clientes';
import rutasRouter from './routes/rutas';
import asignacionesRouter from './routes/asignaciones';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.env.UPLOADS_DIR ?? './uploads')));

app.use('/auth', authRouter);
app.use('/gps', gpsRouter);
app.use('/jornadas', jornadasRouter);
app.use('/paradas', paradasRouter);
app.use('/clientes', clientesRouter);
app.use('/rutas', rutasRouter);
app.use('/asignaciones', asignacionesRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'Full Advance' }));

app.listen(PORT, () => {
  console.log(`Full Advance backend corriendo en http://localhost:${PORT}`);
});
