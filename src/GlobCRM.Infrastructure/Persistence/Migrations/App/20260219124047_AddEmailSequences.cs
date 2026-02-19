using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GlobCRM.Infrastructure.Persistence.Migrations.App
{
    /// <inheritdoc />
    public partial class AddEmailSequences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "email_sequences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_seed_data = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_sequences", x => x.id);
                    table.ForeignKey(
                        name: "FK_email_sequences_AspNetUsers_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "email_sequence_steps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_number = table.Column<int>(type: "integer", nullable: false),
                    email_template_id = table.Column<Guid>(type: "uuid", nullable: false),
                    subject_override = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    delay_days = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    preferred_send_time = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_email_sequence_steps", x => x.id);
                    table.ForeignKey(
                        name: "FK_email_sequence_steps_email_sequences_sequence_id",
                        column: x => x.sequence_id,
                        principalTable: "email_sequences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_email_sequence_steps_email_templates_email_template_id",
                        column: x => x.email_template_id,
                        principalTable: "email_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sequence_enrollments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence_id = table.Column<Guid>(type: "uuid", nullable: false),
                    contact_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    current_step_number = table.Column<int>(type: "integer", nullable: false),
                    steps_sent = table.Column<int>(type: "integer", nullable: false),
                    start_from_step = table.Column<int>(type: "integer", nullable: false),
                    last_step_sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    replied_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    reply_step_number = table.Column<int>(type: "integer", nullable: true),
                    paused_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    bounced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    bounce_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hangfire_job_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sequence_enrollments", x => x.id);
                    table.ForeignKey(
                        name: "FK_sequence_enrollments_AspNetUsers_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sequence_enrollments_contacts_contact_id",
                        column: x => x.contact_id,
                        principalTable: "contacts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sequence_enrollments_email_sequences_sequence_id",
                        column: x => x.sequence_id,
                        principalTable: "email_sequences",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sequence_tracking_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    enrollment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step_number = table.Column<int>(type: "integer", nullable: false),
                    event_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    gmail_message_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    gmail_thread_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ip_address = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sequence_tracking_events", x => x.id);
                    table.ForeignKey(
                        name: "FK_sequence_tracking_events_sequence_enrollments_enrollment_id",
                        column: x => x.enrollment_id,
                        principalTable: "sequence_enrollments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_email_sequence_steps_sequence_id",
                table: "email_sequence_steps",
                column: "sequence_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_sequence_steps_sequence_step_unique",
                table: "email_sequence_steps",
                columns: new[] { "sequence_id", "step_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_email_sequence_steps_template_id",
                table: "email_sequence_steps",
                column: "email_template_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_sequences_created_by",
                table: "email_sequences",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_sequences_tenant_id",
                table: "email_sequences",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "idx_sequence_enrollments_contact_id",
                table: "sequence_enrollments",
                column: "contact_id");

            migrationBuilder.CreateIndex(
                name: "idx_sequence_enrollments_sequence_id",
                table: "sequence_enrollments",
                column: "sequence_id");

            migrationBuilder.CreateIndex(
                name: "idx_sequence_enrollments_status",
                table: "sequence_enrollments",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "idx_sequence_enrollments_tenant_id",
                table: "sequence_enrollments",
                column: "tenant_id");

            migrationBuilder.CreateIndex(
                name: "IX_sequence_enrollments_created_by_user_id",
                table: "sequence_enrollments",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "idx_sequence_tracking_events_enrollment_id",
                table: "sequence_tracking_events",
                column: "enrollment_id");

            migrationBuilder.CreateIndex(
                name: "idx_sequence_tracking_events_event_type",
                table: "sequence_tracking_events",
                column: "event_type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "email_sequence_steps");

            migrationBuilder.DropTable(
                name: "sequence_tracking_events");

            migrationBuilder.DropTable(
                name: "sequence_enrollments");

            migrationBuilder.DropTable(
                name: "email_sequences");
        }
    }
}
