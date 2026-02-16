// EntityQueryParams and FilterParam are defined in GlobCRM.Domain.Common
// and are used directly by controllers via:
//   using GlobCRM.Domain.Common;
//
// PagedResult<T> is also in GlobCRM.Domain.Common.
//
// This file exists as a reference pointer. The canonical types are in:
//   src/GlobCRM.Domain/Common/EntityQueryParams.cs
//   src/GlobCRM.Domain/Common/PagedResult.cs

// Re-export for convenience so controllers can use either namespace
global using GlobCRM.Domain.Common;
