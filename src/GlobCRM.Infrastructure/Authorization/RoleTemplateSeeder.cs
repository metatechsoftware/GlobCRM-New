using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GlobCRM.Infrastructure.Authorization;

/// <summary>
/// Seeds default role templates (Admin, Manager, Sales Rep, Viewer) for a tenant.
/// Called on startup for existing tenants and should be called when creating new organizations.
///
/// Per locked decision: four template roles with per-entity CRUD permissions.
/// Admin = All scope, Manager = Team scope, Sales Rep = Team(View)/Own(CED), Viewer = All(View)/None(CED).
/// </summary>
public static class RoleTemplateSeeder
{
    /// <summary>
    /// The four CRUD operations used for permission seeding.
    /// </summary>
    private static readonly string[] Operations = ["View", "Create", "Edit", "Delete"];

    /// <summary>
    /// Seeds template roles and their permissions for the given tenant.
    /// Idempotent: skips if templates already exist for this tenant.
    /// </summary>
    public static async Task SeedTemplateRolesAsync(ApplicationDbContext db, Guid tenantId)
    {
        // Idempotent check: skip if templates already exist for this tenant
        var hasTemplates = await db.Roles
            .IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == tenantId && r.IsTemplate);

        if (hasTemplates) return;

        // Get all entity types from the enum
        var entityTypes = Enum.GetNames<EntityType>();

        // Create Admin role -- full access (All scope) on everything
        var admin = CreateRole(tenantId, "Admin",
            "Full access to all records and settings");
        AddPermissions(admin, entityTypes, Operations,
            _ => PermissionScope.All);

        // Create Manager role -- team access (Team scope) on everything
        var manager = CreateRole(tenantId, "Manager",
            "Full access to team records");
        AddPermissions(manager, entityTypes, Operations,
            _ => PermissionScope.Team);

        // Create Sales Rep role -- View at Team scope, Create/Edit/Delete at Own scope
        var salesRep = CreateRole(tenantId, "Sales Rep",
            "Access to own records, view team records");
        AddPermissions(salesRep, entityTypes, Operations,
            operation => operation == "View" ? PermissionScope.Team : PermissionScope.Own);

        // Create Viewer role -- View at All scope, Create/Edit/Delete at None scope
        var viewer = CreateRole(tenantId, "Viewer",
            "Read-only access to all records");
        AddPermissions(viewer, entityTypes, Operations,
            operation => operation == "View" ? PermissionScope.All : PermissionScope.None);

        db.Roles.AddRange(admin, manager, salesRep, viewer);
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Seeds template roles for all existing tenants.
    /// Called on application startup to ensure all tenants have role templates.
    /// Also ensures existing roles have permissions for all entity types (idempotent).
    /// </summary>
    public static async Task SeedAllTenantsAsync(ApplicationDbContext db)
    {
        // Get all distinct tenant IDs from existing roles or organizations
        // Use IgnoreQueryFilters to see all tenants regardless of current tenant context
        var tenantIds = await db.Users
            .IgnoreQueryFilters()
            .Where(u => u.OrganizationId != Guid.Empty)
            .Select(u => u.OrganizationId)
            .Distinct()
            .ToListAsync();

        foreach (var tenantId in tenantIds)
        {
            await SeedTemplateRolesAsync(db, tenantId);
            await EnsurePermissionsForAllEntityTypesAsync(db, tenantId);
            await EnsureAdminRoleAssignmentsAsync(db, tenantId);
        }
    }

    /// <summary>
    /// Ensures all template roles for a tenant have permissions for every EntityType.
    /// Idempotent: only adds missing permissions. This handles the case where roles
    /// were seeded before new entity types (Company, Contact, Product) were added.
    /// Scope mapping follows the same pattern as SeedTemplateRolesAsync:
    ///   Admin = All, Manager = Team, Sales Rep = View(Team)/CED(Own), Viewer = View(All)/CED(None)
    /// </summary>
    public static async Task EnsurePermissionsForAllEntityTypesAsync(ApplicationDbContext db, Guid tenantId)
    {
        // Load roles and existing permissions with AsNoTracking to avoid change-tracker
        // interference that causes DbUpdateConcurrencyException on unmodified rows
        var templateRoles = await db.Roles
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Permissions)
            .Where(r => r.TenantId == tenantId && r.IsTemplate)
            .ToListAsync();

        if (templateRoles.Count == 0) return;

        var entityTypes = Enum.GetNames<EntityType>();
        var newPermissions = new List<RolePermission>();

        foreach (var role in templateRoles)
        {
            Func<string, PermissionScope> scopeResolver = role.Name switch
            {
                "Admin" => _ => PermissionScope.All,
                "Manager" => _ => PermissionScope.Team,
                "Sales Rep" => op => op == "View" ? PermissionScope.Team : PermissionScope.Own,
                "Viewer" => op => op == "View" ? PermissionScope.All : PermissionScope.None,
                _ => _ => PermissionScope.None // Unknown role gets no access
            };

            foreach (var entityType in entityTypes)
            {
                foreach (var operation in Operations)
                {
                    var exists = role.Permissions.Any(p =>
                        p.EntityType == entityType && p.Operation == operation);

                    if (!exists)
                    {
                        newPermissions.Add(new RolePermission
                        {
                            Id = Guid.NewGuid(),
                            RoleId = role.Id,
                            EntityType = entityType,
                            Operation = operation,
                            Scope = scopeResolver(operation)
                        });
                    }
                }
            }
        }

        if (newPermissions.Count > 0)
        {
            db.Set<RolePermission>().AddRange(newPermissions);
            await db.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Ensures users with Identity "Admin" role have a UserRoleAssignment to the RBAC Admin template role.
    /// Bridges the gap between Identity roles (used for [Authorize(Roles)]) and RBAC roles
    /// (used for Permission policy checks). Idempotent.
    /// </summary>
    public static async Task EnsureAdminRoleAssignmentsAsync(ApplicationDbContext db, Guid tenantId)
    {
        // Find the RBAC Admin template role for this tenant
        var adminRole = await db.Roles
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.IsTemplate && r.Name == "Admin");

        if (adminRole == null) return;

        // Find the Identity "Admin" role ID
        var identityAdminRole = await db.Set<IdentityRole<Guid>>()
            .FirstOrDefaultAsync(r => r.NormalizedName == "ADMIN");

        if (identityAdminRole == null) return;

        // Get all users in this tenant who have the Identity Admin role
        var adminUserIds = await db.Set<IdentityUserRole<Guid>>()
            .Join(
                db.Users.IgnoreQueryFilters().Where(u => u.OrganizationId == tenantId),
                ur => ur.UserId,
                u => u.Id,
                (ur, u) => new { ur.UserId, ur.RoleId })
            .Where(x => x.RoleId == identityAdminRole.Id)
            .Select(x => x.UserId)
            .ToListAsync();

        if (adminUserIds.Count == 0) return;

        // Check which admin users already have a UserRoleAssignment to the RBAC Admin role
        var existingAssignments = await db.UserRoleAssignments
            .IgnoreQueryFilters()
            .Where(ura => ura.RoleId == adminRole.Id && adminUserIds.Contains(ura.UserId))
            .Select(ura => ura.UserId)
            .ToListAsync();

        var missingUserIds = adminUserIds.Except(existingAssignments).ToList();

        foreach (var userId in missingUserIds)
        {
            db.UserRoleAssignments.Add(new UserRoleAssignment
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                RoleId = adminRole.Id
            });
        }

        if (missingUserIds.Count > 0)
        {
            await db.SaveChangesAsync();
        }
    }

    private static Role CreateRole(Guid tenantId, string name, string description)
    {
        return new Role
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = name,
            Description = description,
            IsSystem = true,
            IsTemplate = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    private static void AddPermissions(
        Role role,
        string[] entityTypes,
        string[] operations,
        Func<string, PermissionScope> scopeResolver)
    {
        foreach (var entityType in entityTypes)
        {
            foreach (var operation in operations)
            {
                role.Permissions.Add(new RolePermission
                {
                    Id = Guid.NewGuid(),
                    RoleId = role.Id,
                    EntityType = entityType,
                    Operation = operation,
                    Scope = scopeResolver(operation)
                });
            }
        }
    }
}
