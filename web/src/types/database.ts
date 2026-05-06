// Hand-written types matching supabase/migrations/*.sql.
// Replace with `supabase gen types typescript` output once the CLI is wired up.

export type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "distributor_admin"
  | "distributor_user"
  | "signmaker"
  | "installer";

export type ProjectStatus =
  | "pending"
  | "in_progress"
  | "installed"
  | "completed"
  | "cancelled";

export interface Distributor {
  id: string;
  name: string;
  region: string;
  country: string;
  contact_email: string;
  contact_phone: string;
  logo_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  country: string;
  phone: string;
  logo_url: string;
  distributor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_id: string | null;
  distributor_id: string | null;
  role: Role;
  full_name: string;
  avatar_url: string;
  language: string;
  phone: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string;
  status: ProjectStatus;
  gps_lat: number | null;
  gps_lng: number | null;
  location_address: string;
  notes: string;
  installed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  thumbnail_url: string;
  language: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DocumentView {
  id: string;
  document_id: string;
  user_id: string;
  company_id: string | null;
  source: "mobile" | "web";
  viewed_at: string;
}

export interface AiRequestLog {
  id: string;
  user_id: string;
  company_id: string | null;
  session_id: string | null;
  intent: string;
  prompt_preview: string;
  created_at: string;
}
