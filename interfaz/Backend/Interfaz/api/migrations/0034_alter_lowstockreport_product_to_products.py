# Generated migration for LowStockReport model changes
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0033_alter_order_options_and_more'),
    ]

    operations = [
        # Eliminar el campo antiguo 'product'
        migrations.RemoveField(
            model_name='lowstockreport',
            name='product',
        ),
        # Agregar el nuevo campo ManyToMany 'products'
        migrations.AddField(
            model_name='lowstockreport',
            name='products',
            field=models.ManyToManyField(related_name='low_stock_reports', to='api.product'),
        ),
    ]
