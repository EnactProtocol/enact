-- Migration: Add checksum_manifest column to attestations table
-- This stores the checksum manifest that was signed for manifest-based attestations

ALTER TABLE public.attestations
ADD COLUMN checksum_manifest JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN public.attestations.checksum_manifest IS 'The checksum manifest that was signed (for manifest-based attestations). Contains file checksums and the manifest hash that was signed.';
