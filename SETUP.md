# Full Advance - Guía de Setup

## 1. Base de datos PostgreSQL

Crear la base de datos y ejecutar el schema:

```bash
psql -U postgres -c "CREATE DATABASE fulladvance;"
psql -U postgres -d fulladvance -f backend/src/db/schema.sql
```

Credenciales del admin por defecto:
- Email: admin@fulladvance.com
- Password: password

## 2. Backend

```bash
cd backend
cp .env.example .env
# Editar .env con los datos correctos de la base de datos

npm run dev
# Corre en http://localhost:3001
```

## 3. App Mobile (Repartidor / Preventista)

Editar `constants/index.ts` y cambiar `API_URL` por la IP local de tu PC:

```ts
export const API_URL = 'http://192.168.X.X:3001'; // tu IP local
```

```bash
cd full-advance
npm run android  # para Android
npm run web      # para el panel admin en el browser
```

## 4. Panel Admin (Web)

Correr `npm run web` y abrir http://localhost:8081 en el navegador.

## Usuarios por defecto

| Email | Password | Rol |
|-------|----------|-----|
| admin@fulladvance.com | password | admin |

Crear repartidores y preventistas desde el panel admin o directo en la DB:

```sql
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Nombre Apellido', 'email@ejemplo.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'repartidor');
-- password por defecto: "password"
```
