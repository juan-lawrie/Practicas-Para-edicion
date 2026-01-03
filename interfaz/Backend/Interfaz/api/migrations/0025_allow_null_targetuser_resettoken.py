"""Migration para permitir target_user nulo en ResetToken.

Este archivo estaba vacío y provocaba BadMigrationError: "no Migration class".
La migración aplica un AlterField no destructivo que permite NULL/blank
en el campo target_user. Depende de la migración que creó ResetToken.
"""
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		("api", "0024_create_resettoken"),
	]

	operations = [
		migrations.AlterField(
			model_name='resettoken',
			name='target_user',
			field=models.ForeignKey(
				to=settings.AUTH_USER_MODEL,
				on_delete=models.CASCADE,
				null=True,
				blank=True,
				related_name='reset_tokens',
			),
		),
	]


