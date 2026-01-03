"""Merge migration to resolve multiple 0025 leaf nodes.

This migration depends on both conflicting 0025 migrations and acts as a
merge node with no operations (Django will consider the graph linearized).
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0025_allow_null_targetuser_resettoken"),
        ("api", "0025_alter_resettoken_id"),
    ]

    operations = [
        # No DB operations; this is a pure merge migration
    ]
