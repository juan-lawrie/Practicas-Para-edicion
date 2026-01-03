# Generated migration to create ResetToken model
from django.db import migrations, models
import uuid
import django.utils.timezone

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_add_login_attempt_columns'),
    ]

    operations = [
        migrations.CreateModel(
            name='ResetToken',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('token_hash', models.CharField(max_length=128)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('used', models.BooleanField(default=False)),
                ('note', models.CharField(blank=True, max_length=255, null=True)),
                ('generated_by', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='generated_reset_tokens', to='api.user')),
                ('target_user', models.ForeignKey(on_delete=models.CASCADE, related_name='reset_tokens', to='api.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
