import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const data = await req.json()
  console.log('received', data);

  return Response.json({ lol: true })
}
