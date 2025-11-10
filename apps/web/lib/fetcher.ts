// apps/web/lib/fetcher.ts

import axios from "axios";

// This line correctly checks for the environment variable first.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export const fetcher = (url: string) =>
  axios.get(`${API_BASE_URL}${url}`).then((res) => res.data);

// You will need a similar setup for your Vanna AI calls
const VANNA_API_BASE_URL = process.env.NEXT_PUBLIC_VANNA_AI_URL || "http://localhost:8000";

// Example function for chatting
export const postToVanna = (message: string) =>
  axios.post(`${VANNA_API_BASE_URL}/chat`, { message }).then((res) => res.data);
