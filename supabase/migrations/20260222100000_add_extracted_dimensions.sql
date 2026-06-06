-- Add extracted_dimensions column to generated_floorplans table
-- Stores Gemini Flash extracted dimension data as JSONB
ALTER TABLE generated_floorplans
  ADD COLUMN IF NOT EXISTS extracted_dimensions JSONB;
