/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  // Add other environment variables here as needed
}

// Extend the existing ImportMeta interface
interface ImportMeta {
  readonly env: ImportMetaEnv
}