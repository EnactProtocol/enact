# Troubleshooting Guide

## Common Issues

### 1. ERR_BLOCKED_BY_CLIENT in Browser Console

**Symptom**: You see errors like:
```
Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
/@fs/Users/.../node_modules/...
```

**Cause**: Browser extensions (ad blockers, privacy tools) blocking requests to `node_modules`.

**Solution**:
- **Option 1**: Disable ad blocker/privacy extensions for `localhost:3000`
- **Option 2**: Add `localhost` to your extension's allowlist
- **Option 3**: Use incognito/private mode (extensions usually disabled)

**Note**: This is a false positive and doesn't affect functionality. The app should still work normally.

### 2. Dagger Import Errors

**Symptom**: Build errors related to `@dagger.io/dagger` or `unicorn-magic`

**Solution**: Already fixed in `vite.config.ts`:
```typescript
optimizeDeps: {
  exclude: ['@dagger.io/dagger'],
}
```

If you still see issues, clear Vite cache:
```bash
rm -rf node_modules/.vite
bun run dev
```

### 3. API Connection Issues

**Symptom**: Tools not loading, empty search results

**Cause**: Registry API not running or incorrect URL

**Solution**:
1. Check `.env` file has correct `VITE_API_URL`
2. Ensure local registry is running:
   ```bash
   # From project root
   supabase start
   supabase functions serve
   ```
3. Verify API URL in browser console (Network tab)

### 4. TypeScript Errors

**Symptom**: Type errors when running `bun run typecheck`

**Solution**:
```bash
# Rebuild API package types
cd ../api
bun run build

# Return to web package
cd ../web
bun run typecheck
```

### 5. Port Already in Use

**Symptom**:
```
Error: Port 3000 is already in use
```

**Solution**:
- **Option 1**: Kill existing process on port 3000
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```
- **Option 2**: Use different port
  ```bash
  # Edit vite.config.ts
  server: {
    port: 3001, // or any other port
  }
  ```

### 6. Workspace Dependency Issues

**Symptom**: `@enactprotocol/api` not found or version mismatch

**Solution**:
```bash
# From monorepo root
bun install
cd packages/web
bun install
```

## Development Tips

### Clear All Caches

If you encounter mysterious issues:

```bash
# From web package directory
rm -rf node_modules/.vite
rm -rf dist
bun install
bun run dev
```

### Check Dev Server Output

Always check the terminal where `bun run dev` is running for errors:

```bash
cd packages/web
bun run dev
# Watch for errors in output
```

### Browser DevTools

1. Open DevTools (F12 or Cmd+Option+I)
2. **Console**: Check for JavaScript errors
3. **Network**: Verify API requests are being made
4. **Elements**: Inspect rendered components

### Verify API Client

Test the API client in browser console:

```javascript
// Should be defined
console.log(window.__VITE_PRELOAD__);

// Test API (when on page)
import { apiClient } from '@/lib/api';
console.log(apiClient);
```

## Getting Help

If you're still experiencing issues:

1. **Check logs**: Terminal output from `bun run dev`
2. **Browser console**: F12 → Console tab
3. **Network tab**: F12 → Network tab to see failed requests
4. **File an issue**: Include error messages and steps to reproduce

## Environment Setup Checklist

- [ ] Node.js >= 20.0.0 installed
- [ ] Bun >= 1.0.0 installed
- [ ] Dependencies installed (`bun install` from root)
- [ ] `.env` file created from `.env.example`
- [ ] Local registry running (if testing with real data)
- [ ] No port conflicts (3000 available)
- [ ] Browser extensions disabled for localhost (if seeing errors)

## Quick Restart

When in doubt, restart everything:

```bash
# Kill dev server (Ctrl+C)

# From project root
bun install

# From web package
cd packages/web
rm -rf node_modules/.vite dist
bun run dev
```

Then open browser to http://localhost:3000 (or http://localhost:3001 if you changed the port).
