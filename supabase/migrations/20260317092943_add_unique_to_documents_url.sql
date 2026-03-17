-- Add unique constraint to file_url in documents table to prevent duplicates during sync
-- Created on: 2026-03-17

ALTER TABLE documents ADD CONSTRAINT documents_file_url_key UNIQUE (file_url);
