import { CosmosClient, Container, Database } from '@azure/cosmos';

type Containers = 'documents' | 'chat-messages' | 'audit-events' | 'user-favorites' | 'document-versions';

let client: CosmosClient | null = null;
let database: Database | null = null;
const containerCache: Map<Containers, Container> = new Map();

export function initCosmos(): void {
  if (client) return;
  const connectionString = process.env.COSMOSDB_CONNECTION_STRING as string;
  const databaseName = process.env.COSMOSDB_DATABASE_NAME as string;
  client = new CosmosClient(connectionString);
  database = client.database(databaseName);
}

export function getContainer(name: Containers): Container {
  if (!client || !database) initCosmos();
  if (containerCache.has(name)) return containerCache.get(name)!;
  const container = database!.container(name);
  containerCache.set(name, container);
  return container;
}



