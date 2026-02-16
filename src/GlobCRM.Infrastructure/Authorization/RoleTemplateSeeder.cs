using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Enums;
using GlobCRM.Infrastructure.Persistence;
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
        var templateRoles = await db.Roles
            .IgnoreQueryFilters()
            .Include(r => r.Permissions)
            .Where(r => r.TenantId == tenantId && r.IsTemplate)
            .ToListAsync();

        if (templateRoles.Count == 0) return;

        var entityTypes = Enum.GetNames<EntityType>();
        var hasChanges = false;

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
                        role.Permissions.Add(new RolePermission
                        {
                            Id = Guid.NewGuid(),
                            RoleId = role.Id,
                            EntityType = entityType,
                            Operation = operation,
                            Scope = scopeResolver(operation)
                        });
                        hasChanges = true;
                    }
                }
            }
        }

        if (hasChanges)
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
