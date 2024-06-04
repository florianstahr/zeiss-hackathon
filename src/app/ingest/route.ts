import { NextRequest } from 'next/server';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGO_URI as string);

export async function POST(req: NextRequest) {
  const data = await req.json()
  // console.log('received', data);

  const db = client.db('zeiss_hackathon');

  await db.collection('data').insertOne(data);

  return Response.json({ lol: true });
}
