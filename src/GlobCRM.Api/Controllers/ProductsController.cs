using FluentValidation;
using GlobCRM.Domain.Common;
using GlobCRM.Domain.Entities;
using GlobCRM.Domain.Interfaces;
using GlobCRM.Infrastructure.CustomFields;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GlobCRM.Api.Controllers;

/// <summary>
/// REST endpoints for Product CRUD operations with permission enforcement
/// and custom field validation. Products are shared tenant resources (no ownership scope).
/// </summary>
[ApiController]
[Route("api/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductRepository _productRepository;
    private readonly ICustomFieldRepository _customFieldRepository;
    private readonly CustomFieldValidator _customFieldValidator;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(
        IProductRepository productRepository,
        ICustomFieldRepository customFieldRepository,
        CustomFieldValidator customFieldValidator,
        ITenantProvider tenantProvider,
        ILogger<ProductsController> logger)
    {
        _productRepository = productRepository;
        _customFieldRepository = customFieldRepository;
        _customFieldValidator = customFieldValidator;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    // ---- CRUD Endpoints ----

    /// <summary>
    /// Lists products with server-side filtering, sorting, and pagination.
    /// No ownership scope needed -- products are shared tenant resources.
    /// Default: only active products unless explicitly filtered by isActive.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "Permission:Product:View")]
    [ProducesResponseType(typeof(PagedResult<ProductListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] EntityQueryParams queryParams)
    {
        var pagedResult = await _productRepository.GetPagedAsync(queryParams);

        var dtoResult = new PagedResult<ProductListDto>
        {
            Items = pagedResult.Items.Select(ProductListDto.FromEntity).ToList(),
            TotalCount = pagedResult.TotalCount,
            Page = pagedResult.Page,
            PageSize = pagedResult.PageSize
        };

        return Ok(dtoResult);
    }

    /// <summary>
    /// Gets a single product by ID. No ownership scope check needed.
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = "Permission:Product:View")]
    [ProducesResponseType(typeof(ProductDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product is null)
            return NotFound(new { error = "Product not found." });

        var dto = ProductDetailDto.FromEntity(product);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new product with validation and custom field validation.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "Permission:Product:Create")]
    [ProducesResponseType(typeof(ProductListDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest request)
    {
        // Validate request
        var validator = new CreateProductRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Product", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        var tenantId = _tenantProvider.GetTenantId()
            ?? throw new InvalidOperationException("No tenant context.");

        var product = new Product
        {
            TenantId = tenantId,
            Name = request.Name,
            Description = request.Description,
            UnitPrice = request.UnitPrice,
            SKU = request.SKU,
            Category = request.Category,
            IsActive = true,
            CustomFields = request.CustomFields ?? new Dictionary<string, object?>()
        };

        var created = await _productRepository.CreateAsync(product);

        _logger.LogInformation("Product created: {ProductName} ({ProductId})", created.Name, created.Id);

        return CreatedAtAction(
            nameof(GetById),
            new { id = created.Id },
            ProductListDto.FromEntity(created));
    }

    /// <summary>
    /// Updates an existing product including IsActive status and custom field validation.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = "Permission:Product:Edit")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest request)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product is null)
            return NotFound(new { error = "Product not found." });

        // Validate request
        var validator = new UpdateProductRequestValidator();
        var validationResult = await validator.ValidateAsync(request);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors
                    .Select(e => new { field = e.PropertyName, message = e.ErrorMessage })
            });
        }

        // Validate custom fields if provided
        if (request.CustomFields is { Count: > 0 })
        {
            var cfErrors = await _customFieldValidator.ValidateAsync("Product", request.CustomFields);
            if (cfErrors.Count > 0)
            {
                return BadRequest(new
                {
                    errors = cfErrors.Select(e => new { field = e.FieldId, message = e.Message })
                });
            }
        }

        // Update fields
        product.Name = request.Name;
        product.Description = request.Description;
        product.UnitPrice = request.UnitPrice;
        product.SKU = request.SKU;
        product.Category = request.Category;
        product.IsActive = request.IsActive;

        if (request.CustomFields is not null)
            product.CustomFields = request.CustomFields;

        await _productRepository.UpdateAsync(product);

        _logger.LogInformation("Product updated: {ProductId}", id);

        return NoContent();
    }

    /// <summary>
    /// Hard deletes a product. Products can alternatively be deactivated via PUT with IsActive=false.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "Permission:Product:Delete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id);
        if (product is null)
            return NotFound(new { error = "Product not found." });

        await _productRepository.DeleteAsync(id);

        _logger.LogInformation("Product deleted: {ProductId}", id);

        return NoContent();
    }
}

// ---- DTOs ----

/// <summary>
/// Summary DTO for product list views.
/// </summary>
public record ProductListDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal UnitPrice { get; init; }
    public string? SKU { get; init; }
    public string? Category { get; init; }
    public bool IsActive { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ProductListDto FromEntity(Product entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        UnitPrice = entity.UnitPrice,
        SKU = entity.SKU,
        Category = entity.Category,
        IsActive = entity.IsActive,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

/// <summary>
/// Detailed DTO for product detail view including custom fields.
/// </summary>
public record ProductDetailDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal UnitPrice { get; init; }
    public string? SKU { get; init; }
    public string? Category { get; init; }
    public bool IsActive { get; init; }
    public Dictionary<string, object?> CustomFields { get; init; } = new();
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    public static ProductDetailDto FromEntity(Product entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        UnitPrice = entity.UnitPrice,
        SKU = entity.SKU,
        Category = entity.Category,
        IsActive = entity.IsActive,
        CustomFields = entity.CustomFields,
        CreatedAt = entity.CreatedAt,
        UpdatedAt = entity.UpdatedAt
    };
}

// ---- Request DTOs ----

/// <summary>
/// Request body for creating a product.
/// </summary>
public record CreateProductRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal UnitPrice { get; init; }
    public string? SKU { get; init; }
    public string? Category { get; init; }
    public Dictionary<string, object?>? CustomFields { get; init; }
}

/// <summary>
/// Request body for updating a product. Includes IsActive for activation/deactivation.
/// </summary>
public record UpdateProductRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal UnitPrice { get; init; }
    public string? SKU { get; init; }
    public string? Category { get; init; }
    public bool IsActive { get; init; } = true;
    public Dictionary<string, object?>? CustomFields { get; init; }
}

// ---- FluentValidation ----

/// <summary>
/// FluentValidation validator for CreateProductRequest.
/// Validates Name is required and UnitPrice is non-negative.
/// </summary>
public class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Product name is required.")
            .MaximumLength(200).WithMessage("Product name must be at most 200 characters.");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Unit price must be 0 or greater.");
    }
}

/// <summary>
/// FluentValidation validator for UpdateProductRequest.
/// Same validations as create.
/// </summary>
public class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Product name is required.")
            .MaximumLength(200).WithMessage("Product name must be at most 200 characters.");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Unit price must be 0 or greater.");
    }
}
