import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const DYNAMO_REGION = "ap-south-1";
const TABLE_NAME = "KhetSathiUsers";

const client = new DynamoDBClient({
  region: DYNAMO_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;

  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    tableReady = true;
  } catch (err: any) {
    if (err instanceof ResourceNotFoundException || err.name === "ResourceNotFoundException") {
      await client.send(
        new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [{ AttributeName: "phone", KeyType: "HASH" }],
          AttributeDefinitions: [{ AttributeName: "phone", AttributeType: "S" }],
          BillingMode: "PAY_PER_REQUEST",
        })
      );

      let status = "CREATING";
      while (status === "CREATING") {
        await new Promise((r) => setTimeout(r, 1000));
        const desc = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
        status = desc.Table?.TableStatus || "CREATING";
      }

      tableReady = true;
    } else {
      throw err;
    }
  }
}

export interface DynamoUser {
  phone: string;
  language?: string;
  createdAt: string;
}

export async function saveUserToDynamo(phone: string, language?: string): Promise<DynamoUser> {
  await ensureTable();

  const existing = await getUserFromDynamo(phone);

  if (existing) {
    if (language && language !== existing.language) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { phone },
          UpdateExpression: "SET #lang = :lang",
          ExpressionAttributeNames: { "#lang": "language" },
          ExpressionAttributeValues: { ":lang": language },
        })
      );
      return { ...existing, language };
    }
    return existing;
  }

  const user: DynamoUser = {
    phone,
    language: language || "English",
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: user,
    })
  );

  return user;
}

export async function getUserFromDynamo(phone: string): Promise<DynamoUser | undefined> {
  await ensureTable();

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { phone },
    })
  );

  return result.Item as DynamoUser | undefined;
}
