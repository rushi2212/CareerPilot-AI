"""Keep the job listing link when a job is added to the application tracker."""
from alembic import op
import sqlalchemy as sa

revision = "0002_application_source_url"
down_revision = "0001_current_schema"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("job_applications", sa.Column("source_url", sa.String(length=1000), server_default="", nullable=False))


def downgrade():
    op.drop_column("job_applications", "source_url")
