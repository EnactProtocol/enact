# Enact Registry Curation Strategy

## The Problem

As tool registries grow, they often suffer from fragmentation and discoverability issues. ComfyUI's node ecosystem is a cautionary example:

- **50+ nodes that do the same thing** with slight variations
- **Inconsistent quality** - some well-documented, others abandoned
- **Discovery nightmare** - users spend more time finding tools than using them
- **Maintenance burden** - duplicates means fragmented bug fixes and improvements

We want Enact to avoid this fate while remaining open and accessible.

---

## Design Principles

1. **Open publishing** - Anyone can contribute (low barrier to entry)
2. **Quality signals** - Help users find the best tools
3. **Namespace ownership** - Clear attribution and accountability
4. **Deprecation paths** - Tools can be superseded gracefully

---

## Curation Mechanisms

### 1. Namespacing (Built-in)

Every tool is scoped: `author/category/tool-name`

```
alice/images/resizer      # Alice's image resizer
bob/images/resizer        # Bob's image resizer
enact/images/resizer      # Official Enact image resizer
```

**Benefits:**
- Clear ownership and accountability
- Users can follow trusted authors
- No name squatting on generic terms

**Implementation:** Already implemented in v2.0.

---

### 2. Verified Publishers

Badge system for trusted tool authors.

| Badge | Criteria | Display |
|-------|----------|---------|
| **Verified** | Email confirmed, signed tools | ✓ checkmark |
| **Trusted** | 3+ published tools, positive reviews | ⭐ star |
| **Official** | Enact team or partner orgs | 🔷 diamond |

**Benefits:**
- Quick trust signal for users
- Incentivizes quality (authors want badges)
- Doesn't block publishing (anyone can still publish)

**Implementation:** Add `publisher_status` field to registry accounts.

---

### 3. Community Signals

Let usage and feedback surface quality.

| Signal | Description | Weight |
|--------|-------------|--------|
| **Downloads** | Total and recent (30-day) | High |
| **Stars** | User favorites | Medium |
| **Forks** | Tools built on this one | Medium |
| **Reports** | Security/quality issues | Negative |
| **Last Updated** | Maintenance activity | Tiebreaker |

**Search ranking formula:**
```
score = (downloads_30d * 2) + (stars * 1.5) + (forks * 1)
        - (reports * 10) + recency_bonus
```

**Benefits:**
- Organic curation by community
- Popular tools rise naturally
- Abandoned tools sink

**Implementation:** Track metrics in registry, expose in search API.

---

### 4. Curated Collections

Human-curated "best of" lists alongside open registry.

```
enact collections list
enact collections show "image-processing"
```

**Collection types:**
- **Official** - Enact team picks (e.g., "Getting Started", "Essential Tools")
- **Community** - User-created collections (e.g., "ML Pipeline Tools")
- **Sponsored** - Partner/company collections (e.g., "Anthropic's Claude Tools")

**Benefits:**
- Editorial quality control where it matters
- Doesn't restrict open publishing
- Good onboarding experience for new users

**Implementation:** `collections` table with `tool_ids[]` array.

---

### 5. Canonical/Supersedes System

Allow tools to declare relationships.

```yaml
# In enact.md
supersedes: "oldauthor/category/deprecated-tool"
canonical: true  # This is THE image resizer
```

**Relationship types:**
- `supersedes` - This tool replaces another (with author consent or abandon criteria)
- `fork_of` - Derived from another tool
- `alternative_to` - Similar functionality, different approach
- `canonical` - Nominated as the "official" solution (requires community vote or Enact team approval)

**Benefits:**
- Graceful deprecation path
- Consolidation without deletion
- Clear lineage for forks

**Implementation:** `tool_relationships` table.

---

### 6. Quality Gates (Optional Tiers)

Different listing tiers with different requirements.

| Tier | Requirements | Visibility |
|------|--------------|------------|
| **Published** | Valid manifest, signed | Listed, searchable |
| **Reviewed** | + Passes automated checks | Boosted in search |
| **Featured** | + Manual review, high quality | Homepage, collections |

**Automated checks:**
- [ ] Has description (>20 chars)
- [ ] Has inputSchema defined
- [ ] Has outputSchema defined
- [ ] Includes example usage
- [ ] Builds successfully
- [ ] Outputs valid JSON
- [ ] No security warnings
- [ ] License specified

**Benefits:**
- Low barrier for experimentation
- Quality incentives for serious tools
- Featured tools are vetted

**Implementation:** `quality_tier` enum on tools table.

---

### 7. Duplicate Detection

Warn publishers when similar tools exist.

```
$ enact publish .

⚠️  Similar tools already exist:
   - alice/images/resizer (⭐ 234, "Resizes images using PIL")
   - enact/images/resize (⭐ 1.2k, "Official image resizer")

Your tool: bob/images/resizer ("Resize images with ImageMagick")

This appears to offer similar functionality. Consider:
   1. Publishing anyway (your approach may be better!)
   2. Contributing to an existing tool
   3. Clearly differentiating in your description

Publish anyway? [y/N]
```

**Detection methods:**
- Name similarity (fuzzy match on tool name)
- Description similarity (embedding/keyword match)
- Input/output schema similarity
- Tag overlap

**Benefits:**
- Surfaces alternatives before publishing
- Encourages contribution over duplication
- Doesn't block, just informs

**Implementation:** Pre-publish hook with similarity search.

---

## Comparison of Approaches

| Approach | Openness | Quality | Complexity | Recommended |
|----------|----------|---------|------------|-------------|
| **Fully open** (npm model) | ⭐⭐⭐ | ⭐ | ⭐ | For launch |
| **Curated only** (App Store model) | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | No |
| **Hybrid** (proposed) | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | **Yes** |

---

## Recommended Implementation Order

### Phase 1: Launch (Now)
- [x] Namespacing
- [x] Basic search
- [ ] Download counts
- [ ] Verified publisher badges

### Phase 2: Growth (3 months)
- [ ] Star/favorite system
- [ ] Quality score in search ranking
- [ ] Automated quality checks
- [ ] Duplicate detection warnings

### Phase 3: Scale (6 months)
- [ ] Curated collections
- [ ] Canonical/supersedes system
- [ ] Community-nominated "official" tools
- [ ] Advanced search filters

### Phase 4: Ecosystem (12 months)
- [ ] Tool relationships graph
- [ ] Deprecation workflows
- [ ] Publisher analytics dashboard
- [ ] API for third-party curation tools

---

## Database Schema Additions

```sql
-- Publisher verification
ALTER TABLE publishers ADD COLUMN status TEXT DEFAULT 'unverified';
-- Values: 'unverified', 'verified', 'trusted', 'official'

-- Tool metrics
CREATE TABLE tool_metrics (
  tool_id UUID PRIMARY KEY REFERENCES tools(id),
  downloads_total BIGINT DEFAULT 0,
  downloads_30d INT DEFAULT 0,
  stars INT DEFAULT 0,
  forks INT DEFAULT 0,
  reports INT DEFAULT 0,
  quality_score FLOAT DEFAULT 0,
  quality_tier TEXT DEFAULT 'published',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool relationships
CREATE TABLE tool_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_tool_id UUID REFERENCES tools(id),
  target_tool_id UUID REFERENCES tools(id),
  relationship TEXT NOT NULL,
  -- Values: 'supersedes', 'fork_of', 'alternative_to', 'canonical'
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'community',
  -- Values: 'official', 'community', 'sponsored'
  curator_id UUID REFERENCES publishers(id),
  tool_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User favorites
CREATE TABLE favorites (
  user_id UUID REFERENCES publishers(id),
  tool_id UUID REFERENCES tools(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tool_id)
);
```

---

## CLI Commands

```bash
# Search with quality filters
enact search "image resize" --min-stars 10 --verified-only

# View tool details with metrics
enact info alice/images/resizer
# Shows: description, downloads, stars, quality tier, alternatives

# Star a tool
enact star alice/images/resizer

# Browse collections
enact collections list
enact collections show "getting-started"

# Report a tool
enact report alice/images/resizer --reason "malicious"

# Check for similar tools before publishing
enact check-duplicates .
```

---

## Open Questions

1. **Who approves "canonical" status?**
   - Option A: Enact team only
   - Option B: Community vote (>N stars + maintainer approval)
   - Option C: Category maintainers (volunteer curators)

2. **How to handle abandoned tools?**
   - Option A: Auto-archive after N months of inactivity
   - Option B: Allow takeover requests
   - Option C: Just lower in search ranking

3. **Should duplicate detection block publishing?**
   - Recommendation: No, just warn. False positives would frustrate users.

4. **Monetization of featured placement?**
   - Could be revenue source, but risks trust
   - Recommendation: Keep featured = quality, add separate "sponsored" section

---

## Summary

The goal is **open publishing with quality signals** - anyone can publish, but the best tools surface naturally through community feedback, automated checks, and light curation.

This avoids the ComfyUI problem (chaos) while staying more open than the App Store model (gatekeeping).

Key insight: **Curation happens at discovery time, not publish time.** Let people publish freely, but make sure users find the good stuff.
