---
phase: 02-core-infrastructure
plan: 03
subsystem: database
tags: [ef-core, jsonb, skiasharp, avatar, file-storage, user-profile, postgresql]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ApplicationUser entity with Identity, Organization FK, basic profile fields"
provides:
  - "Extended ApplicationUser with 14 rich profile fields (phone, jobTitle, department, timezone, language, bio, avatar, socialLinks, workSchedule, reportingManager, skills, preferences)"
  - "UserPreferencesData JSONB value type (theme, language, timezone, dateFormat, emailNotifications)"
  - "WorkSchedule JSONB value type (workDays, startTime, endTime)"
  - "AvatarService with SkiaSharp image processing (256px full, 64px thumb, WebP)"
  - "IFileStorageService abstraction with LocalFileStorageService implementation"
  - "EF Core migration AddUserProfileFields with JSONB column configuration"
affects: [user-profile-api, user-settings, avatar-upload-endpoint, file-serving]

# Tech tracking
tech-stack:
  added: [SkiaSharp 3.119.2]
  patterns: [JSONB-with-JsonSerializer-value-converters, tenant-partitioned-file-storage, file-storage-abstraction]

key-files:
  created:
    - src/GlobCRM.Domain/Entities/UserPreferencesData.cs
    - src/GlobCRM.Domain/Entities/WorkSchedule.cs
    - src/GlobCRM.Infrastructure/Images/AvatarService.cs
    - src/GlobCRM.Infrastructure/Images/ImageServiceExtensions.cs
    - src/GlobCRM.Infrastructure/Storage/IFileStorageService.cs
    - src/GlobCRM.Infrastructure/Storage/LocalFileStorageService.cs
    - src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260216154115_AddUserProfileFields.cs
  modified:
    - src/GlobCRM.Domain/Entities/ApplicationUser.cs
    - src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
    - src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj

key-decisions:
  - "Used JsonSerializer value converters for JSONB columns (SocialLinks, WorkSchedule, Preferences, Skills) instead of OwnsOne().ToJson() because EF Core ToJson cannot handle Dictionary<> properties"
  - "SkiaSharp 3.119.2 for avatar processing (MIT license, free -- not ImageSharp which costs $4999)"
  - "SKSamplingOptions.Default instead of deprecated SKFilterQuality.High for image resizing"
  - "LocalFileStorageService as singleton, AvatarService as scoped in DI"

patterns-established:
  - "JSONB value converter pattern: use System.Text.Json HasConversion for complex JSONB types with Dictionary<> properties"
  - "File storage abstraction: IFileStorageService with tenant-partitioned paths ({tenantId}/{category}/{fileName})"
  - "Avatar processing pipeline: decode -> resize (aspect ratio) -> encode WebP -> save via file storage"

# Metrics
duration: 12min
completed: 2026-02-16
---

# Phase 2 Plan 3: User Profile & Avatar Summary

**Extended ApplicationUser with 14 rich profile fields, JSONB preferences/schedule types, SkiaSharp avatar processing (256px+64px WebP), and tenant-partitioned file storage abstraction**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-16T15:29:40Z
- **Completed:** 2026-02-16T15:42:16Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Extended ApplicationUser with all rich profile fields: Phone, JobTitle, Department, Timezone, Language, Bio, AvatarUrl, AvatarColor, SocialLinks, WorkSchedule, ReportingManagerId, Skills, Preferences
- Created UserPreferencesData JSONB type with theme, language, timezone, date format, and email notification toggles
- Created WorkSchedule JSONB type with configurable work days and hours
- Installed SkiaSharp 3.119.2 and built AvatarService for server-side image processing (256px full, 64px thumb, WebP quality 85)
- Created IFileStorageService abstraction with LocalFileStorageService for tenant-partitioned local storage
- Generated and verified EF Core migration with proper column constraints and JSONB defaults

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ApplicationUser with profile fields and create value types** - `c858240` (feat)
2. **Task 2: Update EF config, install SkiaSharp, create AvatarService and file storage, create migration** - `8b584ed` (feat)

## Files Created/Modified
- `src/GlobCRM.Domain/Entities/ApplicationUser.cs` - Extended with 14 rich profile properties
- `src/GlobCRM.Domain/Entities/UserPreferencesData.cs` - JSONB value type for user preferences
- `src/GlobCRM.Domain/Entities/WorkSchedule.cs` - JSONB value type for work schedule
- `src/GlobCRM.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs` - EF config with JSONB columns, max lengths, self-referential FK
- `src/GlobCRM.Infrastructure/Images/AvatarService.cs` - Avatar processing with SkiaSharp (resize, WebP encode)
- `src/GlobCRM.Infrastructure/Images/ImageServiceExtensions.cs` - DI registration for image/storage services
- `src/GlobCRM.Infrastructure/Storage/IFileStorageService.cs` - File storage abstraction interface
- `src/GlobCRM.Infrastructure/Storage/LocalFileStorageService.cs` - Local filesystem implementation
- `src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj` - Added SkiaSharp 3.119.2 package reference
- `src/GlobCRM.Infrastructure/Persistence/Migrations/App/20260216154115_AddUserProfileFields.cs` - Migration for column adjustments

## Decisions Made
- Used `System.Text.Json` `HasConversion` for JSONB columns instead of `OwnsOne().ToJson()` because EF Core's ToJson does not support `Dictionary<>` properties in owned types
- Selected SkiaSharp 3.119.2 (MIT license, free) over ImageSharp ($4999 commercial license)
- Used `SKSamplingOptions.Default` instead of deprecated `SKFilterQuality.High` for SkiaSharp 3.x compatibility
- Registered `LocalFileStorageService` as singleton and `AvatarService` as scoped
- Added `'{}'::jsonb` default value SQL for preferences column

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed deprecated SkiaSharp API usage**
- **Found during:** Task 2 (AvatarService creation)
- **Issue:** `SKFilterQuality` and `SKBitmap.Resize(SKImageInfo, SKFilterQuality)` are obsolete in SkiaSharp 3.x
- **Fix:** Replaced with `SKSamplingOptions.Default` and `SKBitmap.Resize(SKImageInfo, SKSamplingOptions)`
- **Files modified:** src/GlobCRM.Infrastructure/Images/AvatarService.cs
- **Verification:** Build passes with 0 warnings
- **Committed in:** 8b584ed (Task 2 commit)

**2. [Rule 1 - Bug] Fixed corrupted csproj file from parallel package install**
- **Found during:** Task 2 (SkiaSharp installation)
- **Issue:** Concurrent `dotnet add package` command left trailing `ct>` text and floating version `3.*` in csproj
- **Fix:** Rewrote csproj with clean XML and pinned SkiaSharp to 3.119.2
- **Files modified:** src/GlobCRM.Infrastructure/GlobCRM.Infrastructure.csproj
- **Verification:** dotnet restore and build succeed
- **Committed in:** 8b584ed (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Parallel plan execution created some profile fields before this plan ran, so migration adjusts column constraints (max lengths, index names, defaults) rather than creating new columns. This is expected behavior with parallel execution.
- `dotnet add package` background process had file lock contention; resolved by rewriting csproj and running explicit restore.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ApplicationUser rich profile fields ready for profile API endpoints
- AvatarService ready for avatar upload endpoint integration
- File storage abstraction ready for future cloud swap (S3, Azure Blob)
- UserPreferencesData ready for user settings API
- Self-referential ReportingManager FK ready for org hierarchy features

## Self-Check: PASSED

- All 8 created files verified on disk
- Both commits (c858240, 8b584ed) verified in git log
- Full solution build: 0 errors, 0 warnings (excluding unrelated Roslyn AD0001)

---
*Phase: 02-core-infrastructure*
*Completed: 2026-02-16*
