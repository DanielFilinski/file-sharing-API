import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { getSql, sql } from '../shared/db/sql';

app.http('syncAzureAdUsers', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users/sync-azure-ad',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const body = await req.json().catch(() => ({}));
    const users: any[] = body.users ?? [];
    const pool = await getSql();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const u of users) {
        await new sql.Request(transaction)
          .input('azureId', sql.NVarChar(255), u.id)
          .input('displayName', sql.NVarChar(200), u.displayName ?? null)
          .input('mail', sql.NVarChar(255), u.mail ?? u.userPrincipalName ?? null)
          .query(`MERGE AzureAdCache AS target
                  USING (SELECT @azureId AS AzureAdUserId) AS src
                  ON target.AzureAdUserId = src.AzureAdUserId
                  WHEN MATCHED THEN UPDATE SET DisplayName = @displayName, Email = @mail, LastSyncAt = GETDATE()
                  WHEN NOT MATCHED THEN INSERT (Id, OrganizationId, AzureAdUserId, DisplayName, Email) VALUES (NEWID(), (SELECT TOP 1 Id FROM Organizations), @azureId, @displayName, @mail);`);
      }
      await transaction.commit();
      return { status: 200, body: JSON.stringify({ updated: users.length }) };
    } catch (e) {
      await transaction.rollback();
      return { status: 500, body: JSON.stringify({ error: 'Sync failed' }) };
    }
  },
});



