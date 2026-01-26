# Task #24: SemVer Pipeline Implementation

## Overview

Create a manual Azure DevOps pipeline for semantic versioning (SemVer) management. The pipeline allows selecting version bump type (major/minor/patch) and automatically updates package.json, creates git tags, and generates changelog.

## Task Requirements

### Acceptance Criteria
- [ ] Pipeline allows selecting version type (major/minor/patch)
- [ ] Version automatically updates in package.json
- [ ] Git tag created automatically
- [ ] CHANGELOG updated automatically

### Definition of Done
- [ ] Pipeline for major version increment
- [ ] Pipeline for minor version increment
- [ ] Pipeline for patch version increment
- [ ] Version saved in package.json
- [ ] Git tag created automatically

---

## Current State Analysis

### package.json
```json
{
  "name": "gdpr-backend",
  "version": "0.0.1",
  ...
}
```

### Existing Pipeline Structure
- `azure-pipelines.yml` - Main CI/CD pipeline with Build, DEV Deploy, PROD Deploy stages
- Parameters: `runProdOnly`, `enableRedis`
- Triggers on `main` branch

---

## Implementation Plan

### Step 1: Create Separate SemVer Pipeline

Create a new pipeline file `azure-pipelines-release.yml` dedicated to version management.

**Why separate pipeline?**
- Manual trigger only (no auto-trigger on commits)
- Different purpose than CI/CD
- Cleaner separation of concerns

### Step 2: Pipeline Parameters

```yaml
parameters:
  - name: versionBump
    displayName: 'Version Bump Type'
    type: string
    default: 'patch'
    values:
      - major
      - minor
      - patch
  
  - name: preRelease
    displayName: 'Pre-release tag (optional)'
    type: string
    default: ''
    values:
      - ''
      - alpha
      - beta
      - rc
```

### Step 3: Pipeline Stages

#### Stage 1: Calculate New Version
```yaml
- stage: CalculateVersion
  jobs:
    - job: GetVersion
      steps:
        - script: |
            CURRENT_VERSION=$(node -p "require('./package.json').version")
            echo "Current version: $CURRENT_VERSION"
            
            # Parse version components
            IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
            
            # Calculate new version based on bump type
            case "${{ parameters.versionBump }}" in
              major)
                NEW_VERSION="$((MAJOR + 1)).0.0"
                ;;
              minor)
                NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
                ;;
              patch)
                NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
                ;;
            esac
            
            # Add pre-release tag if specified
            if [ -n "${{ parameters.preRelease }}" ]; then
              NEW_VERSION="${NEW_VERSION}-${{ parameters.preRelease }}"
            fi
            
            echo "New version: $NEW_VERSION"
            echo "##vso[task.setvariable variable=newVersion;isOutput=true]$NEW_VERSION"
          name: calcVersion
          displayName: 'Calculate new version'
```

#### Stage 2: Update Version & Create Tag
```yaml
- stage: UpdateVersion
  dependsOn: CalculateVersion
  variables:
    newVersion: $[ stageDependencies.CalculateVersion.GetVersion.outputs['calcVersion.newVersion'] ]
  jobs:
    - job: UpdateAndTag
      steps:
        - checkout: self
          persistCredentials: true
          fetchDepth: 0
          
        - script: |
            git config user.email "azure-pipelines@policytracker.eu"
            git config user.name "Azure Pipelines"
          displayName: 'Configure Git'
          
        - script: |
            npm version $(newVersion) --no-git-tag-version
            npm install --package-lock-only
          displayName: 'Update package.json version'
          
        - script: |
            git add package.json package-lock.json
            git commit -m "chore(release): v$(newVersion) [skip ci]"
            git tag -a "v$(newVersion)" -m "Release v$(newVersion)"
          displayName: 'Commit and tag'
          
        - script: |
            git push origin HEAD:main
            git push origin "v$(newVersion)"
          displayName: 'Push changes and tag'
```

#### Stage 3: Generate Changelog (Optional)
```yaml
- stage: GenerateChangelog
  dependsOn: UpdateVersion
  jobs:
    - job: Changelog
      steps:
        - script: |
            # Get commits since last tag
            LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
            
            if [ -n "$LAST_TAG" ]; then
              COMMITS=$(git log ${LAST_TAG}..HEAD --pretty=format:"- %s (%h)" --no-merges)
            else
              COMMITS=$(git log --pretty=format:"- %s (%h)" --no-merges -20)
            fi
            
            # Prepend to CHANGELOG.md
            echo "## v$(newVersion) - $(date +%Y-%m-%d)" > CHANGELOG_NEW.md
            echo "" >> CHANGELOG_NEW.md
            echo "$COMMITS" >> CHANGELOG_NEW.md
            echo "" >> CHANGELOG_NEW.md
            
            if [ -f CHANGELOG.md ]; then
              cat CHANGELOG.md >> CHANGELOG_NEW.md
            fi
            
            mv CHANGELOG_NEW.md CHANGELOG.md
          displayName: 'Generate changelog'
          
        - script: |
            git add CHANGELOG.md
            git commit -m "docs: update CHANGELOG for v$(newVersion) [skip ci]" || true
            git push origin HEAD:main
          displayName: 'Commit changelog'
```

---

## Complete Pipeline File

Create `azure-pipelines-release.yml`:

```yaml
# Azure Pipelines - SemVer Release Pipeline
# Manual trigger only - for version management

trigger: none
pr: none

# Prevent parallel runs to avoid version conflicts
lockBehavior: sequential

parameters:
  - name: versionBump
    displayName: 'Version Bump Type'
    type: string
    default: 'patch'
    values:
      - major
      - minor
      - patch
  
  - name: preRelease
    displayName: 'Pre-release tag (optional, e.g., alpha, beta, rc)'
    type: string
    default: ''

  - name: generateChangelog
    displayName: 'Generate CHANGELOG from commits'
    type: boolean
    default: true

pool:
  vmImage: 'ubuntu-latest'

stages:
  # ============================================
  # Stage 1: Calculate New Version
  # ============================================
  - stage: CalculateVersion
    displayName: 'Calculate Version'
    jobs:
      - job: GetVersion
        displayName: 'Determine new version'
        steps:
          - checkout: self
            
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js'
            
          - script: |
              CURRENT_VERSION=$(node -p "require('./package.json').version")
              echo "Current version: $CURRENT_VERSION"
              
              # Remove any existing pre-release suffix for calculation
              BASE_VERSION=$(echo "$CURRENT_VERSION" | cut -d'-' -f1)
              
              # Parse version components
              IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE_VERSION"
              
              # Calculate new version based on bump type
              case "${{ parameters.versionBump }}" in
                major)
                  NEW_VERSION="$((MAJOR + 1)).0.0"
                  ;;
                minor)
                  NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
                  ;;
                patch)
                  NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
                  ;;
              esac
              
              # Add pre-release tag if specified
              PRERELEASE="${{ parameters.preRelease }}"
              if [ -n "$PRERELEASE" ]; then
                NEW_VERSION="${NEW_VERSION}-${PRERELEASE}"
              fi
              
              echo "##vso[task.logissue type=warning]Bumping version: $CURRENT_VERSION → $NEW_VERSION"
              echo "##vso[task.setvariable variable=currentVersion;isOutput=true]$CURRENT_VERSION"
              echo "##vso[task.setvariable variable=newVersion;isOutput=true]$NEW_VERSION"
            name: calcVersion
            displayName: 'Calculate new version'

  # ============================================
  # Stage 2: Update Version & Create Tag
  # ============================================
  - stage: UpdateVersion
    displayName: 'Update & Tag'
    dependsOn: CalculateVersion
    variables:
      currentVersion: $[ stageDependencies.CalculateVersion.GetVersion.outputs['calcVersion.currentVersion'] ]
      newVersion: $[ stageDependencies.CalculateVersion.GetVersion.outputs['calcVersion.newVersion'] ]
    jobs:
      - job: UpdateAndTag
        displayName: 'Update package.json and create git tag'
        steps:
          - checkout: self
            persistCredentials: true
            fetchDepth: 0
            
          - task: NodeTool@0
            inputs:
              versionSpec: '20.x'
            displayName: 'Install Node.js'
            
          - script: |
              git config user.email "azure-pipelines@policytracker.eu"
              git config user.name "Azure Pipelines [Release]"
            displayName: 'Configure Git'
            
          - script: |
              echo "Updating version to $(newVersion)"
              npm version $(newVersion) --no-git-tag-version --allow-same-version
              npm install --package-lock-only
            displayName: 'Update package.json version'
            
          - script: |
              git add package.json package-lock.json
              git commit -m "chore(release): v$(newVersion) [skip ci]" || echo "No changes to commit"
            displayName: 'Commit version change'
            
          - script: |
              git tag -a "v$(newVersion)" -m "Release v$(newVersion)
              
              Version bump: ${{ parameters.versionBump }}
              Previous version: $(currentVersion)
              "
            displayName: 'Create annotated tag'
            
          - script: |
              git push origin HEAD:main
              git push origin "v$(newVersion)"
            displayName: 'Push changes and tag'
            
          - script: |
              echo "##vso[task.logissue type=warning]✅ Released v$(newVersion)"
              echo "Tag: v$(newVersion)"
              echo "View at: $(System.CollectionUri)$(System.TeamProject)/_git/$(Build.Repository.Name)?version=GTv$(newVersion)"
            displayName: 'Release summary'

  # ============================================
  # Stage 3: Generate Changelog (Optional)
  # ============================================
  - stage: GenerateChangelog
    displayName: 'Generate Changelog'
    dependsOn: UpdateVersion
    condition: and(succeeded(), eq('${{ parameters.generateChangelog }}', true))
    variables:
      newVersion: $[ stageDependencies.CalculateVersion.GetVersion.outputs['calcVersion.newVersion'] ]
    jobs:
      - job: Changelog
        displayName: 'Update CHANGELOG.md'
        steps:
          - checkout: self
            persistCredentials: true
            fetchDepth: 0
            
          - script: |
              git config user.email "azure-pipelines@policytracker.eu"
              git config user.name "Azure Pipelines [Release]"
              git pull origin main
            displayName: 'Configure Git and pull latest'
            
          - script: |
              # Get the previous tag
              PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
              
              echo "Previous tag: $PREV_TAG"
              echo "New version: $(newVersion)"
              
              # Get commits since last tag
              if [ -n "$PREV_TAG" ]; then
                COMMITS=$(git log ${PREV_TAG}..HEAD --pretty=format:"- %s (%h)" --no-merges --grep="^chore(release)" --invert-grep)
              else
                COMMITS=$(git log --pretty=format:"- %s (%h)" --no-merges -30)
              fi
              
              # Categorize commits
              FEATURES=$(echo "$COMMITS" | grep -E "^- feat" || true)
              FIXES=$(echo "$COMMITS" | grep -E "^- fix" || true)
              DOCS=$(echo "$COMMITS" | grep -E "^- docs" || true)
              CHORES=$(echo "$COMMITS" | grep -E "^- (chore|ci|build|refactor|style|test)" || true)
              OTHER=$(echo "$COMMITS" | grep -vE "^- (feat|fix|docs|chore|ci|build|refactor|style|test)" || true)
              
              # Build changelog entry
              {
                echo "## [$(newVersion)] - $(date +%Y-%m-%d)"
                echo ""
                
                if [ -n "$FEATURES" ]; then
                  echo "### Features"
                  echo "$FEATURES"
                  echo ""
                fi
                
                if [ -n "$FIXES" ]; then
                  echo "### Bug Fixes"
                  echo "$FIXES"
                  echo ""
                fi
                
                if [ -n "$DOCS" ]; then
                  echo "### Documentation"
                  echo "$DOCS"
                  echo ""
                fi
                
                if [ -n "$CHORES" ]; then
                  echo "### Maintenance"
                  echo "$CHORES"
                  echo ""
                fi
                
                if [ -n "$OTHER" ]; then
                  echo "### Other"
                  echo "$OTHER"
                  echo ""
                fi
                
                echo "---"
                echo ""
              } > CHANGELOG_NEW.md
              
              # Prepend to existing CHANGELOG or create new
              if [ -f CHANGELOG.md ]; then
                # Skip the header if it exists
                if head -1 CHANGELOG.md | grep -q "^# Changelog"; then
                  tail -n +3 CHANGELOG.md >> CHANGELOG_NEW.md
                  echo "# Changelog" > CHANGELOG.md
                  echo "" >> CHANGELOG.md
                  cat CHANGELOG_NEW.md >> CHANGELOG.md
                else
                  cat CHANGELOG.md >> CHANGELOG_NEW.md
                  mv CHANGELOG_NEW.md CHANGELOG.md
                fi
              else
                echo "# Changelog" > CHANGELOG.md
                echo "" >> CHANGELOG.md
                cat CHANGELOG_NEW.md >> CHANGELOG.md
              fi
              
              rm -f CHANGELOG_NEW.md
              
              echo "=== CHANGELOG Preview ==="
              head -50 CHANGELOG.md
            displayName: 'Generate changelog from commits'
            
          - script: |
              git add CHANGELOG.md
              git commit -m "docs: update CHANGELOG for v$(newVersion) [skip ci]" || echo "No changelog changes"
              git push origin HEAD:main || echo "Nothing to push"
            displayName: 'Commit and push changelog'
```

---

## Setup Instructions

### 1. Create Pipeline File

```bash
# Create the release pipeline file
touch azure-pipelines-release.yml
# Copy the content above
```

### 2. Register Pipeline in Azure DevOps

1. Go to Azure DevOps → Pipelines → New Pipeline
2. Select "Azure Repos Git" or "GitHub"
3. Select the repository
4. Choose "Existing Azure Pipelines YAML file"
5. Select `/azure-pipelines-release.yml`
6. Save (don't run yet)
7. Rename pipeline to "Release - SemVer"

### 3. Configure Permissions

The pipeline needs permission to push to the repository:

**For Azure Repos:**
1. Project Settings → Repositories → Select repo
2. Security → Build Service → Allow "Contribute" and "Create tag"

**For GitHub:**
1. Ensure the service connection has write access
2. Or use a PAT with `repo` scope

### 4. Branch Protection (if enabled)

If your `main` branch has protection policies (require PR, require approvals):

**Option A: Exempt Build Service**
1. Project Settings → Repositories → Policies → Branch Policies (main)
2. Add Build Service account to "Bypass policies when pushing"

**Option B: Use PAT with bypass permissions**
1. Create PAT with "Code (Read & Write)" scope
2. Store as pipeline variable/secret
3. Configure git to use PAT for push operations

### 5. First Release

Run the pipeline manually:
1. Pipelines → Release - SemVer → Run pipeline
2. Select version bump type (start with `patch`)
3. Optionally add pre-release tag
4. Run

---

## Usage Examples

### Patch Release (Bug fixes)
```
Current: 0.0.1
Bump: patch
Result: 0.0.2
Tag: v0.0.2
```

### Minor Release (New features)
```
Current: 0.0.2
Bump: minor
Result: 0.1.0
Tag: v0.1.0
```

### Major Release (Breaking changes)
```
Current: 0.1.0
Bump: major
Result: 1.0.0
Tag: v1.0.0
```

### Pre-release (Beta)
```
Current: 1.0.0
Bump: minor
Pre-release: beta
Result: 1.1.0-beta
Tag: v1.1.0-beta
```

### Pre-release Limitations

> ⚠️ **Important**: This pipeline does NOT support incremental pre-release versions.

**What works:**
- `1.0.0` → (minor + beta) → `1.1.0-beta` ✅
- `1.1.0-beta` → (patch, no pre-release) → `1.1.1` ✅ (promotes to stable)

**What doesn't work:**
- `1.1.0-beta` → `1.1.0-beta.2` ❌ (no build number increment)
- Sequential beta releases will bump the base version: `1.1.0-beta` → `1.2.0-beta`

**Workaround for multiple pre-releases:**
1. Release `1.1.0-beta` 
2. For next beta, manually edit version in package.json to `1.1.0-beta.1`
3. Or use `rc` tag: `1.1.0-beta` → `1.1.0-rc`

---

## Rollback Strategy

### Scenario 1: Bad release, not yet deployed

If a release was created but not deployed to production:

```bash
# Delete the tag locally and remotely
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0

# Revert the version commit
git revert <commit-hash>
git push origin main
```

### Scenario 2: Bad release, already deployed

1. **Quick fix approach:**
   - Fix the issue in code
   - Run release pipeline with `patch` bump
   - Deploy the new version

2. **Revert approach:**
   ```bash
   # Revert the problematic changes (not the version commit)
   git revert <problematic-commit-hash>
   git push origin main
   
   # Run release pipeline with patch bump
   # This creates a new version with the revert
   ```

### Scenario 3: Need to re-release same version

Tags are immutable. If you need to re-release:

1. Delete existing tag:
   ```bash
   git tag -d v1.2.0
   git push origin :refs/tags/v1.2.0
   ```

2. Reset package.json to previous version:
   ```bash
   npm version 1.1.0 --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "chore: reset version for re-release [skip ci]"
   git push origin main
   ```

3. Run release pipeline again

---

## Commit Message Convention

For automatic changelog categorization, use conventional commits:

| Prefix | Category | Example |
|--------|----------|---------|
| `feat:` | Features | `feat: add PDF export` |
| `fix:` | Bug Fixes | `fix: email validation` |
| `docs:` | Documentation | `docs: update README` |
| `chore:` | Maintenance | `chore: update deps` |
| `ci:` | CI/CD | `ci: add caching` |
| `refactor:` | Refactoring | `refactor: simplify auth` |
| `test:` | Tests | `test: add unit tests` |

---

## Verification Checklist

After implementation, verify:

- [ ] Pipeline appears in Azure DevOps
- [ ] Manual trigger works
- [ ] Version bump calculates correctly
- [ ] package.json updated
- [ ] package-lock.json updated
- [ ] Git tag created
- [ ] Tag pushed to remote
- [ ] CHANGELOG.md generated (if enabled)
- [ ] No duplicate tags on re-run
- [ ] CI/CD pipeline NOT triggered (verify `[skip ci]` works)
- [ ] Concurrent pipeline runs are blocked (sequential lock)

---

## Troubleshooting

### "Permission denied" on push
- Check Build Service permissions
- Ensure `persistCredentials: true` in checkout
- If branch protection is enabled, see "Branch Protection" section above

### Tag already exists
- Pipeline will fail if tag exists
- Delete old tag or use different version
- See "Rollback Strategy" for tag deletion steps

### Changelog empty
- Ensure `fetchDepth: 0` for full history
- Check commit message format

### CI/CD pipeline triggered after release
- Verify `[skip ci]` is in commit messages
- Check that the CI pipeline has this directive in trigger:
  ```yaml
  trigger:
    branches:
      include:
        - main
  ```
- Azure DevOps respects `[skip ci]` in commit messages by default

### Version conflict / concurrent releases
- Pipeline uses `lockBehavior: sequential` to prevent parallel runs
- If conflict occurs, wait for current release to complete

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `azure-pipelines-release.yml` | Create | New release pipeline |
| `CHANGELOG.md` | Auto-created | Generated changelog |
| `package.json` | Modified | Version field updated |

---

## Story Points: 3

**Estimated time:** 2-3 hours

**Complexity:** Low-Medium
- Azure DevOps YAML syntax
- Git operations in pipeline
- Shell scripting for version calculation
- CI/CD integration (`[skip ci]` handling)
- Branch protection considerations
