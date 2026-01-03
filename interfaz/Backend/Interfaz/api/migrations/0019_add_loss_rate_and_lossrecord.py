# Generated migration for loss_rate field and LossRecord model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_add_recipe_yield'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='loss_rate',
            field=models.DecimalField(decimal_places=4, default=0.02, max_digits=5),
        ),
        migrations.CreateModel(
            name='LossRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=2, max_digits=10)),
                ('category', models.CharField(max_length=20)),
                ('description', models.TextField(blank=True, null=True)),
                ('cost_estimate', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='loss_records', to='api.product')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.user')),
            ],
        ),
    ]