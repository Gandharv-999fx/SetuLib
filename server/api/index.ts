// Vercel serverless entry point — all routes rewrote here
import { connectDB } from '../src/db';
import app from '../src/app';

export default async function handler(req: any, res: any) {
  await connectDB();
  return app(req, res);
}
