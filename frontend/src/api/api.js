// frontend/src/api/api.js
import axios from "axios";

/**
 * Create base URL that always ends with /api
 * If VITE_API_URL is set to "http://localhost:4000" -> becomes "http://localhost:4000/api"
 * If VITE_API_URL already contains /api, keep it.
 */
const rawBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const normalizedBase =
  rawBase.endsWith("/api") ? rawBase : `${rawBase.replace(/\/$/, "")}/api`;

const API = axios.create({
  baseURL: normalizedBase,
});

// helper for auth headers
export function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export default API;
