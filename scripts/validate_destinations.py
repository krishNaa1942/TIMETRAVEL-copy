"""Validate india_destinations.json integrity."""
import json
from collections import Counter

d = json.load(open("data/india_destinations.json"))
dests = d["destinations"]

# Count
print(f"Metadata total: {d['metadata']['total_destinations']}")
print(f"Actual count:   {len(dests)}")
print()

# Duplicates
ids = [x["id"] for x in dests]
names = [x["name"] for x in dests]
dup_ids = set(i for i in ids if ids.count(i) > 1)
dup_names = set(n for n in names if names.count(n) > 1)
print(f"Duplicate IDs:   {dup_ids or 'None'}")
print(f"Duplicate names: {dup_names or 'None'}")
print()

# Coverage
states = sorted(set(x["state"] for x in dests))
regions = sorted(set(x["region"] for x in dests))
cats = set()
for x in dests:
    cats.update(x["category"])

print(f"States/UTs: {len(states)}")
print(f"Regions:    {regions}")
print(f"Categories: {sorted(cats)}")
print()

# Per-region count
rc = Counter(x["region"] for x in dests)
for r in sorted(rc):
    print(f"  {r:12s} {rc[r]:3d} destinations")
print()

# Schema validation
required = [
    "id", "name", "state", "region", "lat", "lng",
    "category", "best_months", "altitude_m", "highlights",
    "description", "nearest_airport", "languages",
]
issues = []
for x in dests:
    for k in required:
        if k not in x:
            issues.append(f"  {x['name']}: missing '{k}'")
print(f"Schema issues: {len(issues)}")
for iss in issues[:10]:
    print(iss)

# Sorted check
is_sorted = all(ids[i] <= ids[i+1] for i in range(len(ids)-1))
print(f"\nSorted by ID: {'Yes' if is_sorted else 'No'}")
print("\nAll states:", ", ".join(states))
