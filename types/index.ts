export interface Company {
  id: string;
  name: string;
  address: string;
  country: string;
  phone: string;
  logo_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_id: string | null;
  role: 'admin' | 'employee' | 'superadmin' | 'sloan_admin' | 'signmaker' | 'installer' | 'customer';
  full_name: string;
  avatar_url: string;
  language: string;
  phone: string;
  created_at: string;
  updated_at: string;
  companies?: Company;
}

export interface ProjectPhoto {
  id: string;
  project_id: string;
  uploaded_by: string;
  url: string;
  caption: string;
  created_at: string;
}

export interface ProjectStatusHistory {
  id: string;
  project_id: string;
  changed_by: string;
  old_status: string | null;
  new_status: string;
  notes: string;
  created_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'installed' | 'completed' | 'cancelled';
  gps_lat: number | null;
  gps_lng: number | null;
  location_address: string;
  notes: string;
  installed_at: string | null;
  created_at: string;
  updated_at: string;
  project_photos?: ProjectPhoto[];
  project_status_history?: ProjectStatusHistory[];
  created_by_profile?: { id: string; full_name: string; avatar_url: string };
}

export interface Document {
  id: string;
  title: string;
  description: string;
  category: 'datasheet' | 'spec_sheet' | 'installation_guide' | 'general' | 'certificate';
  file_url: string;
  thumbnail_url: string;
  language: string;
  tags: string[];
  created_at: string;
}

export interface AiMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AiSession {
  id: string;
  user_id: string;
  voiceflow_session_id: string;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

export type Language = 'en' | 'de' | 'fr' | 'es' | 'nl';
