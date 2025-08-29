import sql from 'mssql';

const sqlConfig: sql.config = {
  server: process.env.SQL_SERVER as string,
  database: process.env.SQL_DATABASE as string,
  user: process.env.SQL_USER as string,
  password: process.env.SQL_PASSWORD as string,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getSql(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  pool = await sql.connect(sqlConfig);
  return pool;
}

export { sql };



