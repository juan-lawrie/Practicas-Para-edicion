"""Auto migration to add login attempt tracking fields.

This migration was added because migration 0022 was modified after it had
already been applied (it was empty). To ensure the database has the new
columns, we create a new migration that adds them.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_add_login_attempt_tracking'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='failed_login_attempts',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='user',
            name='is_locked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='locked_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
