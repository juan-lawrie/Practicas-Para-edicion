# Generated migration to add recipe_yield to Product
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_alter_product_unit_alter_recipeingredient_unit'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='recipe_yield',
            field=models.IntegerField(default=1),
        ),
    ]
