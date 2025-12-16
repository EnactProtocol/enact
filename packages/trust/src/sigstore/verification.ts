/**
 * Sigstore verification module
 *
 * This module provides verification capabilities for Sigstore bundles and attestations.
 * It verifies signatures, certificates, and transparency log entries.
 *
 * NOTE: This implementation bypasses TUF (The Update Framework) and uses bundled trusted
 * roots directly. This is necessary for Bun compatibility because TUF verification fails
 * with BoringSSL's stricter signature algorithm requirements.
 */

import { bundleFromJSON } from "@enactprotocol/sigstore-bundle";
import { Verifier, toSignedEntity, toTrustMaterial } from "@enactprotocol/sigstore-verify";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { extractIdentityFromBundle } from "./signing";
import type {
  ExpectedIdentity,
  OIDCIdentity,
  SigstoreBundle,
  VerificationDetails,
  VerificationOptions,
  VerificationResult,
} from "./types";

// ============================================================================
// Embedded TUF Trusted Root
// ============================================================================

/**
 * Embedded TUF trusted_root.json (base64 encoded)
 *
 * This is embedded directly to ensure the binary works without external file access.
 * Bun's --compile doesn't bundle files accessed via require.resolve at runtime.
 *
 * Source: @enactprotocol/sigstore-tuf seeds.json -> targets["trusted_root.json"]
 * Last updated: 2025-12-16
 *
 * To update: Extract the base64 string from seeds.json at path:
 *   seeds["https://tuf-repo-cdn.sigstore.dev"].targets["trusted_root.json"]
 */
const EMBEDDED_TRUSTED_ROOT_B64 =
  "ewogICJtZWRpYVR5cGUiOiAiYXBwbGljYXRpb24vdm5kLmRldi5zaWdzdG9yZS50cnVzdGVkcm9vdCtqc29uO3ZlcnNpb249MC4xIiwKICAidGxvZ3MiOiBbCiAgICB7CiAgICAgICJiYXNlVXJsIjogImh0dHBzOi8vcmVrb3Iuc2lnc3RvcmUuZGV2IiwKICAgICAgImhhc2hBbGdvcml0aG0iOiAiU0hBMl8yNTYiLAogICAgICAicHVibGljS2V5IjogewogICAgICAgICJyYXdCeXRlcyI6ICJNRmt3RXdZSEtvWkl6ajBDQVFZSUtvWkl6ajBEQVFjRFFnQUUyRzJZKzJ0YWJkVFY1QmNHaUJJeDBhOWZBRndya0JibUxTR3RrczRMM3FYNnlZWTB6dWZCbmhDOFVyL2l5NTVHaFdQLzlBL2JZMkxoQzMwTTkrUll0dz09IiwKICAgICAgICAia2V5RGV0YWlscyI6ICJQS0lYX0VDRFNBX1AyNTZfU0hBXzI1NiIsCiAgICAgICAgInZhbGlkRm9yIjogewogICAgICAgICAgInN0YXJ0IjogIjIwMjEtMDEtMTJUMTE6NTM6MjdaIgogICAgICAgIH0KICAgICAgfSwKICAgICAgImxvZ0lkIjogewogICAgICAgICJrZXlJZCI6ICJ3Tkk5YXRRR2x6K1ZXZk82TFJ5Z0g0UVVmWS84VzRSRndpVDVpNVdSZ0IwPSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgImJhc2VVcmwiOiAiaHR0cHM6Ly9sb2cyMDI1LTEucmVrb3Iuc2lnc3RvcmUuZGV2IiwKICAgICAgImhhc2hBbGdvcml0aG0iOiAiU0hBMl8yNTYiLAogICAgICAicHVibGljS2V5IjogewogICAgICAgICJyYXdCeXRlcyI6ICJNQ293QlFZREsyVndBeUVBdDhybHAxa25Hd2pmYmNYQVlQWUFrbjBYaUx6MXg4TzR0MFlrRWhpZTI0ND0iLAogICAgICAgICJrZXlEZXRhaWxzIjogIlBLSVhfRUQyNTUxOSIsCiAgICAgICAgInZhbGlkRm9yIjogewogICAgICAgICAgInN0YXJ0IjogIjIwMjUtMDktMjNUMDA6MDA6MDBaIgogICAgICAgIH0KICAgICAgfSwKICAgICAgImxvZ0lkIjogewogICAgICAgICJrZXlJZCI6ICJ6eEdaRlZ2ZDBGRW1qUjhXckZ3TWRjQUo5dnRhWS9RWWY0NFkxd1VlUDZBPSIKICAgICAgfQogICAgfQogIF0sCiAgImNlcnRpZmljYXRlQXV0aG9yaXRpZXMiOiBbCiAgICB7CiAgICAgICJzdWJqZWN0IjogewogICAgICAgICJvcmdhbml6YXRpb24iOiAic2lnc3RvcmUuZGV2IiwKICAgICAgICAiY29tbW9uTmFtZSI6ICJzaWdzdG9yZSIKICAgICAgfSwKICAgICAgInVyaSI6ICJodHRwczovL2Z1bGNpby5zaWdzdG9yZS5kZXYiLAogICAgICAiY2VydENoYWluIjogewogICAgICAgICJjZXJ0aWZpY2F0ZXMiOiBbCiAgICAgICAgICB7CiAgICAgICAgICAgICJyYXdCeXRlcyI6ICJNSUlCK0RDQ0FYNmdBd0lCQWdJVE5Wa0Rab0Npb2ZQRHN5N2RmbTZnZUxidWh6QUtCZ2dxaGtqT1BRUURBekFxTVJVd0V3WURWUVFLRXd4emFXZHpkRzl5WlM1a1pYWXhFVEFQQmdOVkJBTVRDSE5wWjNOMGIzSmxNQjRYRFRJeE1ETXdOekF6TWpBeU9Wb1hEVE14TURJeU16QXpNakF5T1Zvd0tqRVZNQk1HQTFVRUNoTU1jMmxuYzNSdmNtVXVaR1YyTVJFd0R3WURWUVFERXdoemFXZHpkRzl5WlRCMk1CQUdCeXFHU000OUFnRUdCU3VCQkFBaUEySUFCTFN5QTdJaTVrK3BOTzhaRVdZMHlsZW1XRG93T2tOYTNrTCtHWkU1WjVHV2VoTDkvQTliUk5BM1JicnNaNWkwSmNhc3RhUkw3U3A1ZnAvakQ1ZHhxYy9VZFRWbmx2UzE2YW4rMllmc3dlL1F1TG9sUlVDcmNPRTIrMmlBNSt0emQ2Tm1NR1F3RGdZRFZSMFBBUUgvQkFRREFnRUdNQklHQTFVZEV3RUIvd1FJTUFZQkFmOENBUUV3SFFZRFZSME9CQllFRk1qRkhRQkJtaVFwTWxFazZ3MnVTdTFLQnRQc01COEdBMVVkSXdRWU1CYUFGTWpGSFFCQm1pUXBNbEVrNncydVN1MUtCdFBzTUFvR0NDcUdTTTQ5QkFNREEyZ0FNR1VDTUg4bGlXSmZNdWk2dlhYQmhqRGdZNE13c2xtTi9USnhWZS84M1dyRm9td21OZjA1NnkxWDQ4RjljNG0zYTNvelhBSXhBS2pSYXk1L2FqL2pzS0tHSWttUWF0akk4dXVwSHIvK0N4RnZhSldtcFlxTmtMREdSVSs5b3J6aDVoSTJScmN1YVE9PSIKICAgICAgICAgIH0KICAgICAgICBdCiAgICAgIH0sCiAgICAgICJ2YWxpZEZvciI6IHsKICAgICAgICAic3RhcnQiOiAiMjAyMS0wMy0wN1QwMzoyMDoyOVoiLAogICAgICAgICJlbmQiOiAiMjAyMi0xMi0zMVQyMzo1OTo1OS45OTlaIgogICAgICB9CiAgICB9LAogICAgewogICAgICAic3ViamVjdCI6IHsKICAgICAgICAib3JnYW5pemF0aW9uIjogInNpZ3N0b3JlLmRldiIsCiAgICAgICAgImNvbW1vbk5hbWUiOiAic2lnc3RvcmUiCiAgICAgIH0sCiAgICAgICJ1cmkiOiAiaHR0cHM6Ly9mdWxjaW8uc2lnc3RvcmUuZGV2IiwKICAgICAgImNlcnRDaGFpbiI6IHsKICAgICAgICAiY2VydGlmaWNhdGVzIjogWwogICAgICAgICAgewogICAgICAgICAgICAicmF3Qnl0ZXMiOiAiTUlJQ0dqQ0NBYUdnQXdJQkFnSVVBTG5WaVZmblUwYnJKYXNtUmtIcm4vVW5mYVF3Q2dZSUtvWkl6ajBFQXdNd0tqRVZNQk1HQTFVRUNoTU1jMmxuYzNSdmNtVXVaR1YyTVJFd0R3WURWUVFERXdoemFXZHpkRzl5WlRBZUZ3MHlNakEwTVRNeU1EQTJNVFZhRncwek1URXdNRFV4TXpVMk5UaGFNRGN4RlRBVEJnTlZCQW9UREhOcFozTjBiM0psTG1SbGRqRWVNQndHQTFVRUF4TVZjMmxuYzNSdmNtVXRhVzUwWlhKdFpXUnBZWFJsTUhZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUNJRFlnQUU4UlZTL3lzSCtOT3Z1RFp5UEladGlsZ1VGOU5sYXJZcEFkOUhQMXZCQkgxVTVDVjc3TFNTN3MwWmlING5FN0h2N3B0UzZMdnZSL1NUazc5OExWZ016TGxKNEhlSWZGM3RIU2FleExjWXBTQVNyMWtTME4vUmdCSnovOWpXQ2lYbm8zc3dlVEFPQmdOVkhROEJBZjhFQkFNQ0FRWXdFd1lEVlIwbEJBd3dDZ1lJS3dZQkJRVUhBd013RWdZRFZSMFRBUUgvQkFnd0JnRUIvd0lCQURBZEJnTlZIUTRFRmdRVTM5UHB6MVlrRVpiNXFOanBLRldpeGk0WVpEOHdId1lEVlIwakJCZ3dGb0FVV01BZVg1RkZwV2FwZXN5UW9aTWkwQ3JGeGZvd0NnWUlLb1pJemowRUF3TURad0F3WkFJd1BDc1FLNERZaVpZRFBJYURpNUhGS25meFh4NkFTU1ZtRVJmc3luWUJpWDJYNlNKUm5aVTg0LzlEWmRuRnZ2eG1BakJPdDZRcEJsYzRKLzBEeHZrVENxcGNsdnppTDZCQ0NQbmpkbElCM1B1M0J4c1BteWdVWTdJaTJ6YmRDZGxpaW93PSIKICAgICAgICAgIH0sCiAgICAgICAgICB7CiAgICAgICAgICAgICJyYXdCeXRlcyI6ICJNSUlCOXpDQ0FYeWdBd0lCQWdJVUFMWk5BUEZkeEhQd2plRGxvRHd5WUNoQU8vNHdDZ1lJS29aSXpqMEVBd013S2pFVk1CTUdBMVVFQ2hNTWMybG5jM1J2Y21VdVpHVjJNUkV3RHdZRFZRUURFd2h6YVdkemRHOXlaVEFlRncweU1URXdNRGN4TXpVMk5UbGFGdzB6TVRFd01EVXhNelUyTlRoYU1Db3hGVEFUQmdOVkJBb1RESE5wWjNOMGIzSmxMbVJsZGpFUk1BOEdBMVVFQXhNSWMybG5jM1J2Y21Vd2RqQVFCZ2NxaGtqT1BRSUJCZ1VyZ1FRQUlnTmlBQVQ3WGVGVDRyYjNQUUd3UzRJYWp0TGszL09sbnBnYW5nYUJjbFlwc1lCcjVpKzR5bkIwN2NlYjNMUDBPSU9aZHhleFg2OWM1aVZ1eUpSUStIejA1eWkrVUYzdUJXQWxIcGlTNXNoMCtIMkdIRTdTWHJrMUVDNW0xVHIxOUw5Z2c5MmpZekJoTUE0R0ExVWREd0VCL3dRRUF3SUJCakFQQmdOVkhSTUJBZjhFQlRBREFRSC9NQjBHQTFVZERnUVdCQlJZd0I1ZmtVV2xacWw2ekpDaGt5TFFLc1hGK2pBZkJnTlZIU01FR0RBV2dCUll3QjVma1VXbFpxbDZ6SkNoa3lMUUtzWEYrakFLQmdncWhrak9QUVFEQXdOcEFEQm1BakVBajFuSGVYWnArMTNOV0JOYStFRHNEUDhHMVdXZzF0Q01XUC9XSFBxcGFWbzBqaHN3ZU5GWmdTczBlRTd3WUk0cUFqRUEyV0I5b3Q5OHNJa29GM3ZaWWRkMy9WdFdCNWI5VE5NZWE3SXgvc3RKNVRmY0xMZUFCTEU0Qk5KT3NRNHZuQkhKIgogICAgICAgICAgfQogICAgICAgIF0KICAgICAgfSwKICAgICAgInZhbGlkRm9yIjogewogICAgICAgICJzdGFydCI6ICIyMDIyLTA0LTEzVDIwOjA2OjE1WiIKICAgICAgfQogICAgfQogIF0sCiAgImN0bG9ncyI6IFsKICAgIHsKICAgICAgImJhc2VVcmwiOiAiaHR0cHM6Ly9jdGZlLnNpZ3N0b3JlLmRldi90ZXN0IiwKICAgICAgImhhc2hBbGdvcml0aG0iOiAiU0hBMl8yNTYiLAogICAgICAicHVibGljS2V5IjogewogICAgICAgICJyYXdCeXRlcyI6ICJNRmt3RXdZSEtvWkl6ajBDQVFZSUtvWkl6ajBEQVFjRFFnQUViZndSK1JKdWRYc2NnUkJScEtYMVhGRHkzUHl1ZER4ei9TZm5SaTFmVDhla3BmQmQyTzF1b3o3anIzWjhuS3p4QTY5RVVRK2VGQ0ZJM3pldWJQV1U3dz09IiwKICAgICAgICAia2V5RGV0YWlscyI6ICJQS0lYX0VDRFNBX1AyNTZfU0hBXzI1NiIsCiAgICAgICAgInZhbGlkRm9yIjogewogICAgICAgICAgInN0YXJ0IjogIjIwMjEtMDMtMTRUMDA6MDA6MDBaIiwKICAgICAgICAgICJlbmQiOiAiMjAyMi0xMC0zMVQyMzo1OTo1OS45OTlaIgogICAgICAgIH0KICAgICAgfSwKICAgICAgImxvZ0lkIjogewogICAgICAgICJrZXlJZCI6ICJDR0NTOENoUy8yaEYwZEZySjRTY1JXY1lyQlk5d3pqU2JlYThJZ1kyYjNJPSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgImJhc2VVcmwiOiAiaHR0cHM6Ly9jdGZlLnNpZ3N0b3JlLmRldi8yMDIyIiwKICAgICAgImhhc2hBbGdvcml0aG0iOiAiU0hBMl8yNTYiLAogICAgICAicHVibGljS2V5IjogewogICAgICAgICJyYXdCeXRlcyI6ICJNRmt3RXdZSEtvWkl6ajBDQVFZSUtvWkl6ajBEQVFjRFFnQUVpUFNsRmkwQ21GVGZFakNVcUY5SHVDRWNZWE5LQWFZYWxJSm1CWjh5eWV6UGpUcWh4cktCcE1uYW9jVnRMSkJJMWVNM3VYblF6UUdBSmRKNGdzOUZ5dz09IiwKICAgICAgICAia2V5RGV0YWlscyI6ICJQS0lYX0VDRFNBX1AyNTZfU0hBXzI1NiIsCiAgICAgICAgInZhbGlkRm9yIjogewogICAgICAgICAgInN0YXJ0IjogIjIwMjItMTAtMjBUMDA6MDA6MDBaIgogICAgICAgIH0KICAgICAgfSwKICAgICAgImxvZ0lkIjogewogICAgICAgICJrZXlJZCI6ICIzVDB3YXNiSEVUSmpHUjRjbVdjM0FxSktYcmplUEszL2g0cHlnQzhwN280PSIKICAgICAgfQogICAgfQogIF0sCiAgInRpbWVzdGFtcEF1dGhvcml0aWVzIjogWwogICAgewogICAgICAic3ViamVjdCI6IHsKICAgICAgICAib3JnYW5pemF0aW9uIjogInNpZ3N0b3JlLmRldiIsCiAgICAgICAgImNvbW1vbk5hbWUiOiAic2lnc3RvcmUtdHNhLXNlbGZzaWduZWQiCiAgICAgIH0sCiAgICAgICJ1cmkiOiAiaHR0cHM6Ly90aW1lc3RhbXAuc2lnc3RvcmUuZGV2L2FwaS92MS90aW1lc3RhbXAiLAogICAgICAiY2VydENoYWluIjogewogICAgICAgICJjZXJ0aWZpY2F0ZXMiOiBbCiAgICAgICAgICB7CiAgICAgICAgICAgICJyYXdCeXRlcyI6ICJNSUlDRURDQ0FaYWdBd0lCQWdJVU9oTlVMd3lRWWU2OHdVTXZ5NHFPaXlvaml3d3dDZ1lJS29aSXpqMEVBd013T1RFVk1CTUdBMVVFQ2hNTWMybG5jM1J2Y21VdVpHVjJNU0F3SGdZRFZRUURFeGR6YVdkemRHOXlaUzEwYzJFdGMyVnNabk5wWjI1bFpEQWVGdzB5TlRBME1EZ3dOalU1TkROYUZ3MHpOVEEwTURZd05qVTVORE5hTUM0eEZUQVRCZ05WQkFvVERITnBaM04wYjNKbExtUmxkakVWTUJNR0ExVUVBeE1NYzJsbmMzUnZjbVV0ZEhOaE1IWXdFQVlIS29aSXpqMENBUVlGSzRFRUFDSURZZ0FFNHJhMlo4aEtOaWcyVDlrRmpDQVRvR0czMGpreStXUXYzQnpMK21LdmgxU0tOUi9Vd3V3c2ZOQ2c0c3J5b1lBZDhFNmlzb3ZWQTNNNGFvTmRtOVFEaTUwWjhuVEV5dnFnZkRQdFRJd1hJdGZpVy9BRmYxVjd1d2tia0FvajB4eGNvMm93YURBT0JnTlZIUThCQWY4RUJBTUNCNEF3SFFZRFZSME9CQllFRkluOWVVT0h6OUJsUnNNQ1JzY3NjMXQ5dE9zRE1COEdBMVVkSXdRWU1CYUFGSmpzQWU5L3UxSC8xSlVlYjRxSW1GTUhpYzYvTUJZR0ExVWRKUUVCL3dRTU1Bb0dDQ3NHQVFVRkJ3TUlNQW9HQ0NxR1NNNDlCQU1EQTJnQU1HVUNNRHRwc1YvNkthTzBxeUYvVU1zWDJhU1VYS1FGZG9HVHB0UUdjMGZ0cTFjc3VsSFBHRzZkc215TU5kM0pCK0czRVFJeEFPYWp2QmNqcEptS2I0TnYrMlRhb2o4VWM1K2I2aWg2RlhDQ0tyYVNxdXBlMDd6cXN3TWNYSlRlMWNFeHZIdnZsdz09IgogICAgICAgICAgfSwKICAgICAgICAgIHsKICAgICAgICAgICAgInJhd0J5dGVzIjogIk1JSUI5ekNDQVh5Z0F3SUJBZ0lVVjdmMEdMRE9vRXpJaDhMWFNXODBPSmlVcDE0d0NnWUlLb1pJemowRUF3TXdPVEVWTUJNR0ExVUVDaE1NY21sbmMzUnZjbVV1WkdWMk1TQXdIZ1lEVlFRREV4ZHphV2R6ZEc5eVpTMTBjMkV0YzJWc1puTnBaMjVsWkRBZUZ3MHlOVEEwTURnd05qVTVORE5hRncwek5UQTBNRFl3TmpVNU5ETmFNRGt4RlRBVEJnTlZCQW9UREhOcFozTjBiM0psTG1SbGRqRWdNQjRHQTFVRUF4TVhjMmxuYzNSdmNtVXRkSE5oTFhObGJHWnphV2R1WldRd2RqQVFCZ2NxaGtqT1BRSUJCZ1VyZ1FRQUlnTmlBQVFVUU50ZlJUL291M1lBVGE2d0Iva0tUZTcwY2ZKd3lSSUJvdk1udDhSY0pwaC9DT0U4MnV5UzZGbXBwTExMMVZCUEdjUGZwUVBZSk5Yeld3aThpY3doS1E2Vy9RZTJoM29lYkJiMkZIcHdOSkRxbytUTWFDL3RkZmt2L0VsSkI3MmpSVEJETUE0R0ExVWREd0VCL3dRRUF3SUJCakFTQmdOVkhSTUJBZjhFQ0RBR0FRSC9BZ0VBTUIwR0ExVWREZ1FXQkJTWTdBSHZmN3RSLzlTVkhtK0tpSmhUQjRuT3Z6QUtCZ2dxaGtqT1BRUURBd05wQURCbUFqRUF3R0VHcmZHWlIxY2VuMVI4L0RUVk1JOTQzTHNzWm1KUnREcC9pN1NmR0htR1JQNmdSYnVqOXZPSzNiNjdaMFFRQWpFQXVUMkg2NzNMUUVhSFRjeVFTWnJrcDRtWDdXd2ttRitzVmJrWVk1bVhOK1JNSDEzS1VFSEhPcUFTYWVtWVdLL0UiCiAgICAgICAgICB9CiAgICAgICAgXQogICAgICB9LAogICAgICAidmFsaWRGb3IiOiB7CiAgICAgICAgInN0YXJ0IjogIjIwMjUtMDctMDRUMDA6MDA6MDBaIgogICAgICB9CiAgICB9CiAgXQp9Cg==";

// ============================================================================
// Trusted Root Management
// ============================================================================

/**
 * Load the trusted root from embedded data
 * This works in both Node.js and Bun-compiled binaries
 */
async function loadTrustedRoot(): Promise<ReturnType<typeof TrustedRoot.fromJSON>> {
  const trustedRootJson = JSON.parse(Buffer.from(EMBEDDED_TRUSTED_ROOT_B64, "base64").toString());
  return TrustedRoot.fromJSON(trustedRootJson);
}

/**
 * Create trust material from the bundled trusted root
 */
async function createTrustMaterial() {
  const trustedRoot = await loadTrustedRoot();
  return toTrustMaterial(trustedRoot);
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify a Sigstore bundle
 *
 * @param bundle - The Sigstore bundle to verify
 * @param artifact - Optional artifact data (for message signature bundles)
 * @param options - Verification options
 * @returns Verification result with detailed checks
 *
 * @example
 * ```ts
 * const result = await verifyBundle(bundle, artifact, {
 *   expectedIdentity: {
 *     subjectAlternativeName: "user@example.com",
 *     issuer: "https://accounts.google.com"
 *   }
 * });
 * if (result.verified) {
 *   console.log("Bundle verified successfully");
 * }
 * ```
 */
export async function verifyBundle(
  bundle: SigstoreBundle,
  artifact?: Buffer,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const details: VerificationDetails = {
    signatureValid: false,
    certificateValid: false,
    certificateWithinValidity: false,
    rekorEntryValid: false,
    inclusionProofValid: false,
    errors: [],
  };

  try {
    // Create trust material from bundled roots
    const trustMaterial = await createTrustMaterial();

    // Create verifier
    const verifier = new Verifier(trustMaterial);

    // Convert bundle to proper format
    const parsedBundle = bundleFromJSON(bundle);
    const signedEntity = toSignedEntity(parsedBundle, artifact);

    // Perform verification
    verifier.verify(signedEntity);

    // If we get here, verification passed
    details.signatureValid = true;
    details.certificateValid = true;
    details.certificateWithinValidity = true;
    details.rekorEntryValid = true;
    details.inclusionProofValid = true;

    // Extract identity from bundle
    const identity = extractIdentityFromBundle(bundle);

    // Check identity if expected identity is provided
    if (options.expectedIdentity) {
      details.identityMatches = matchesExpectedIdentity(identity, options.expectedIdentity);
      if (!details.identityMatches) {
        details.errors.push("Identity does not match expected values");
        const result: VerificationResult = {
          verified: false,
          error: "Identity mismatch",
          details,
        };
        if (identity) result.identity = identity;
        const timestamp = extractTimestampFromBundle(bundle);
        if (timestamp) result.timestamp = timestamp;
        return result;
      }
    }

    const result: VerificationResult = {
      verified: true,
      details,
    };
    if (identity) result.identity = identity;
    const timestamp = extractTimestampFromBundle(bundle);
    if (timestamp) result.timestamp = timestamp;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    details.errors.push(errorMessage);

    // Try to determine which check failed based on error message
    categorizeVerificationError(errorMessage, details);

    return {
      verified: false,
      error: errorMessage,
      details,
    };
  }
}

/**
 * Create a reusable verifier for multiple verifications
 *
 * @param options - Verification options
 * @returns A verifier object that can verify multiple bundles
 *
 * @example
 * ```ts
 * const verifier = await createBundleVerifier({
 *   expectedIdentity: { issuer: "https://accounts.google.com" }
 * });
 *
 * // Verify multiple bundles efficiently
 * for (const bundle of bundles) {
 *   verifier.verify(bundle);
 * }
 * ```
 */
export async function createBundleVerifier(options: VerificationOptions = {}) {
  // Create trust material once and reuse
  const trustMaterial = await createTrustMaterial();
  const verifier = new Verifier(trustMaterial);

  return {
    /**
     * Verify a bundle using the cached verifier
     */
    verify: async (bundle: SigstoreBundle, artifact?: Buffer): Promise<VerificationResult> => {
      const details: VerificationDetails = {
        signatureValid: false,
        certificateValid: false,
        certificateWithinValidity: false,
        rekorEntryValid: false,
        inclusionProofValid: false,
        errors: [],
      };

      try {
        // Convert bundle to proper format
        const parsedBundle = bundleFromJSON(bundle);
        const signedEntity = toSignedEntity(parsedBundle, artifact);

        // Perform verification
        verifier.verify(signedEntity);

        details.signatureValid = true;
        details.certificateValid = true;
        details.certificateWithinValidity = true;
        details.rekorEntryValid = true;
        details.inclusionProofValid = true;

        const identity = extractIdentityFromBundle(bundle);

        if (options.expectedIdentity) {
          details.identityMatches = matchesExpectedIdentity(identity, options.expectedIdentity);
          if (!details.identityMatches) {
            details.errors.push("Identity does not match expected values");
            const result: VerificationResult = {
              verified: false,
              error: "Identity mismatch",
              details,
            };
            if (identity) result.identity = identity;
            const timestamp = extractTimestampFromBundle(bundle);
            if (timestamp) result.timestamp = timestamp;
            return result;
          }
        }

        const result: VerificationResult = {
          verified: true,
          details,
        };
        if (identity) result.identity = identity;
        const timestamp = extractTimestampFromBundle(bundle);
        if (timestamp) result.timestamp = timestamp;
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        details.errors.push(errorMessage);
        categorizeVerificationError(errorMessage, details);

        return {
          verified: false,
          error: errorMessage,
          details,
        };
      }
    },
  };
}

/**
 * Quick verification check - returns boolean only
 *
 * @param bundle - The Sigstore bundle to verify
 * @param artifact - Optional artifact data
 * @returns True if verification passes, false otherwise
 */
export async function isVerified(bundle: SigstoreBundle, artifact?: Buffer): Promise<boolean> {
  try {
    const trustMaterial = await createTrustMaterial();
    const verifier = new Verifier(trustMaterial);
    const parsedBundle = bundleFromJSON(bundle);
    const signedEntity = toSignedEntity(parsedBundle, artifact);
    verifier.verify(signedEntity);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an identity matches expected values
 */
function matchesExpectedIdentity(
  identity: OIDCIdentity | undefined,
  expected: ExpectedIdentity
): boolean {
  if (!identity) {
    return false;
  }

  // Check issuer
  if (expected.issuer && identity.issuer !== expected.issuer) {
    return false;
  }

  // Check subject alternative name (could be email or URI)
  if (expected.subjectAlternativeName) {
    const san = expected.subjectAlternativeName;
    if (identity.email !== san && identity.subject !== san) {
      return false;
    }
  }

  // Check GitHub workflow repository
  if (expected.workflowRepository && identity.workflowRepository !== expected.workflowRepository) {
    return false;
  }

  // Check GitHub workflow ref
  if (expected.workflowRef && identity.workflowRef !== expected.workflowRef) {
    return false;
  }

  return true;
}

/**
 * Extract timestamp from a Sigstore bundle
 */
function extractTimestampFromBundle(bundle: SigstoreBundle): Date | undefined {
  // Try to get timestamp from transparency log entry
  const tlogEntry = bundle.verificationMaterial?.tlogEntries?.[0];
  if (tlogEntry?.integratedTime) {
    const timestamp = Number.parseInt(tlogEntry.integratedTime, 10);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp * 1000);
    }
  }

  return undefined;
}

/**
 * Categorize a verification error to update details
 */
function categorizeVerificationError(errorMessage: string, details: VerificationDetails): void {
  const lowerError = errorMessage.toLowerCase();

  if (lowerError.includes("signature")) {
    details.signatureValid = false;
  } else if (lowerError.includes("certificate") && lowerError.includes("expired")) {
    details.certificateWithinValidity = false;
  } else if (lowerError.includes("certificate")) {
    details.certificateValid = false;
  } else if (lowerError.includes("rekor") || lowerError.includes("transparency")) {
    details.rekorEntryValid = false;
  } else if (lowerError.includes("inclusion") || lowerError.includes("proof")) {
    details.inclusionProofValid = false;
  }
}
