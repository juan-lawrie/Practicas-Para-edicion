"""Placeholder de migración 0004.

Este archivo estaba vacío y causaba BadMigrationError. Originalmente
podría haber contenido pasos intermedios para transformar el campo
`role` de User (de CharField a una ForeignKey). Los cambios reales ya
se aplicaron manualmente en la base de datos o mediante ediciones del
modelo, por lo que aquí solo registramos una migración sin operaciones
para mantener la cadena de dependencias consistente.

Si necesitas reconstruir correctamente el historial más adelante,
puedes crear una migración que realice pasos intermedios reales.
"""

from django.db import migrations


class Migration(migrations.Migration):
	dependencies = [
		("api", "0003_product_category"),
	]

	# No hacemos operaciones porque el estado real ya fue ajustado manualmente.
	operations = []

