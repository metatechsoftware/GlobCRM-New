using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddEmailIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "email_accounts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gmail_address = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    encrypted_access_token = table.Column<string>(type: "text", nullable: false),
                    encrypted_refresh_token = table.Column<string>(type: "text", nullable: false),
                    token_issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    token_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_history_id = table.Column<long>(type: "bigint", nullable: true),
                    last_sync_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sync_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    error_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_accounts", x => x.id);
                    table.ForeignKey(
                        name: "FK_email_accounts_AspNetUsers_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "email_threads",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gmail_thread_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    subject = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    snippet = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    message_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    last_message_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    linked_contact_id = table.Column<Guid>(type: "uuid", nullable: true),
                    linked_company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_threads", x => x.id);
                    table.ForeignKey(
                        name: "FK_email_threads_companies_linked_company_id",
                        column: x => x.linked_company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_email_threads_contacts_linked_contact_id",
                        column: x => x.linked_contact_id,
                        principalTable: "contacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "email_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gmail_message_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    gmail_thread_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    subject = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    from_address = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    from_name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    to_addresses = table.Column<string>(type: "jsonb", nullable: false),
                    cc_addresses = table.Column<string>(type: "jsonb", nullable: true),
                    bcc_addresses = table.Column<string>(type: "jsonb", nullable: true),
                    body_preview = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    body_html = table.Column<string>(type: "text", nullable: true),
                    body_text = table.Column<string>(type: "text", nullable: true),
                    has_attachments = table.Column<bool>(type: "boolean", nullable: false),
                    is_inbound = table.Column<bool>(type: "boolean", nullable: false),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    is_starred = table.Column<bool>(type: "boolean", nullable: false),
                    linked_contact_id = table.Column<Guid>(type: "uuid", nullable: true),
                    linked_company_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    synced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_email_messages_companies_linked_company_id",
                        column: x => x.linked_company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_email_messages_contacts_linked_contact_id",
                        column: x => x.linked_contact_id,
                        principalTable: "contacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_email_messages_email_accounts_email_account_id",
                        column: x => x.email_account_id,
                        principalTable: "email_accounts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_email_accounts_sync_status",
                table: "email_accounts",
                column: "sync_status");

            migrationBuilder.CreateIndex(
                name: "idx_email_accounts_tenant",
                table: "email_accounts",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_accounts_user",
                table: "email_accounts",
                columns: new[] { "tenant_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_email_accounts_user_id",
                table: "email_accounts",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_messages_account",
                table: "email_messages",
                column: "email_account_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_messages_company",
                table: "email_messages",
                column: "linked_company_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_messages_contact",
                table: "email_messages",
                column: "linked_contact_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_messages_sent_at",
                table: "email_messages",
                columns: new[] { "tenant_id", "sent_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_email_messages_tenant_gmail_id",
                table: "email_messages",
                columns: new[] { "tenant_id", "gmail_message_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_email_messages_thread",
                table: "email_messages",
                column: "gmail_thread_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_threads_company",
                table: "email_threads",
                column: "linked_company_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_threads_contact",
                table: "email_threads",
                column: "linked_contact_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_threads_last_message",
                table: "email_threads",
                columns: new[] { "tenant_id", "last_message_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_email_threads_tenant_gmail_id",
                table: "email_threads",
                columns: new[] { "tenant_id", "gmail_thread_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_messages");

            migrationBuilder.DropTable(
                name: "email_threads");

            migrationBuilder.DropTable(
                name: "email_accounts");
        }
    }
}
