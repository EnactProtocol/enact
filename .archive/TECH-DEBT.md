# Technical Debt & Future Improvements

## @enactprotocol/sigstore-* Packages (HIGH PRIORITY)

**Issue**: We forked the official `@sigstore/*` packages to create `@enactprotocol/sigstore-*` versions with BoringSSL compatibility patches built-in.

**Why**: Bun uses BoringSSL instead of OpenSSL. BoringSSL requires explicit `sha256` algorithm in `crypto.sign()` calls, while Node.js/OpenSSL accepts `null`. The official sigstore packages don't support Bun.

**Packages published to npm**:
- `@enactprotocol/sigstore-core@3.0.1`
- `@enactprotocol/sigstore-bundle@4.0.1`
- `@enactprotocol/sigstore-sign@4.0.2` (main package with BoringSSL fixes)
- `@enactprotocol/sigstore-verify@3.0.1`
- `@enactprotocol/sigstore@4.0.1`
- `@enactprotocol/sigstore-tuf@4.0.1`

**Source**: https://github.com/EnactProtocol/sigstore-js (fork of sigstore/sigstore-js)

**When to remove**: 
1. When official `@sigstore/*` packages add Bun/BoringSSL support, OR
2. When Bun switches to OpenSSL, OR
3. If we move away from Bun to Node.js

**To remove**:
1. Update `packages/trust/package.json` to use official `@sigstore/*` packages
2. Remove overrides from root `package.json`
3. Test signing works with compiled binaries
4. Deprecate `@enactprotocol/sigstore-*` packages on npm

---

## Bun Version Pinned to 1.2.18

**Issue**: CI workflows pin Bun to 1.2.18 instead of `latest`.

**Why**: Bun 1.3.x has bundler changes that cause sigstore package resolution issues in compiled binaries. The binary size differs (~660KB larger) and signing fails despite correct packages being installed.

**Location**: 
- `.github/workflows/release.yml`
- `.github/workflows/build-binaries.yml`

**When to update**:
- Test with newer Bun versions periodically
- May be related to these 1.3.x breaking changes:
  - `require('./file.unknown-extension')` loader behavior change
  - Namespace imports no longer inherit from Object.prototype
  - TypeScript module resolution changes

---

## Tracking

| Issue | Status | Added | Resolved |
|-------|--------|-------|----------|
| @enactprotocol/sigstore-* fork | Active | 2024-12-16 | - |
| Bun 1.2.18 pin | Active | 2024-12-16 | - |
