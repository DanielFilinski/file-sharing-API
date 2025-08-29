import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../shared/db/cosmos';
import { z } from 'zod';

const DocumentSchema = z.object({
  partitionKey: z.string(),
  name: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  blobUrl: z.string().url(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'archived']).default('draft'),
  category: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.object({
    createdBy: z.string(),
    createdAt: z.string(),
    modifiedBy: z.string().optional(),
    modifiedAt: z.string().optional(),
    officeId: z.string().optional(),
    departmentId: z.string().optional(),
    clientId: z.string().optional(),
    approvalFlow: z.enum(['parallel', 'consecutive']).optional(),
    validators: z.array(z.string()).optional().default([]),
    signers: z.array(z.string()).optional().default([]),
    deadline: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).default('low'),
    isLocked: z.boolean().default(false),
    lockedBy: z.string().optional(),
    lockedAt: z.string().optional(),
    version: z.number().default(1),
    parentDocumentId: z.string().optional(),
  }),
  permissions: z.object({
    owners: z.array(z.string()).default([]),
    viewers: z.array(z.string()).default([]),
    editors: z.array(z.string()).default([]),
    approvers: z.array(z.string()).default([]),
  }).default({ owners: [], viewers: [], editors: [], approvers: [] }),
});

app.http('getDocuments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'documents',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const container = getContainer('documents');
    const status = req.query.get('status');
    const tenantId = req.query.get('tenantId');
    const query = {
      query: `SELECT * FROM c WHERE (${tenantId ? 'c.partitionKey = @tenantId' : '1=1'}) ${status ? ' AND c.status = @status' : ''} ORDER BY c.metadata.createdAt DESC`,
      parameters: [
        ...(tenantId ? [{ name: '@tenantId', value: tenantId }] : []),
        ...(status ? [{ name: '@status', value: status }] : []),
      ],
    };
    const { resources } = await container.items.query(query).fetchAll();
    return { status: 200, body: JSON.stringify(resources) };
  },
});

app.http('getDocumentById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'documents/{id}',
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    const container = getContainer('documents');
    const id = req.params.get('id')!;
    const pk = req.query.get('pk')!;
    const { resource } = await container.item(id, pk).read();
    if (!resource) return { status: 404, body: JSON.stringify({ error: 'Not found' }) };
    return { status: 200, body: JSON.stringify(resource) };
  },
});

app.http('createDocument', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'documents',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const container = getContainer('documents');
    const body = await req.json();
    const parsed = DocumentSchema.safeParse(body);
    if (!parsed.success) return { status: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };
    const { resource } = await container.items.create(parsed.data);
    return { status: 201, body: JSON.stringify(resource) };
  },
});

app.http('updateDocument', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'documents/{id}',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const container = getContainer('documents');
    const id = req.params.get('id')!;
    const pk = (await req.json()).partitionKey;
    const existing = await container.item(id, pk).read();
    if (!existing.resource) return { status: 404, body: JSON.stringify({ error: 'Not found' }) };
    const updates = await req.json();
    const { resource } = await container.item(id, pk).replace({ ...existing.resource, ...updates });
    return { status: 200, body: JSON.stringify(resource) };
  },
});

app.http('deleteDocument', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'documents/{id}',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const container = getContainer('documents');
    const id = req.params.get('id')!;
    const pk = req.query.get('pk')!;
    await container.item(id, pk).delete();
    return { status: 204 };
  },
});



