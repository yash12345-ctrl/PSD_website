# Open Elective — Student Submissions Backend

Professional Node.js backend with **Prisma ORM** and local **SQL Database (SQLite)** for storing student assignments, reports, and metadata.

---

## Architecture Overview

```text
backend/
├── prisma/
│   └── schema.prisma        # Prisma data model for Submission
├── src/
│   ├── config/
│   │   ├── prisma.js        # Prisma client singleton
│   │   └── upload.js        # Multer disk storage & validation engine
│   ├── controllers/
│   │   └── submissionController.js # CRUD handlers & file downloads
│   ├── middlewares/
│   │   └── errorHandler.js  # Global error & 404 middlewares
│   ├── routes/
│   │   └── submissionRoutes.js # Express router definition
│   └── app.js               # Express application configuration
├── uploads/
│   ├── assignments/         # Stored assignment files
│   └── reports/             # Stored project report files
├── .env                     # Local environment variables
├── .env.example
├── server.js                # Server entry point
└── package.json
```

---

## Local SQL Database

The database is configured via Prisma with SQLite, creating an actual SQL database file directly inside your root `db/` folder (`db/dev.db`):

- **No external servers needed**: Zero installation required for MySQL or PostgreSQL.
- **Relational SQL queries**: Full SQL capability with ACID transactions and schema constraints.
- **Prisma Schema**: [`prisma/schema.prisma`](prisma/schema.prisma).

---

## Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Initialize Local SQL Database
Generate the Prisma Client and sync your schema to `db/dev.db`:
```bash
npx prisma db push
```

### 3. Start Development Server
```bash
npm run dev
# Or production mode:
npm start
```
Server runs by default on **`http://localhost:5000`**.

---

## API Endpoints

| Method | Endpoint | Description | Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/submissions` | Upload assignment & report, save to SQL DB | `multipart/form-data` (`name`, `regNo`, `section`, `assignment`, `report`) |
| `GET` | `/api/submissions` | List all submissions | None |
| `GET` | `/api/submissions/:identifier` | Get submission by UUID or Ref ID | None |
| `GET` | `/api/submissions/:id/download/:fileType` | Download uploaded file (`assignment` or `report`) | None |
| `GET` | `/api/health` | Service health check | None |

---

## Testing with cURL

```bash
curl -X POST http://localhost:5000/api/submissions \
  -F "name=Yash Tomar" \
  -F "regNo=23BCE1024" \
  -F "section=Section A" \
  -F "assignment=@/path/to/assignment.pdf" \
  -F "report=@/path/to/report.pdf"
```

