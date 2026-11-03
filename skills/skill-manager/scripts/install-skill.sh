#!/usr/bin/env bash
# Usage: install-skill.sh <skill-dir> <upstream-url> <license>
set -euo pipefail
d="${1:?dir}"; url="${2:?url}"; lic="${3:?license}"
"$(dirname "$0")/inspect-skill.sh" "$d"
printf '# Source\n- Upstream: %s\n- License: %s\n- Installed by skill-manager after manual inspection. Attribution retained.\n' "$url" "$lic" > "$d/SOURCE.md"
~/skills-repo/scripts/publish-skill.sh "$d"
