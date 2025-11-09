
# Full-Stack Analytics & AI Dashboard

This is a production-grade, full-stack web application built in a Turborepo monorepo. It features a pixel-perfect analytics dashboard and a "Chat with Data" interface powered by a self-hosted AI agent (Vanna AI + Groq) to perform natural language queries on a PostgreSQL database.

##  Live Demo URLs

* **Frontend (Vercel):** `https://<your-frontend-app>.vercel.app`
* **Backend API (Vercel):** `https://<your-frontend-app>.vercel.app/api`
* **Vanna AI (Render):** `https://vannaapp.onrender.com`

---

## 📷 Preview
![Dashboard Preview](https://github.com/user-attachments/assets/673a2571-ba75-43ee-97e4-1831e9f9c73e)


---

## ⚙️ Tech Stack & Architecture

This project is a monorepo with three distinct services and a shared database package.

| Layer | Component | Key Technologies | Deployment Host |
| :--- | :--- | :--- | :--- |
| **Frontend/UI** | `apps/web` | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts | Vercel |
| **Backend API** | `apps/api` | Next.js 14 (API Routes), TypeScript, Prisma ORM | Vercel |
| **AI Layer** | `apps/vanna-ai`| Python (FastAPI), Groq SDK (Llama 3.3 70B), SQL Alchemy | Render |
| **Database** | `packages/database`| PostgreSQL (Neon), Prisma | Neon (Serverless) |


---

## 🔑 Environment Variables

You must set these variables in *both* your local `.env` files and in your production hosting dashboards (Vercel, Render).

### 1. `apps/vanna-ai/.env` (Local & Render)
```env
# Connection string for your Neon database
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"

# Your Groq API Key
GROQ_API_KEY="gsk_..."
````

### 2\. `apps/api` (Vercel Project Environment Variables)

```env
# Connection string for Prisma
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"

# Your Groq API Key (for /chat-with-data route)
GROQ_API_KEY="gsk_..."

# Public URL of your deployed Vanna AI server (from Render)
VANNA_API_BASE_URL="[https://your-vanna-app.onrender.com](https://your-vanna-app.onrender.com)"
```

### 3\. `apps/web` (Vercel Project Environment Variables)

```env
# Tells the frontend to use the proxied API path
NEXT_PUBLIC_API_BASE="/api"
```

*(For local development, `apps/web/.env.local` should set `NEXT_PUBLIC_API_BASE="http://localhost:3001/api"`)*

-----

## 🛠️ Local Development Setup

### 1\. Install Dependencies

Run from the monorepo root:

```bash
npm install
```

### 2\. Setup Python Environment

This project uses a Python virtual environment (`venv`) for the Vanna AI server.

```bash
# Install required Python packages into the venv
.\apps\vanna-ai\venv\Scripts\pip.exe install -r apps/vanna-ai/requirements.txt

# Install the PostgreSQL driver
.\apps\vanna-ai\venv\Scripts\pip.exe install psycopg2-binary
```

### 3\. Setup Database & Seed Data

This project uses Prisma to manage the database schema, defined in `packages/database/prisma/schema.prisma`.

```bash
# Push the schema to your Neon database
npm -w @repo/database run db:push

# Generate the Prisma client
npm -w @repo/database run generate

# Seed the database with sample data from Analytics_Test_Data.json
npm -w @repo/database run db:seed
```

### 4\. Run All Services

This single command starts the Next.js frontend, Next.js backend, and Python FastAPI server concurrently.

```bash
npm run dev
```

  * **Frontend:** `http://localhost:3000`
  * **Backend API:** `http://localhost:3001`
  * **Vanna AI:** `http://localhost:8000`

-----
## 💾 Database Schema

The JSON data is normalized into three relational tables.

## 📷 ER Diagram
![ER](https://github.com/user-attachments/assets/56a3315e-f557-47e0-8240-f7c173342e44)


-----

## 🤖 "Chat with Data" Workflow

The AI chat feature is a multi-step process that translates natural language into data.

1.  **Frontend (`ChatUI.tsx`)**: The user submits a question (e.g., "how many invoices?"). The request is sent to its own backend at `/api/chat-with-data`.
2.  **Vercel Rewrite**: Vercel intercepts the request and forwards it to the `my-project-api.vercel.app` deployment.
3.  **Next.js API (`apps/api/chat-with-data`)**: This route acts as a secure proxy. It receives the question and forwards it to the live Vanna AI server on Render (`VANNA_API_BASE_URL/chat`).
4.  **Vanna AI Server (`main.py`)**:
      * **Generate SQL**: The FastAPI server takes the question and, using a detailed system prompt and the database schema, asks the **Groq LLM** to generate a SQL query. (e.g., `SELECT COUNT(*) FROM "Invoice"`).
      * **Execute SQL**: It uses **SQLAlchemy** and `psycopg2` to execute this SQL query directly on the Neon (PostgreSQL) database.
      * **Generate Explanation**: The raw data (e.g., `[{"count": 50}]`) is sent back to Groq *a second time* with a new prompt asking it to provide a natural language summary.
5.  **Response**: The Python server returns a JSON object containing the `sql`, `data`, and `explanation` to the Next.js API, which forwards it to the frontend.
6.  **UI Render**: The frontend displays all three pieces of information to the user.

-----

## 📖 API Documentation

All API endpoints are deployed to `apps/api` and proxied via the frontend domain.

### 1\. `/api/stats`

  * **Method:** `GET`
  * **Description:** Returns four key metrics for the "Overview Cards".
  * **Example Response:**
    ```json
    {
      "totalSpendYTD": 120500.75,
      "totalInvoices": 150,
      "avgInvoiceValue": 803.34,
      "documentsUploaded": 150
    }
    ```

### 2\. `/api/invoices`

  * **Method:** `GET`
  * **Description:** Returns a paginated list of invoices.
  * **Query Params:**
      * `search` (string): Filters by `invoice_number` or `Vendor.name`.
      * `sort` (string): Column name to sort by (e.g., `invoice_date`).
      * `order` (string): `asc` or `desc`.
  * **Example Response:**
    ```json
    {
      "invoices": [
        {
          "id": "...",
          "invoice_number": "INV-001",
          "invoice_date": "2025-10-20T00:00:00.000Z",
          "invoice_total": 1200.50,
          "document_type": "RE",
          "vendor": { "name": "Vendor A" }
        }
      ],
      "totalCount": 1
    }
    ```

### 3\. `/api/invoice-trends`

  * **Method:** `GET`
  * **Description:** Returns data for the past 12 months, tracking total spend and invoice count for the "Invoice Volume + Value Trend" chart.
  * **Example Response:**
    ```json
    [
      { "label": "Nov 24", "spend": 15000, "count": 12 },
      { "label": "Dec 24", "spend": 18000, "count": 15 },
      ...
    ]
    ```

### 4\. `/api/vendors/top10`

  * **Method:** `GET`
  * **Description:** Returns the top 10 vendors by aggregated `invoice_total`.
  * **Example Response:**
    ```json
    [
      { "vendor": "Vendor A", "totalSpend": 25000.50, "invoiceCount": 10 },
      { "vendor": "Vendor B", "totalSpend": 18000.00, "invoiceCount": 5 },
      ...
    ]
    ```

### 5\. `/api/category-spend`

  * **Method:** `GET`
  * **Description:** Aggregates total spend grouped by the `sachkonto` column from `LineItem`.
  * **Example Response:**
    ```json
    [
      { "sachkonto": "Software", "totalSpend": 30000, "percentage": 0.45 },
      { "sachkonto": "Office Supplies", "totalSpend": 15000, "percentage": 0.22 },
      ...
    ]
    ```

### 6\. `/api/cash-outflow`

  * **Method:** `GET`
  * **Description:** Calculates expected cash outflow based on `due_date` for all `RE` (Invoice) documents.
  * **Example Response:**
    ```json
    [
      { "label": "Overdue", "amount": 5000.00 },
      { "label": "0 - 7 days", "amount": 12000.00 },
      { "label": "8 - 30 days", "amount": 8000.00 },
      ...
    ]
    ```

### 7\. `/api/chat-with-data`

  * **Method:** `POST`
  * **Description:** Proxies a natural language query to the Vanna AI server.
  * **Request Body:**
    ```json
    {
      "question": "How many invoices are overdue?"
    }
    ```
  * **Success Response:**
    ```json
    {
      "sql": "SELECT COUNT(*) FROM \"Invoice\" WHERE \"due_date\" < NOW()",
      "data": [{ "count": 12 }],
      "explanation": "There are 12 invoices that are currently overdue."
    }
    ```

<!-- end list -->

```
```
