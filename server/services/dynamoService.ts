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
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const DYNAMO_REGION = "ap-south-1";
const KHET_SATHI_USERS_TABLE = "KhetSathiUsers";
const USERCASES_TABLE = "usercases";
const CHATSUMMARY_TABLE = "chatsummary";

const client = new DynamoDBClient({
  region: DYNAMO_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

let khetSathiUsersTableReady = false;
let usercasesTableReady = false;
let chatsummaryTableReady = false;

async function ensureTable(tableName: string, setReady: (val: boolean) => void): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    setReady(true);
  } catch (err: any) {
    if (err instanceof ResourceNotFoundException || err.name === "ResourceNotFoundException") {
      if (tableName === KHET_SATHI_USERS_TABLE) {
        await client.send(
          new CreateTableCommand({
            TableName: tableName,
            KeySchema: [{ AttributeName: "phone", KeyType: "HASH" }],
            AttributeDefinitions: [{ AttributeName: "phone", AttributeType: "S" }],
            BillingMode: "PAY_PER_REQUEST",
          })
        );
      } else if (tableName === USERCASES_TABLE || tableName === CHATSUMMARY_TABLE) {
        await client.send(
          new CreateTableCommand({
            TableName: tableName,
            KeySchema: [
              { AttributeName: "phone", KeyType: "HASH" },
              { AttributeName: "timestamp", KeyType: "RANGE" },
            ],
            AttributeDefinitions: [
              { AttributeName: "phone", AttributeType: "S" },
              { AttributeName: "timestamp", AttributeType: "S" },
            ],
            BillingMode: "PAY_PER_REQUEST",
          })
        );
      }

      let status = "CREATING";
      while (status === "CREATING") {
        await new Promise((r) => setTimeout(r, 1000));
        const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
        status = desc.Table?.TableStatus || "CREATING";
      }

      setReady(true);
    } else {
      throw err;
    }
  }
}

async function ensureKhetSathiUsersTable(): Promise<void> {
  if (khetSathiUsersTableReady) return;
  await ensureTable(KHET_SATHI_USERS_TABLE, (val) => {
    khetSathiUsersTableReady = val;
  });
}

async function ensureUsercasesTable(): Promise<void> {
  if (usercasesTableReady) return;
  await ensureTable(USERCASES_TABLE, (val) => {
    usercasesTableReady = val;
  });
}

export interface DynamoUser {
  phone: string;
  language?: string;
  createdAt: string;
}

export interface UserCaseData {
  phone: string;
  timestamp: string;
  conversationSummary: string;
  diagnosis?: Record<string, any>;
  treatmentPlan?: string;
  language?: string;
  imageUrls?: string[];
}

export async function saveUserToDynamo(phone: string, language?: string): Promise<DynamoUser> {
  await ensureKhetSathiUsersTable();

  const existing = await getUserFromDynamo(phone);

  if (existing) {
    if (language && language !== existing.language) {
      await docClient.send(
        new UpdateCommand({
          TableName: KHET_SATHI_USERS_TABLE,
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
      TableName: KHET_SATHI_USERS_TABLE,
      Item: user,
    })
  );

  return user;
}

export async function getUserFromDynamo(phone: string): Promise<DynamoUser | undefined> {
  await ensureKhetSathiUsersTable();

  const result = await docClient.send(
    new GetCommand({
      TableName: KHET_SATHI_USERS_TABLE,
      Key: { phone },
    })
  );

  return result.Item as DynamoUser | undefined;
}

export async function saveUserCase(data: UserCaseData): Promise<UserCaseData> {
  await ensureUsercasesTable();

  const caseData: UserCaseData = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: USERCASES_TABLE,
      Item: caseData,
    })
  );

  return caseData;
}

export async function getUserCases(phone: string): Promise<UserCaseData[]> {
  await ensureUsercasesTable();

  const result = await docClient.send(
    new QueryCommand({
      TableName: USERCASES_TABLE,
      KeyConditionExpression: "phone = :phone",
      ExpressionAttributeValues: {
        ":phone": phone,
      },
    })
  );

  return (result.Items as UserCaseData[]) || [];
}

async function ensureChatsummaryTable(): Promise<void> {
  if (chatsummaryTableReady) return;
  await ensureTable(CHATSUMMARY_TABLE, (val) => {
    chatsummaryTableReady = val;
  });
}

export interface ChatSummaryData {
  phone: string;
  timestamp: string;
  conversationSummary: string;
  pdfUrl: string;
  language?: string;
  diagnosis?: Record<string, any>;
  imageUrls?: string[];
}

export async function saveChatSummary(data: ChatSummaryData): Promise<ChatSummaryData> {
  await ensureChatsummaryTable();

  const summaryData: ChatSummaryData = {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: CHATSUMMARY_TABLE,
      Item: summaryData,
    })
  );

  return summaryData;
}

export async function getChatSummaries(phone: string): Promise<ChatSummaryData[]> {
  await ensureChatsummaryTable();

  const result = await docClient.send(
    new QueryCommand({
      TableName: CHATSUMMARY_TABLE,
      KeyConditionExpression: "phone = :phone",
      ExpressionAttributeValues: {
        ":phone": phone,
      },
    })
  );

  return (result.Items as ChatSummaryData[]) || [];
}
