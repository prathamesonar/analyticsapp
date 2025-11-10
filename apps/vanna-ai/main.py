import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.pool import NullPool
from groq import Groq 

import pathlib
env_path = pathlib.Path(__file__).parent / ".env"
print(f"[DEBUG] Looking for .env at: {env_path}")
print(f"[DEBUG] .env exists: {env_path.exists()}")
load_dotenv(env_path)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001",
        "https://full-analyticsps.vercel.app"  # <-- ADD THIS LINE
    ]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Connection Setup ---
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")

# Create database engine
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    connect_args={
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
    }
)

# --- Groq Setup ---
groq_api_key = os.environ.get("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError("GROQ_API_KEY environment variable not set")

print("[INIT] Using Groq for LLM")
client = Groq(api_key=groq_api_key) # Initialize Groq client

# --- Schema Extraction ---
def get_database_schema():
    """Extract the database schema"""
    inspector = inspect(engine)
    schema = {}
    
    print(f"[DEBUG] Getting table names...")
    table_names = inspector.get_table_names()
    print(f"[DEBUG] Found tables: {table_names}")
    
    for table_name in table_names:
        columns = inspector.get_columns(table_name)
        # print(f"[DEBUG] Table '{table_name}' has {len(columns)} columns")
        schema[table_name] = {col['name']: str(col['type']) for col in columns}
    
    return schema

# Get schema on startup
print("[INIT] Extracting database schema...")
try:
    db_schema = get_database_schema()
    
    if not db_schema:
        print("[WARNING] No tables found in database!")
        schema_str = "No tables found. Please check your database."
    else:
        # Create the schema string for the prompt
        schema_str = "\n".join([
            f"Table: {table}\n  Columns: {', '.join([f'{col} ({type_})' for col, type_ in cols.items()])}"
            for table, cols in db_schema.items()
        ])
        print("[INIT] Schema extracted successfully:")
        print(schema_str)
        print(f"[INIT] Total tables: {len(db_schema)}")
except Exception as e:
    print(f"[ERROR] Failed to extract schema: {e}")
    db_schema = {}
    schema_str = "Error loading schema"

# --- Utility Functions ---
def run_sql(sql: str) -> list:
    """Execute SQL and return results"""
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        rows = result.fetchall()
        columns = result.keys()
        # Convert rows to list of dictionaries
        return [dict(zip(columns, row)) for row in rows]

def generate_sql_with_openai(question: str) -> str:
    """Use Groq to generate SQL from natural language"""
    try:
        system_content = f"""You are a PostgreSQL expert. Your ONLY job is to generate a single, valid SQL query.

Database Schema:
{schema_str}

CRITICAL RULES:
1. Wrap all table names in double quotes using the exact case shown above (e.g., "Invoice", "Vendor", "LineItem").
2. Wrap all column names in double quotes (e.g., "invoice_total").
3. Use the exact table names as they appear in the schema.
4. Return ONLY the SQL query with no explanations, text, or markdown.
"""
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": system_content
                },
                {
                    "role": "user",
                    "content": question
                }
            ],
            temperature=0,
            max_tokens=500
        )
        
        sql = response.choices[0].message.content.strip()
        
        # Clean up markdown code blocks if the LLM adds them
        if sql.startswith("```"):
            sql = sql.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            
        if sql.lower().startswith("sql"):
            sql = sql[3:].strip()
            
        sql = sql.rstrip(';')

        print(f"[DEBUG] Raw SQL from LLM: {response.choices[0].message.content}")
        print(f"[DEBUG] Cleaned SQL: {sql}")
        return sql
    except Exception as e:
        print(f"[ERROR] Groq API error: {e}")
        raise

def generate_response_with_openai(question: str, sql: str, data: list) -> str:
    """Use Groq to generate a natural language response"""
    try:
        data_str = str(data[:5]) if data else "No results"
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful data analyst. Provide clear, concise summaries of database query results."
                },
                {
                    "role": "user",
                    "content": f"""Question: {question}
SQL Query: {sql}
Query Results (first 5 rows): {data_str}

Provide a brief, natural language summary of these results."""
                }
            ],
            temperature=0.7,
            max_tokens=300
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[ERROR] Response generation error: {e}")
        return "Query executed successfully."

# --- FastAPI Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Vanna AI Server is running", "status": "ok"}

@app.get("/health")
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected", "schema_tables": list(db_schema.keys())}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}, 500

@app.post("/generate_sql")
async def generate_sql_endpoint(request: dict):
    """Generate SQL from natural language question"""
    question = request.get("question")
    if not question:
        return {"error": "Question is required"}, 400
    
    try:
        print(f"[SQL] Generating SQL for: {question}")
        sql = generate_sql_with_openai(question)
        print(f"[SQL] Generated: {sql}")
        
        print(f"[SQL] Executing query...")
        data = run_sql(sql)
        print(f"[SQL] Query returned {len(data)} rows")
        
        return {
            "sql": sql,
            "data": data,
            "row_count": len(data)
        }
    
    except Exception as e:
        print(f"[ERROR] Error generating SQL: {e}")
        return {"error": str(e)}, 500

@app.post("/chat")
async def chat(request: dict):
    """Chat endpoint for natural language queries"""
    message = request.get("message")
    if not message:
        return {"error": "Message is required"}, 400
    
    print(f"[CHAT] Received: {message}")
    
    try:
        # Generate SQL
        print(f"[CHAT] Generating SQL...")
        sql = generate_sql_with_openai(message)
        print(f"[CHAT] Generated SQL: {sql}")
        
        # Execute query
        print(f"[CHAT] Executing query...")
        data = run_sql(sql)
        print(f"[CHAT] Query returned {len(data)} rows")
        
        # Generate response
        print(f"[CHAT] Generating response...")
        response_text = generate_response_with_openai(message, sql, data)
        print(f"[CHAT] Response: {response_text}")
        
        return {
            "response": response_text,
            "sql": sql,
            "data": data,
            "row_count": len(data)
        }
    
    except Exception as e:
        print(f"[ERROR] Chat error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}, 500

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
