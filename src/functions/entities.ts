import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { getSql, sql } from '../shared/db/sql';
import { z } from 'zod';

// Offices
const OfficeSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

app.http('getOffices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'offices',
  handler: async (): Promise<HttpResponseInit> => {
    const pool = await getSql();
    const result = await pool.request().query('SELECT TOP 200 * FROM Offices ORDER BY CreatedAt DESC');
    return { status: 200, body: JSON.stringify(result.recordset) };
  },
});

app.http('getOffice', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'offices/{id}',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const id = req.params.get('id')!;
    const pool = await getSql();
    const result = await pool.request().input('id', sql.UniqueIdentifier, id).query('SELECT * FROM Offices WHERE Id = @id');
    if (result.recordset.length === 0) return { status: 404, body: JSON.stringify({ error: 'Not found' }) };
    return { status: 200, body: JSON.stringify(result.recordset[0]) };
  },
});

app.http('createOffice', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'offices',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const body = await req.json();
    const parsed = OfficeSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };
    const pool = await getSql();
    const result = await pool
      .request()
      .input('name', sql.NVarChar(100), parsed.data.name)
      .input('address', sql.NVarChar(500), parsed.data.address ?? null)
      .input('city', sql.NVarChar(100), parsed.data.city ?? null)
      .input('country', sql.NVarChar(100), parsed.data.country ?? null)
      .input('timeZone', sql.NVarChar(50), parsed.data.timeZone ?? null)
      .query(
        `INSERT INTO Offices (Id, OrganizationId, Name, Address, City, Country, TimeZone, IsActive)
         OUTPUT INSERTED.*
         VALUES (NEWID(), (SELECT TOP 1 Id FROM Organizations), @name, @address, @city, @country, @timeZone, 1)`
      );
    return { status: 201, body: JSON.stringify(result.recordset[0]) };
  },
});

app.http('updateOffice', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'offices/{id}',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const id = req.params.get('id')!;
    const body = await req.json();
    const parsed = OfficeSchema.partial().safeParse(body);
    if (!parsed.success) return { status: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };
    const pool = await getSql();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier, id)
      .input('name', sql.NVarChar(100), parsed.data.name ?? null)
      .input('address', sql.NVarChar(500), parsed.data.address ?? null)
      .input('city', sql.NVarChar(100), parsed.data.city ?? null)
      .input('country', sql.NVarChar(100), parsed.data.country ?? null)
      .input('timeZone', sql.NVarChar(50), parsed.data.timeZone ?? null)
      .query(
        `UPDATE Offices SET
           Name = COALESCE(@name, Name),
           Address = COALESCE(@address, Address),
           City = COALESCE(@city, City),
           Country = COALESCE(@country, Country),
           TimeZone = COALESCE(@timeZone, TimeZone),
           UpdatedAt = GETDATE()
         OUTPUT INSERTED.*
         WHERE Id = @id`
      );
    if (result.recordset.length === 0) return { status: 404, body: JSON.stringify({ error: 'Not found' }) };
    return { status: 200, body: JSON.stringify(result.recordset[0]) };
  },
});

app.http('deleteOffice', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'offices/{id}',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const id = req.params.get('id')!;
    const pool = await getSql();
    await pool.request().input('id', sql.UniqueIdentifier, id).query('DELETE FROM Offices WHERE Id = @id');
    return { status: 204 };
  },
});

// Аналогично Departments, Employees (как EnhancedEmployee) и Clients — MVP CRUD

const DepartmentSchema = z.object({ name: z.string(), description: z.string().optional(), isActive: z.boolean().optional().default(true) });
app.http('getDepartments', { methods: ['GET'], authLevel: 'anonymous', route: 'departments', handler: async (): Promise<HttpResponseInit> => {
  const pool = await getSql();
  const r = await pool.request().query('SELECT TOP 200 * FROM Departments ORDER BY CreatedAt DESC');
  return { status: 200, body: JSON.stringify(r.recordset) };
}});
app.http('createDepartment', { methods: ['POST'], authLevel: 'anonymous', route: 'departments', handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
  const body = await req.json(); const p = DepartmentSchema.safeParse(body); if (!p.success) return { status: 400, body: JSON.stringify({ error: p.error.flatten() }) };
  const pool = await getSql();
  const r = await pool.request()
    .input('name', sql.NVarChar(100), p.data.name)
    .input('description', sql.NVarChar(500), p.data.description ?? null)
    .query(`INSERT INTO Departments (Id, OrganizationId, Name, Description, IsActive) OUTPUT INSERTED.* VALUES (NEWID(), (SELECT TOP 1 Id FROM Organizations), @name, @description, 1)`);
  return { status: 201, body: JSON.stringify(r.recordset[0]) };
}});

const ClientSchema = z.object({ firstName: z.string(), lastName: z.string(), email: z.string().email(), phone: z.string().optional(), firmName: z.string().optional(), firmAddress: z.string().optional(), isActive: z.boolean().optional().default(true) });
app.http('getClients', { methods: ['GET'], authLevel: 'anonymous', route: 'users/clients', handler: async (): Promise<HttpResponseInit> => {
  const pool = await getSql();
  const r = await pool.request().query('SELECT TOP 200 * FROM Clients ORDER BY CreatedAt DESC');
  return { status: 200, body: JSON.stringify(r.recordset) };
}});
app.http('createClient', { methods: ['POST'], authLevel: 'anonymous', route: 'users/clients', handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
  const body = await req.json(); const p = ClientSchema.safeParse(body); if (!p.success) return { status: 400, body: JSON.stringify({ error: p.error.flatten() }) };
  const pool = await getSql();
  const r = await pool.request()
    .input('firstName', sql.NVarChar(100), p.data.firstName)
    .input('lastName', sql.NVarChar(100), p.data.lastName)
    .input('email', sql.NVarChar(255), p.data.email)
    .input('phone', sql.NVarChar(50), p.data.phone ?? null)
    .input('firmName', sql.NVarChar(200), p.data.firmName ?? null)
    .input('firmAddress', sql.NVarChar(500), p.data.firmAddress ?? null)
    .query(`INSERT INTO Clients (Id, OrganizationId, FirstName, LastName, Email, Phone, FirmName, FirmAddress, IsActive) OUTPUT INSERTED.* VALUES (NEWID(), (SELECT TOP 1 Id FROM Organizations), @firstName, @lastName, @email, @phone, @firmName, @firmAddress, 1)`);
  return { status: 201, body: JSON.stringify(r.recordset[0]) };
}});



