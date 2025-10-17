"""Completa la migración del campo `role` a ForeignKey en estado.

Este archivo estaba vacío. El modelo actual (`api.User`) ya define
`role = models.ForeignKey(Role, ...)`. Para alinear el estado de las
migraciones con el estado del código sin tocar la base de datos (que
probablemente ya tiene la columna correcta), usamos
SeparateDatabaseAndState.

Si la base de datos aún tuviera un CharField antiguo, deberías crear
una migración real que:
  1. Cree un campo temporal FK (role_temp)
  2. Copie los valores mapeando nombres de rol -> Role.id
  3. Elimine el campo antiguo
  4. Renombre role_temp a role

Como ese proceso ya se hizo manualmente o no se requiere, solo
ajustamos el estado.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
	dependencies = [
		("api", "0004_create_roles_and_temp_field"),
	]

	operations = [
		# Solo actualizamos el estado de Django sin ejecutar cambios en la BD.
		migrations.SeparateDatabaseAndState(
			database_operations=[],
			state_operations=[
				migrations.AlterField(
					model_name="user",
					name="role",
					field=models.ForeignKey(
						to="api.role",
						null=True,
						blank=True,
						on_delete=models.deletion.SET_NULL,
					),
				)
			],
		)
	]

