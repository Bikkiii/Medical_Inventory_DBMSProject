# Inventory Management for Medicine

Full-stack DBMS project for managing medicine inventory, purchases, sales, returns, suppliers, and stock ledger.

## Stack
- Backend: Node.js, Express, MySQL
- Frontend: React (Vite)

## Setup
1. Database
   1. Install MySQL and ensure it is running.
   2. Create and seed the database:
      ```sql
      -- from MySQL client
      SOURCE database/main.sql;
      ```
      Or from a shell:
      ```bash
      mysql -u root -p < database/main.sql
      ```

2. Backend
   ```bash
   cd backend
   copy .env.example .env
   npm install
   npm run dev
   ```
   Update `backend/.env` with your MySQL credentials.

3. Frontend
   ```bash
   cd frontend
   copy .env.example .env
   npm install
   npm run dev
   ```

## Demo Credentials
Passwords are all `password123`:
- Admin: `admin`
- Pharmacist: `john_pharma`
- Pharmacist: `sara_pharma`

Optional admin creator:
```bash
cd backend
node createAdmin.js
```
This will create `superadmin` / `admin123` if it does not already exist.

## Notes
- Categories are managed in a dedicated table and exposed via `/api/categories`.
- The stock ledger is available at `/inventory/ledger`.
