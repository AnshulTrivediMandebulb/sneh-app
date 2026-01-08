import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def list_databases():
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD"),
            database="postgres"  # Connect to default DB to list others
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT datname FROM pg_database;")
            dbs = cur.fetchall()
            print("Databases found:")
            for db in dbs:
                print(f"- {db[0]}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_databases()
