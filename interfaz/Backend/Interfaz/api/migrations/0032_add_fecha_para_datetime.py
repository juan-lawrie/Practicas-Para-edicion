# Generated migration to alter fecha_para_la_que_se_quiere_el_pedido from DateField to DateTimeField

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0031_alter_order_options_rename_date_order_delivery_date_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='fecha_para_la_que_se_quiere_el_pedido',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
