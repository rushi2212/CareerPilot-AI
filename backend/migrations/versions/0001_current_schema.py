"""Bootstrap current CareerPilot tables; safe for fresh and existing databases."""
from alembic import op
from app.database import Base
from app import models  # noqa: F401 — register all mapped tables

revision = "0001_current_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # create_all adds missing tables and leaves existing data and tables intact.
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade():
    # This baseline may be stamped onto a populated user database. Never drop its tables.
    pass
