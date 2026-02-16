namespace GlobCRM.Domain.Entities;

/// <summary>
/// Simple Admin/Member roles for Phase 1.
/// Custom roles with per-entity permissions deferred to Phase 2 RBAC.
/// </summary>
public enum UserRole
{
    Admin = 0,
    Member = 1
}

/// <summary>
/// String constants for role names, used with ASP.NET Core Identity role system.
/// Avoids magic strings and enables refactoring.
/// </summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Member = "Member";

    /// <summary>
    /// Returns all defined role names for seeding.
    /// </summary>
    public static readonly string[] All = [Admin, Member];
}
